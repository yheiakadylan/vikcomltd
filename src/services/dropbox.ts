import { Dropbox, DropboxAuth } from 'dropbox';
import { saveSystemSettings } from './firebase';

const DROPBOX_CLIENT_ID = import.meta.env.VITE_DROPBOX_APP_KEY || '';
const REDIRECT_URI = `${window.location.origin}/auth/callback`;

const getDbxAuth = () => {
    const dbxAuth = new DropboxAuth({
        clientId: DROPBOX_CLIENT_ID,
        fetch: fetch.bind(window)
    });
    return dbxAuth;
};

export const initiateDropboxOAuth = async () => {
    const dbxAuth = getDbxAuth();
    const authUrl = await dbxAuth.getAuthenticationUrl(
        REDIRECT_URI,
        undefined,
        'code',
        'offline', // offline for refresh token
        undefined,
        undefined,
        true // PKCE enabled
    );

    // Save code verifier for PKCE flow
    const codeVerifier = dbxAuth.getCodeVerifier();
    if (codeVerifier) {
        sessionStorage.setItem('dropboxCodeVerifier', codeVerifier);
    }

    window.location.href = String(authUrl);
};

export const handleDropboxCallback = async (code: string) => {
    const dbxAuth = getDbxAuth();
    dbxAuth.setCodeVerifier(sessionStorage.getItem('dropboxCodeVerifier') || '');

    try {
        const response = await dbxAuth.getAccessTokenFromCode(REDIRECT_URI, code) as any;
        const accessToken = response.result.access_token;
        const refreshToken = response.result.refresh_token;
        const expiresIn = response.result.expires_in;

        localStorage.setItem('dropbox_access_token', accessToken);
        if (refreshToken) {
            localStorage.setItem('dropbox_refresh_token', refreshToken);
        }
        localStorage.setItem('dropbox_expires_at', (Date.now() + (expiresIn * 1000)).toString());

        return response.result;
    } catch (error) {
        console.error('Dropbox Token Exchange Error:', error);
        throw error;
    }
};

// Singleton promise to handle concurrent refreshes
let refreshPromise: Promise<string> | null = null;

export const refreshDropboxToken = async (): Promise<string> => {
    const refreshToken = localStorage.getItem('dropbox_refresh_token');

    if (!refreshToken) {
        throw new Error("No refresh token available");
    }

    if (refreshPromise) {
        console.log('⏳ Waiting for existing token refresh...');
        return refreshPromise;
    }

    refreshPromise = (async () => {
        try {
            console.log('🔄 Refreshing Dropbox token (Manual Fetch)...');

            if (!DROPBOX_CLIENT_ID) {
                throw new Error("Missing DROPBOX_CLIENT_ID");
            }

            const body = new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: DROPBOX_CLIENT_ID
            });

            const response = await fetch('https://api.dropbox.com/oauth2/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body
            });

            const data = await response.json();
            console.log('📥 Refresh response status:', response.status);

            if (!response.ok) {
                console.error('❌ Refresh response error body:', data);
                // "invalid_grant" means token revoked/expired
                throw new Error(data.error_description || data.error || `Refresh failed with status ${response.status}`);
            }

            if (data.access_token) {
                const newAccess = data.access_token;
                const newExpiresIn = data.expires_in || 14400;
                const newRefresh = data.refresh_token;

                localStorage.setItem('dropbox_access_token', newAccess);
                localStorage.setItem('dropbox_expires_at', (Date.now() + (newExpiresIn * 1000)).toString());

                if (newRefresh) {
                    localStorage.setItem('dropbox_refresh_token', newRefresh);
                }

                // Sync to Firestore
                await saveSystemSettings({
                    dropbox: {
                        access_token: newAccess,
                        refresh_token: newRefresh || refreshToken,
                        expires_at: Date.now() + (newExpiresIn * 1000)
                    }
                }).catch(err => console.error("Failed to sync refreshed token to Firestore:", err));

                console.log('✅ Token refreshed successfully');
                return newAccess;
            } else {
                throw new Error("Refresh response missing access_token");
            }
        } catch (error: any) {
            console.error('❌ Refresh failed:', error);
            const errMsg = error.message || '';
            if (errMsg.includes('invalid_grant') || errMsg.includes('revoked')) {
                localStorage.removeItem('dropbox_access_token');
                localStorage.removeItem('dropbox_refresh_token');
                localStorage.removeItem('dropbox_expires_at');
            }
            throw error;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
};

export const getDbxClient = async () => {
    let accessToken = localStorage.getItem('dropbox_access_token');
    const refreshToken = localStorage.getItem('dropbox_refresh_token');
    const expiresAt = localStorage.getItem('dropbox_expires_at');

    if (!accessToken && !refreshToken) {
        throw new Error("Dropbox chưa kết nối. Vui lòng vào Admin panel → Connect Dropbox.");
    }

    const dbxAuth = getDbxAuth();

    // Check expiry buffer (5 minutes)
    const expiryThreshold = Date.now() + (5 * 60 * 1000);
    const isExpired = expiresAt && parseInt(expiresAt) < expiryThreshold;

    if (isExpired && refreshToken) {
        try {
            accessToken = await refreshDropboxToken();
        } catch (error) {
            console.error("Auto-refresh failed inside getDbxClient, continuing with potentially stale token if available:", error);
            // If refresh failed, we might still try the old access token if it exists, 
            // but it will likely fail 401. 
            // If we don't have access token, we throw.
            if (!accessToken) throw error;
        }
    }

    if (accessToken) {
        dbxAuth.setAccessToken(accessToken);
    } else {
        throw new Error("Không có Dropbox token hợp lệ.");
    }

    return new Dropbox({ auth: dbxAuth });
};

// Generic retry wrapper for 401s
const withRetry = async <T>(operation: (client: Dropbox) => Promise<T>): Promise<T> => {
    try {
        const client = await getDbxClient();
        return await operation(client);
    } catch (error: any) {
        // Check for 401 Unauthorized
        if (error?.status === 401 || error?.error?.error?.['.tag'] === 'expired_access_token') {
            console.warn("⚠️ Received 401 from Dropbox, attempting force refresh...");
            try {
                // Force refresh
                await refreshDropboxToken();
                // Retry with new client
                const newClient = await getDbxClient();
                return await operation(newClient);
            } catch (refreshError) {
                console.error("Double failure: Refresh failed or retry failed", refreshError);
                throw error; // Throw original or new error? Usually original is clearer if refresh failed.
            }
        }
        throw error;
    }
};

export const getDropboxAccountInfo = async () => {
    try {
        return await withRetry(async (dbx) => {
            const response = await dbx.usersGetCurrentAccount();
            return response.result;
        });
    } catch (error) {
        console.error('Error fetching Dropbox account info:', error);
        return null; // Return null on error so UI can handle gracefully
    }
};

export const uploadFileToDropbox = async (file: File, path: string) => {
    try {
        const res = await withRetry(async (dbx) => {
            // Wrap upload in a timeout
            const UPLOAD_TIMEOUT = 120000; // 2 minutes
            const uploadPromise = dbx.filesUpload({
                path,
                contents: file,
                mode: { '.tag': 'overwrite' }
            });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), UPLOAD_TIMEOUT)
            );

            const response = await Promise.race([uploadPromise, timeoutPromise]) as any;

            // Generate shared link
            const sharedLinkResponse = await dbx.sharingCreateSharedLinkWithSettings({
                path: response.result.path_display || path,
                settings: {
                    requested_visibility: { '.tag': 'public' }
                }
            }).catch(async (err) => {
                if (err.status === 409) { // Link already exists
                    const links = await dbx.sharingListSharedLinks({ path: response.result.path_display || path });
                    if (links.result.links.length > 0) {
                        return { result: links.result.links[0] };
                    }
                }
                throw err;
            });

            return { url: sharedLinkResponse.result.url.replace('?dl=0', '?raw=1') };
        });

        return res;

    } catch (error: any) {
        console.error('Dropbox Upload Error:', error);

        if (error.status === 401 || error.message?.includes('401') || error.message?.includes('Unauthorized')) {
            throw new Error('🔐 Dropbox token hết hạn và không thể làm mới. Vui lòng vào Admin panel kết nối lại.');
        }

        if (error.message === 'REQUEST_TIMEOUT') {
            throw new Error('⏱️ Upload quá lâu (Timeout). Vui lòng kiểm tra mạng và thử lại.');
        }

        throw new Error(error.message || 'Dropbox upload failed');
    }
};

export const listDropboxFolders = async (path: string = '') => {
    return await withRetry(async (dbx) => {
        const response = await dbx.filesListFolder({ path });
        return response;
    });
};

export const getDropboxThumbnail = async (path: string) => {
    try {
        return await withRetry(async (dbx) => {
            const response = await dbx.filesGetThumbnail({
                path,
                format: { '.tag': 'jpeg' },
                size: { '.tag': 'w128h128' }
            });
            return response.result;
        });
    } catch (error) {
        console.error("Thumbnail error", error);
        return null;
    }
};

export const checkDropboxConnection = async () => {
    const accessToken = localStorage.getItem('dropbox_access_token');
    const refreshToken = localStorage.getItem('dropbox_refresh_token');
    return !!(accessToken || refreshToken);
};
