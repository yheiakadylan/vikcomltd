/**
 * Extension Popup UI Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
    await loadStatus();
    await loadPendingFulfillments();
    await loadSettings();
    setupEventListeners();
});

/**
 * Load extension status
 */
async function loadStatus() {
    try {
        // Get today's fulfillment count
        const stats = await chrome.storage.local.get('fulfillment_stats');
        const today = new Date().toDateString();
        const todayCount = stats.fulfillment_stats?.[today] || 0;

        document.getElementById('today-count').textContent = todayCount;
    } catch (error) {
        console.error('Failed to load status:', error);
    }
}

/**
 * Load pending fulfillments
 */
async function loadPendingFulfillments() {
    try {
        const allData = await chrome.storage.local.get(null);
        const pending = [];

        for (const [key, value] of Object.entries(allData)) {
            if (key.startsWith('fulfill_') && value.status === 'pending') {
                pending.push(value);
            }
        }

        const listEl = document.getElementById('pending-list');

        if (pending.length === 0) {
            listEl.innerHTML = '<p class="empty-state">Không có đơn hàng nào đang xử lý</p>';
        } else {
            listEl.innerHTML = pending.map(item => `
        <div class="pending-item">
          <div class="pending-info">
            <strong>#${item.readableId}</strong>
            <span class="pending-time">${formatTime(item.timestamp)}</span>
          </div>
          <span class="pending-status">Đang xử lý...</span>
        </div>
      `).join('');
        }
    } catch (error) {
        console.error('Failed to load pending fulfillments:', error);
    }
}

/**
 * Load settings
 */
async function loadSettings() {
    try {
        const settings = await chrome.storage.local.get(['auto_close_tab', 'show_notifications']);

        document.getElementById('auto-close-tab').checked = settings.auto_close_tab !== false;
        document.getElementById('show-notifications').checked = settings.show_notifications !== false;
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Settings
    document.getElementById('auto-close-tab').addEventListener('change', async (e) => {
        await chrome.storage.local.set({ auto_close_tab: e.target.checked });
    });

    document.getElementById('show-notifications').addEventListener('change', async (e) => {
        await chrome.storage.local.set({ show_notifications: e.target.checked });
    });

    // Buttons
    document.getElementById('clear-data').addEventListener('click', async () => {
        if (confirm('Bạn có chắc muốn xóa tất cả dữ liệu fulfillment?')) {
            await clearAllData();
            await loadPendingFulfillments();
            await loadStatus();
        }
    });

    document.getElementById('view-guide').addEventListener('click', () => {
        chrome.tabs.create({
            url: 'https://your-docs-url.com/merchize-extension-guide'
        });
    });
}

/**
 * Clear all fulfillment data
 */
async function clearAllData() {
    try {
        const allData = await chrome.storage.local.get(null);
        const keysToRemove = [];

        for (const key of Object.keys(allData)) {
            if (key.startsWith('fulfill_')) {
                keysToRemove.push(key);
            }
        }

        if (keysToRemove.length > 0) {
            await chrome.storage.local.remove(keysToRemove);
        }

        alert('Đã xóa tất cả dữ liệu fulfillment');
    } catch (error) {
        console.error('Failed to clear data:', error);
        alert('Lỗi khi xóa dữ liệu');
    }
}

/**
 * Format timestamp
 */
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Vừa xong';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;

    return date.toLocaleDateString('vi-VN');
}

// Auto-refresh every 5 seconds
setInterval(() => {
    loadStatus();
    loadPendingFulfillments();
}, 5000);
