/**
 * POD Workflow Content Script
 * Injected into POD webapp to enable communication with extension
 */

console.log('[POD Extension Bridge] Loading...');

// CRITICAL: Set flag in MULTIPLE places to ensure persistence
// 1. Window object (fast, but can be reset by React/navigation)
window.podExtensionInstalled = true;

// 2. localStorage (persists across navigation/re-renders)
try {
    localStorage.setItem('podExtensionInstalled', 'true');
} catch (e) {
    console.warn('[POD Extension Bridge] localStorage not available:', e);
}

// 3. Also set on window.top in case of iframes
try {
    if (window.top && window.top !== window) {
        window.top.podExtensionInstalled = true;
    }
} catch (e) {
    // Cross-origin iframe, ignore
}

console.log('[POD Extension Bridge] Flag set: window.podExtensionInstalled =', window.podExtensionInstalled);
console.log('[POD Extension Bridge] localStorage.podExtensionInstalled =', localStorage.getItem('podExtensionInstalled'));

// Check if Chrome Extension APIs are available
if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    console.error('[POD Extension Bridge] Chrome extension APIs not available!');
    console.error('[POD Extension Bridge] This usually means the extension was reloaded.');
    // Flag is still set so webapp knows extension exists, but communication won't work
} else {
    console.log('[POD Extension Bridge] Chrome APIs OK, Extension ID:', chrome.runtime.id);
}

// Listen for fulfill requests from webapp
window.addEventListener('POD_FULFILL_REQUEST', async (event) => {
    const { orderData } = event.detail;

    console.log('[POD Extension Bridge] Received fulfill request:', orderData);

    try {
        // Check if chrome.runtime is still available
        if (!chrome?.runtime?.sendMessage) {
            throw new Error('Chrome extension APIs not available. Try reloading the page after installing/reloading the extension.');
        }

        // Forward to background script
        const response = await chrome.runtime.sendMessage({
            action: 'fulfill_order',
            orderData
        });

        console.log('[POD Extension Bridge] Background response:', response);

        // Send response back to webapp
        window.dispatchEvent(new CustomEvent('POD_FULFILL_RESPONSE', {
            detail: { success: true, response }
        }));

    } catch (error) {
        console.error('[POD Extension Bridge] Error:', error);
        window.dispatchEvent(new CustomEvent('POD_FULFILL_RESPONSE', {
            detail: {
                success: false,
                error: error.message || 'Extension communication failed'
            }
        }));
    }
});

console.log('[POD Extension Bridge] Ready for fulfill requests');
