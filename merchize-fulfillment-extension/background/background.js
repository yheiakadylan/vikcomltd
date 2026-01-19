/**
 * POD Workflow - Merchize Fulfillment Extension
 * Background Service Worker
 */

// Constants
const MERCHIZE_BASE_URL = 'https://seller.merchize.com';
const STORAGE_PREFIX = 'fulfill_';
const EXPIRY_TIME = 3600000; // 1 hour

// State
const pendingFulfillments = new Map();
const processingQueue = new Set();

/**
 * Message Handler - Central hub for all extension communications
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Background] Received message:', request.action);

    switch (request.action) {
        case 'fulfill_order':
            handleFulfillOrder(request.orderData)
                .then(result => sendResponse({ success: true, result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Keep channel open for async

        case 'get_pending_fulfillment':
            const data = pendingFulfillments.get(request.tabId);
            sendResponse({ success: true, data });
            return true;

        case 'clear_pending_fulfillment':
            pendingFulfillments.delete(request.tabId);
            sendResponse({ success: true });
            return true;

        case 'update_fulfillment_status':
            handleStatusUpdate(request.orderId, request.status)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'get_current_tab_id':
            chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                sendResponse({ tabId: tabs[0]?.id });
            });
            return true;

        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }
});

/**
 * Handle fulfill order request from POD Workflow
 */
async function handleFulfillOrder(orderData) {
    try {
        console.log('[Background] Processing fulfill request:', orderData.readableId);

        // Validate required fields
        if (!orderData.readableId || !orderData.designFiles?.length) {
            throw new Error('Missing required fields: readableId or designFiles');
        }

        // Check if already processing
        if (processingQueue.has(orderData.id)) {
            throw new Error('This order is already being processed');
        }

        processingQueue.add(orderData.id);

        // Prepare data for storage
        const fulfillmentData = {
            orderId: orderData.id,
            readableId: orderData.readableId,
            sku: orderData.sku || '',
            title: orderData.title || '',
            designFiles: orderData.designFiles,
            timestamp: Date.now(),
            status: 'pending'
        };

        // Store in chrome.storage.local (encrypted in production)
        const storageKey = `${STORAGE_PREFIX}${orderData.id}`;
        await chrome.storage.local.set({ [storageKey]: fulfillmentData });

        // Create new Merchize tab
        const tab = await chrome.tabs.create({
            url: `${MERCHIZE_BASE_URL}/orders`,
            active: true
        });

        // Map tab to order for content script retrieval
        pendingFulfillments.set(tab.id, {
            orderId: orderData.id,
            readableId: orderData.readableId,
            storageKey
        });

        console.log(`[Background] Opened Merchize tab ${tab.id} for order #${orderData.readableId}`);

        // Setup tab cleanup listener
        setupTabCleanup(tab.id, storageKey, orderData.id);

        return {
            tabId: tab.id,
            message: `Opening Merchize for order #${orderData.readableId}`
        };

    } catch (error) {
        console.error('[Background] Fulfill error:', error);
        processingQueue.delete(orderData.id);
        throw error;
    }
}

/**
 * Setup cleanup when tab is closed
 */
function setupTabCleanup(tabId, storageKey, orderId) {
    const cleanupListener = (closedTabId) => {
        if (closedTabId === tabId) {
            console.log(`[Background] Tab ${tabId} closed, cleaning up`);
            pendingFulfillments.delete(tabId);
            processingQueue.delete(orderId);
            chrome.storage.local.remove(storageKey);
            chrome.tabs.onRemoved.removeListener(cleanupListener);
        }
    };

    chrome.tabs.onRemoved.addListener(cleanupListener);
}

/**
 * Handle status update from Merchize content script
 */
async function handleStatusUpdate(orderId, status) {
    console.log(`[Background] Status update for ${orderId}: ${status}`);

    // Update storage
    const storageKey = `${STORAGE_PREFIX}${orderId}`;
    const data = await chrome.storage.local.get(storageKey);

    if (data[storageKey]) {
        data[storageKey].status = status;
        data[storageKey].updatedAt = Date.now();
        await chrome.storage.local.set({ [storageKey]: data[storageKey] });
    }

    // Show notification
    await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icon-48.png',
        title: 'POD Fulfillment Update',
        message: `Order status: ${status}`,
        priority: 2
    });
}

/**
 * Periodic cleanup of expired data
 */
async function cleanupExpiredData() {
    const allItems = await chrome.storage.local.get(null);
    const now = Date.now();
    const keysToRemove = [];

    for (const [key, value] of Object.entries(allItems)) {
        if (key.startsWith(STORAGE_PREFIX)) {
            if (now - value.timestamp > EXPIRY_TIME) {
                keysToRemove.push(key);
                console.log(`[Background] Removing expired data: ${key}`);
            }
        }
    }

    if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        console.log(`[Background] Cleaned up ${keysToRemove.length} expired items`);
    }
}

// Run cleanup every 10 minutes
chrome.alarms.create('cleanup', { periodInMinutes: 10 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanup') {
        cleanupExpiredData();
    }
});

// Initial cleanup on extension load
cleanupExpiredData();

console.log('[Background] POD Fulfillment Extension initialized');
