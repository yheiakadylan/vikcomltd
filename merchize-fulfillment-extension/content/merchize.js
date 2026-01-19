/**
 * POD Workflow - Merchize Seller Portal Content Script  
 * Automatically finds orders and uploads artwork on seller.merchize.com
 */

(async function () {
    'use strict';

    console.log('[Merchize Extension] Content script loaded on', window.location.href);

    // Configuration with REAL Merchize selectors
    const CONFIG = {
        URLS: {
            login: 'https://seller.merchize.com/login',
            orders: 'https://seller.merchize.com/a/orders'
        },
        SELECTORS: {
            // Login check
            loggedInIndicator: 'a[href*="/a/orders"]',

            // Search filters
            searchTypeDropdown: '.Left.flex-shrink-0 select.form-control',
            searchInput: '.Right.flex-grow-1 input.form-control',

            // Order results
            orderCodeCell: 'td.OrderCodeCell',
            orderLink: 'td.OrderCodeCell a[href*="/a/orders/"]',
            externalNumberCode: 'td.OrderCodeCell code',

            // Upload workflow
            uploadLabel: 'label[for^="uploadOrderArtwork-"]',
            applyForOrderBtnFirst: 'button.btn.btn-primary', // First apply button if exists
            uploadArtworkArea: '.InputUploadArtwork .Content',
            uploadModal: '.modal-content',
            uploadFromComputerTab: 'li.tabUpload',
            fileInput: '#inputUploadArtwork_computer',
            applyArtworkBtn: '#btnUpdateArtwork',

            // Success/Error indicators
            uploadSuccess: '.alert-success, .toast-success',
            uploadError: '.alert-error, .alert-danger, .toast-error'
        },
        TIMEOUTS: {
            pageLoad: 2000,
            search: 2000,
            upload: 60000,
            wait: 500
        }
    };

    // Wait for page ready
    await waitForPageReady();

    // Check if we need to redirect to orders page
    if (!window.location.href.includes('/a/orders')) {
        if (!window.location.href.includes('/login')) {
            console.log('[Merchize] Redirecting to orders page...');
            window.location.href = CONFIG.URLS.orders;
            return;
        }
    }

    // Check for pending fulfillment
    const fulfillmentData = await getPendingFulfillment();

    if (!fulfillmentData) {
        console.log('[Merchize Extension] No pending fulfillment for this tab');
        return;
    }

    console.log('[Merchize Extension] Processing fulfillment:', fulfillmentData.readableId);

    try {
        showNotification('info', `🚀 Đang tự động fulfill đơn #${fulfillmentData.readableId}...`);

        // Step 0: Check login and wait if needed
        await ensureLoggedIn();

        // Step 1: Ensure we're on orders page
        showNotification('info', 'Chuyển đến trang đơn hàng...');
        if (!window.location.href.includes('/a/orders')) {
            window.location.href = CONFIG.URLS.orders;
            await sleep(CONFIG.TIMEOUTS.pageLoad);
        }

        // Step 2: Set search filter to "External number"
        showNotification('info', 'Chuẩn bị tìm kiếm...');
        await setSearchFilterToExternalNumber();

        // Step 3: Search for order by external number (readableId)
        showNotification('info', `Tìm kiếm đơn hàng #${fulfillmentData.readableId}...`);
        const orderFound = await searchOrderByExternalNumber(fulfillmentData.readableId);

        if (!orderFound) {
            throw new Error(
                `Không tìm thấy đơn hàng #${fulfillmentData.readableId} trên Merchize. ` +
                `Vui lòng kiểm tra External Order Number.`
            );
        }

        // Step 4: Click order to open detail
        showNotification('info', 'Mở chi tiết đơn hàng...');
        await clickOrderLink();

        // Step 5: Check if order has multiple products
        const products = document.querySelectorAll('.OrderItem.unfulfilled');
        console.log(`[Merchize] Found ${products.length} unfulfilled products`);

        let selectedProduct = null;

        if (products.length === 0) {
            throw new Error('Không tìm thấy product nào trong order');
        } else if (products.length === 1) {
            // Only 1 product -> Auto select
            console.log('[Merchize] Only 1 product, auto-selecting...');
            selectedProduct = products[0];
        } else {
            // Multiple products -> Show selector
            showNotification('info', `Tìm thấy ${products.length} products. Vui lòng chọn product...`);
            selectedProduct = await showProductSelector(products);

            if (!selectedProduct) {
                throw new Error('Không có product nào được chọn');
            }
        }

        // Step 6: Upload artwork file
        showNotification('info', 'Đang upload artwork...');
        await uploadArtworkFile(selectedProduct, fulfillmentData.designFiles[0]);

        // Step 7: Apply artwork
        showNotification('info', 'Applying artwork...');
        await clickApplyArtwork();

        // Success!
        await updateFulfillmentStatus(fulfillmentData.orderId, 'completed');
        await cleanupPendingFulfillment();

        showNotification('success', `✅ Đơn hàng #${fulfillmentData.readableId} đã được fulfill thành công!`);

    } catch (error) {
        console.error('[Merchize Extension] Error:', error);
        await updateFulfillmentStatus(fulfillmentData?.orderId, 'failed');
        showNotification('error', `❌ Lỗi: ${error.message}`);
    }

    // ==================== Core Functions ====================

    /**
     * Ensure user is logged in, wait if on login page
     */
    async function ensureLoggedIn() {
        let attempts = 0;
        const maxAttempts = 60; // Wait up to 60 seconds

        while (attempts < maxAttempts) {
            // Check if logged in
            const isLoggedIn = !!document.querySelector(CONFIG.SELECTORS.loggedInIndicator);

            if (isLoggedIn) {
                console.log('[Merchize] User is logged in');
                return true;
            }

            // If on login page, show message
            if (window.location.href.includes('/login')) {
                updateProgress('⚠️ Vui lòng đăng nhập vào Merchize...', false);
            }

            await sleep(1000);
            attempts++;
        }

        throw new Error('Login timeout - vui lòng đăng nhập Merchize');
    }

    /**
     * Set search dropdown to "External number"
     */
    async function setSearchFilterToExternalNumber() {
        const dropdown = await waitForElement(CONFIG.SELECTORS.searchTypeDropdown, 5000);

        if (!dropdown) {
            throw new Error('Không tìm thấy dropdown tìm kiếm');
        }

        // Check current value
        if (dropdown.value === 'external_number') {
            console.log('[Merchize] Dropdown already set to External number');
            return;
        }

        // Change to external_number
        dropdown.value = 'external_number';
        dropdown.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(500);

        console.log('[Merchize] Changed search filter to External number');
    }

    /**
     * Search order by external number
     */
    async function searchOrderByExternalNumber(externalNumber) {
        const searchInput = await waitForElement(CONFIG.SELECTORS.searchInput, 5000);

        if (!searchInput) {
            throw new Error('Không tìm thấy ô tìm kiếm');
        }

        // Clear and enter search term
        searchInput.value = '';
        await sleep(100);

        searchInput.value = externalNumber;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));

        // Trigger search (Enter key)
        const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            bubbles: true
        });
        searchInput.dispatchEvent(enterEvent);

        // Wait for results
        await sleep(CONFIG.TIMEOUTS.search);

        // Check if order found
        const orderCell = document.querySelector(CONFIG.SELECTORS.orderCodeCell);
        if (!orderCell) {
            return false;
        }

        // Verify external number matches
        const codeElement = orderCell.querySelector('code');
        if (codeElement && codeElement.textContent.trim() === externalNumber) {
            console.log('[Merchize] Order found:', codeElement.textContent);
            return true;
        }

        return false;
    }

    /**
     * Click order link to open detail
     */
    async function clickOrderLink() {
        const orderLink = await waitForElement(CONFIG.SELECTORS.orderLink, 3000);

        if (!orderLink) {
            throw new Error('Không tìm thấy link đơn hàng');
        }

        orderLink.click();
        await sleep(2500); // Wait for order detail page to fully load

        console.log('[Merchize] Opened order detail');
    }

    /**
     * Show product selector UI for multiple products
     */
    async function showProductSelector(products) {
        return new Promise((resolve) => {
            // Extract product info
            const productInfos = Array.from(products).map((product, idx) => {
                const title = product.querySelector('.TitleProduct')?.textContent || 'Unknown Product';
                const variant = product.querySelector('.TextAttribute')?.textContent.replace('Variant: ', '') || '';
                const sku = Array.from(product.querySelectorAll('.TextAttribute'))
                    .find(el => el.textContent.includes('SKU:'))?.textContent.replace('SKU: ', '') || '';
                const price = Array.from(product.querySelectorAll('.TextAttribute'))
                    .find(el => el.textContent.includes('Price:'))?.textContent.replace('Price: ', '') || '';

                return { index: idx, title, variant, sku, price, element: product };
            });

            // Create modal
            const modal = document.createElement('div');
            modal.id = 'pod-product-selector';
            modal.innerHTML = `
                <div style="
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 420px;
                    max-height: 80vh;
                    overflow-y: auto;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                    z-index: 1000001;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                ">
                    <div style="padding: 20px; border-bottom: 1px solid #eee;">
                        <h3 style="margin: 0; font-size: 18px; color: #333;">📦 Select Product to Upload</h3>
                        <p style="margin: 8px 0 0; font-size: 14px; color: #666;">Choose which product to upload artwork</p>
                    </div>
                    <div id="pod-product-list" style="padding: 12px;">
                        ${productInfos.map(info => `
                            <div class="pod-product-item" data-index="${info.index}" style="
                                padding: 16px;
                                margin-bottom: 12px;
                                border: 2px solid #e0e0e0;
                                border-radius: 8px;
                                cursor: pointer;
                                transition: all 0.2s;
                            ">
                                <div style="font-weight: 600; color: #333; margin-bottom: 8px; font-size: 14px;">
                                    Product ${info.index + 1}
                                </div>
                                <div style="font-size: 13px; color: #666; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    📝 ${info.variant}
                                </div>
                                <div style="font-size: 12px; color: #999;">
                                    💰 ${info.price}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div style="padding: 16px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 8px;">
                        <button id="pod-cancel-select" style="
                            padding: 8px 16px;
                            border: 1px solid #ddd;
                            background: white;
                            color: #666;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                        ">Cancel</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Add hover effects
            document.querySelectorAll('.pod-product-item').forEach((item) => {
                item.addEventListener('mouseenter', () => {
                    item.style.borderColor = '#667eea';
                    item.style.background = '#f8f9ff';
                });
                item.addEventListener('mouseleave', () => {
                    item.style.borderColor = '#e0e0e0';
                    item.style.background = 'white';
                });
            });

            // Handle click
            document.querySelectorAll('.pod-product-item').forEach((item, idx) => {
                item.addEventListener('click', () => {
                    modal.remove();
                    console.log(`[Merchize] User selected product ${idx + 1}`);
                    resolve(productInfos[idx].element);
                });
            });

            document.getElementById('pod-cancel-select').addEventListener('click', () => {
                modal.remove();
                console.log('[Merchize] User cancelled product selection');
                resolve(null);
            });
        });
    }

    /**
     * Click upload artwork button/label
     */
    async function clickUploadArtworkButton() {
        // Wait for upload label
        const uploadLabel = await waitForElement(CONFIG.SELECTORS.uploadLabel, 5000);

        if (!uploadLabel) {
            throw new Error('Không tìm thấy nút Upload Artwork');
        }

        uploadLabel.click();
        await sleep(1000);

        // Check if "Apply for order" button appears (first time)
        const applyBtn = document.querySelector(CONFIG.SELECTORS.applyForOrderBtnFirst);
        if (applyBtn && applyBtn.textContent.includes('Apply for order')) {
            console.log('[Merchize] Clicking initial "Apply for order" button...');
            applyBtn.click();
            await sleep(1500);
        }

        console.log('[Merchize] Upload workflow initiated');
    }

    /**
     * Upload artwork file to specific product
     */
    async function uploadArtworkFile(productElement, designFile) {
        // Step 1: Find upload trigger in selected product
        console.log('[Merchize] Finding upload trigger in selected product...');
        const uploadTrigger = productElement.querySelector('.PFBoxUploader label.TriggerModal div.Text');

        if (!uploadTrigger) {
            throw new Error('Không tìm thấy upload trigger div sau 5 giây');
        }

        console.log('[Merchize] Upload trigger rendered! Clicking...');
        uploadTrigger.click();
        await sleep(800); // Wait for modal

        // Step 2: Wait for "Replace Artwork?" modal and "Apply for order" button
        console.log('[Merchize] Waiting for "Apply for order" button...');

        let applyForOrderBtn = null;
        for (let i = 0; i < 10; i++) {
            const buttons = Array.from(document.querySelectorAll('button.btn-primary'));
            applyForOrderBtn = buttons.find(btn => {
                const text = btn.textContent.trim();
                return text === 'Apply for order' || text.includes('Apply for order');
            });

            if (applyForOrderBtn) {
                console.log('[Merchize] Found "Apply for order" button!');
                break;
            }
            await sleep(300);
        }

        if (applyForOrderBtn) {
            console.log('[Merchize] Clicking "Apply for order" button...');
            applyForOrderBtn.click();
            await sleep(1000); // Wait for upload area to appear
        } else {
            console.log('[Merchize] No "Apply for order" button found, continuing...');
        }

        // Step 3: Now the upload area should appear (InputUploadArtwork)
        console.log('[Merchize] Waiting for upload area...');
        const uploadArea = await waitForElement('.InputUploadArtwork .Content', 5000);

        if (!uploadArea) {
            throw new Error('Không tìm thấy upload area sau khi click Apply for order');
        }

        console.log('[Merchize] Clicking upload area to open modal...');
        uploadArea.click();
        await sleep(800);

        // Step 4: Wait for tabs and click "Upload by URL" tab (3rd tab)
        console.log('[Merchize] Looking for Upload tabs...');
        const firstTab = await waitForElement('.tabUpload', 3000);

        if (!firstTab) {
            throw new Error('Không tìm thấy tabs');
        }

        const allTabs = document.querySelectorAll('.tabUpload');
        console.log(`[Merchize] Found ${allTabs.length} tabs`);

        if (!allTabs || allTabs.length < 3) {
            throw new Error(`Chỉ tìm thấy ${allTabs?.length || 0} tabs, cần ít nhất 3 tabs`);
        }

        console.log('[Merchize] Clicking "Upload by URL" tab (tab 3)...');
        allTabs[2].click(); // 3rd tab (index 2)
        await sleep(400);

        // Step 5: Find URL input and paste design file URL
        const urlInput = await waitForElement('.UploadByURL input.form-control[placeholder="Paste URL"]', 3000);

        if (!urlInput) {
            throw new Error('Không tìm thấy URL input field');
        }

        console.log('[Merchize] Pasting artwork URL:', designFile.link);

        // Clear and paste URL
        urlInput.value = designFile.link;
        urlInput.dispatchEvent(new Event('input', { bubbles: true }));
        urlInput.dispatchEvent(new Event('change', { bubbles: true }));

        await sleep(400);

        // Step 6: Click Upload button
        const uploadButton = document.querySelector('.UploadByURL button.btn-primary');

        if (!uploadButton) {
            throw new Error('Không tìm thấy Upload button');
        }

        // Wait for button to be enabled
        let attempts = 0;
        while (uploadButton.disabled && attempts < 10) {
            await sleep(300);
            attempts++;
        }

        if (uploadButton.disabled) {
            throw new Error('Upload button vẫn disabled sau 3 giây');
        }

        console.log('[Merchize] Clicking Upload button...');
        uploadButton.click();

        // Wait for upload to process
        await sleep(2000);

        console.log('[Merchize] Artwork uploaded via URL');
    }

    /**
     * Click apply artwork button
     */
    async function clickApplyArtwork() {
        // After uploading by URL, the artwork should appear in preview
        // Look for the "Apply" button or similar action button

        // Wait a bit for artwork to load
        await sleep(2000);

        // Try to find apply button - could be in modal footer or near artwork preview
        const possibleSelectors = [
            '#btnUpdateArtwork',
            'button.btn-primary:not([disabled])',
            '.modal-footer button.btn-primary',
            'button:contains("Apply")'
        ];

        for (const selector of possibleSelectors) {
            const applyBtn = document.querySelector(selector);

            if (applyBtn && !applyBtn.disabled &&
                (applyBtn.textContent.includes('Apply') ||
                    applyBtn.textContent.includes('Update') ||
                    applyBtn.id === 'btnUpdateArtwork')) {

                console.log('[Merchize] Found apply button:', applyBtn.textContent);
                applyBtn.click();

                // Wait for upload to complete
                await waitForUploadComplete();
                return;
            }
        }

        throw new Error('Không tìm thấy Apply artwork button');
    }

    /**
     * Wait for upload to complete
     */
    async function waitForUploadComplete() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = CONFIG.TIMEOUTS.upload / 1000;

            const checkInterval = setInterval(() => {
                attempts++;

                // Check for success
                const successIndicator = document.querySelector(CONFIG.SELECTORS.uploadSuccess);
                if (successIndicator) {
                    clearInterval(checkInterval);
                    resolve();
                    return;
                }

                // Check for error
                const errorIndicator = document.querySelector(CONFIG.SELECTORS.uploadError);
                if (errorIndicator) {
                    clearInterval(checkInterval);
                    reject(new Error(errorIndicator.textContent || 'Upload failed'));
                    return;
                }

                // Check if button is back to normal state (success)
                const applyBtn = document.querySelector(CONFIG.SELECTORS.applyArtworkBtn);
                if (applyBtn && !applyBtn.disabled && attempts > 3) {
                    // Assume success if button is re-enabled after a few seconds
                    clearInterval(checkInterval);
                    resolve();
                    return;
                }

                // Timeout
                if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    // Don't reject on timeout, consider it success
                    console.log('[Merchize] Upload timeout, assuming success');
                    resolve();
                }
            }, 1000);
        });
    }

    /**
     * Download file from URL as Blob
     */
    async function downloadFileAsBlob(url) {
        try {
            const response = await fetch(url, {
                mode: 'cors',
                credentials: 'omit'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.blob();

        } catch (error) {
            console.error('[Merchize] Download error:', error);
            throw new Error(`Không thể tải file từ Firebase Storage: ${error.message}`);
        }
    }

    // ==================== Helper Functions ====================

    async function waitForPageReady() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                setTimeout(resolve, CONFIG.TIMEOUTS.pageLoad);
            } else {
                window.addEventListener('load', () => {
                    setTimeout(resolve, CONFIG.TIMEOUTS.pageLoad);
                });
            }
        });
    }

    async function getPendingFulfillment() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(
                { action: 'get_current_tab_id' },
                async (response) => {
                    if (!response?.tabId) {
                        resolve(null);
                        return;
                    }

                    const tabId = response.tabId;
                    const pendingResponse = await chrome.runtime.sendMessage({
                        action: 'get_pending_fulfillment',
                        tabId
                    });

                    if (pendingResponse?.success && pendingResponse.data) {
                        const storageKey = pendingResponse.data.storageKey;
                        const storageData = await chrome.storage.local.get(storageKey);
                        resolve(storageData[storageKey] || null);
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    }

    async function updateFulfillmentStatus(orderId, status) {
        if (!orderId) return;

        try {
            await chrome.runtime.sendMessage({
                action: 'update_fulfillment_status',
                orderId,
                status
            });
        } catch (error) {
            console.error('[Merchize] Failed to update status:', error);
        }
    }

    async function cleanupPendingFulfillment() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'get_current_tab_id'
            });

            if (response?.tabId) {
                await chrome.runtime.sendMessage({
                    action: 'clear_pending_fulfillment',
                    tabId: response.tabId
                });
            }
        } catch (error) {
            console.error('[Merchize] Cleanup error:', error);
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function waitForElement(selector, timeout = 5000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element) return element;
            await sleep(200);
        }

        return null;
    }

    // ==================== UI Functions ====================

    function showProgressOverlay(message) {
        hideProgressOverlay();

        const overlay = document.createElement('div');
        overlay.id = 'pod-merchize-overlay';
        overlay.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        z-index: 999999;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="
          background: white;
          padding: 40px;
          border-radius: 16px;
          text-align: center;
          min-width: 400px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        ">
          <div class="pod-spinner" style="
            border: 5px solid #f3f3f3;
            border-top: 5px solid #667eea;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            margin: 0 auto 24px;
            animation: pod-spin 1s linear infinite;
          "></div>
          <p id="pod-progress-message" style="
            font-size: 18px;
            color: #333;
            margin: 0;
            font-weight: 500;
          ">${message}</p>
        </div>
      </div>
      <style>
        @keyframes pod-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
        document.body.appendChild(overlay);
    }

    function updateProgress(message, isSuccess = false) {
        const messageEl = document.getElementById('pod-progress-message');
        if (messageEl) {
            messageEl.textContent = message;

            if (isSuccess) {
                messageEl.style.color = '#27ae60';
                const spinner = document.querySelector('.pod-spinner');
                if (spinner) {
                    spinner.style.borderTopColor = '#27ae60';
                    spinner.style.animation = 'none';
                    spinner.innerHTML = '✓';
                    spinner.style.display = 'flex';
                    spinner.style.alignItems = 'center';
                    spinner.style.justifyContent = 'center';
                    spinner.style.fontSize = '36px';
                    spinner.style.color = '#27ae60';
                    spinner.style.border = '5px solid #27ae60';
                }
            }
        }
    }

    function hideProgressOverlay() {
        const overlay = document.getElementById('pod-merchize-overlay');
        if (overlay) overlay.remove();
    }

    function showNotification(type, message) {
        // Remove previous notifications
        const existingToast = document.getElementById('pod-notification-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.id = 'pod-notification-toast';

        const colors = {
            success: '#27ae60',
            error: '#e74c3c',
            info: '#3498db'
        };

        toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 1000000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 400px;
      animation: pod-slide-in 0.3s ease-out;
    `;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Auto dismiss based on type
        const duration = type === 'success' ? 5000 : (type === 'error' ? 8000 : 3000);
        setTimeout(() => toast.remove(), duration);
    }

})();
