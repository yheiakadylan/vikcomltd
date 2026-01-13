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

export const listDropboxFolders = async (path: string = '') => {
    const dbx = await getDbxClient();
    const response = await dbx.filesListFolder({ path });
    return response;
};

export const getDropboxThumbnail = async (path: string) => {
    const dbx = await getDbxClient();
    const response = await dbx.filesGetThumbnail({
        path,
        format: { '.tag': 'jpeg' },
        size: { '.tag': 'w128h128' }
    });

    return response.result;
};

export const getDropboxAccountInfo = async () => {
    try {
        const dbx = await getDbxClient();
        const response = await dbx.usersGetCurrentAccount();
        return response.result;
    } catch (error) {
        console.error('Error fetching Dropbox account info:', error);
        return null;
    }
};

export const checkDropboxConnection = async () => {
    const accessToken = localStorage.getItem('dropbox_access_token');
    const refreshToken = localStorage.getItem('dropbox_refresh_token');
    return !!(accessToken || refreshToken);
};

export const getDbxClient = async () => {
    const accessToken = localStorage.getItem('dropbox_access_token');
    const refreshToken = localStorage.getItem('dropbox_refresh_token');
    const expiresAt = localStorage.getItem('dropbox_expires_at');

    if (!accessToken && !refreshToken) {
        throw new Error("Dropbox chưa kết nối. Vui lòng vào Admin panel → Connect Dropbox.");
    }

    const dbxAuth = getDbxAuth();

    // Check if token expired or will expire soon (within 5 minutes)
    const expiryThreshold = Date.now() + (5 * 60 * 1000); // 5 minutes buffer
    const isExpired = expiresAt && parseInt(expiresAt) < expiryThreshold;

    if (isExpired && refreshToken) {
        try {
            console.log('🔄 Refreshing Dropbox token...');
            dbxAuth.setRefreshToken(refreshToken);

            const response = await dbxAuth.refreshAccessToken() as any;
            console.log('📥 Refresh response:', response);

            if (response?.result?.access_token) {
                const newAccess = response.result.access_token;
                const newExpiresIn = response.result.expires_in || 14400;
                const newRefresh = response.result.refresh_token;

                localStorage.setItem('dropbox_access_token', newAccess);
                localStorage.setItem('dropbox_expires_at', (Date.now() + (newExpiresIn * 1000)).toString());

                if (newRefresh) {
                    localStorage.setItem('dropbox_refresh_token', newRefresh);
                }

                // Sync to Firestore for global persistence
                await saveSystemSettings({
                    dropbox: {
                        access_token: newAccess,
                        refresh_token: newRefresh || refreshToken,
                        expires_at: Date.now() + (newExpiresIn * 1000)
                    }
                }).catch(err => console.error("Failed to sync refreshed token to Firestore:", err));

                dbxAuth.setAccessToken(newAccess);
                console.log('✅ Token refreshed successfully');
            } else {
                console.error('⚠️ Refresh returned unexpected format');
                localStorage.removeItem('dropbox_access_token');
                localStorage.removeItem('dropbox_refresh_token');
                localStorage.removeItem('dropbox_expires_at');
                throw new Error("Token refresh thất bại. Vui lòng vào Admin panel → Reconnect Dropbox.");
            }
        } catch (error: any) {
            console.error('❌ Refresh failed:', error);
            localStorage.removeItem('dropbox_access_token');
            localStorage.removeItem('dropbox_refresh_token');
            localStorage.removeItem('dropbox_expires_at');
            throw new Error(`Dropbox token hết hạn. Vui lòng vào Admin panel → Reconnect Dropbox. (${error.message})`);
        }
    } else {
        if (accessToken) {
            dbxAuth.setAccessToken(accessToken);
        } else {
            throw new Error("Không có Dropbox token hợp lệ. Vui lòng vào Admin panel → Connect Dropbox.");
        }
    }

    return new Dropbox({ auth: dbxAuth });
};

export const uploadFileToDropbox = async (file: File, path: string) => {
    try {
        const dbx = await getDbxClient();

        const response = await dbx.filesUpload({
            path,
            contents: file,
            mode: { '.tag': 'overwrite' }
        });

        const sharedLinkResponse = await dbx.sharingCreateSharedLinkWithSettings({
            path: response.result.path_display || path,
            settings: {
                requested_visibility: { '.tag': 'public' }
            }
        }).catch(async (err) => {
            if (err.status === 409) {
                const links = await dbx.sharingListSharedLinks({ path: response.result.path_display || path });
                if (links.result.links.length > 0) {
                    return { result: links.result.links[0] };
                }
            }
            throw err;
        });

        return { url: sharedLinkResponse.result.url.replace('?dl=0', '?raw=1') };
    } catch (error: any) {
        console.error('Dropbox Upload Error:', error);

        if (error.status === 401 || error.message?.includes('401') || error.message?.includes('Unauthorized')) {
            throw new Error('🔐 Dropbox token hết hạn. Vui lòng vào Admin panel → Reconnect Dropbox → Thử lại.');
        }

        throw new Error(error.message || 'Dropbox upload failed');
    }
};
