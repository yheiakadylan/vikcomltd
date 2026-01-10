import { Dropbox, DropboxAuth } from 'dropbox';

const CLIENT_ID = import.meta.env.VITE_DROPBOX_APP_KEY;

// Initialize DropboxAuth
const getDbxAuth = () => {
    return new DropboxAuth({
        clientId: CLIENT_ID,
    });
};

export const getDropboxAuthUrl = async () => {
    const dbxAuth = getDbxAuth();
    // PKCE flow for Refresh Token ('offline' access)
    // redirectUri must match what's in Dropbox Console exactly
    const redirectUri = window.location.origin + '/auth/dropbox/callback';

    // Generates a code_verifier and saves it to sessionStorage automatically by SDK default behavior if implicit? 
    // Wait, getAuthenticationUrl writes to sessionStorage? Yes, if using PKCE.
    const authUrl = await dbxAuth.getAuthenticationUrl(
        redirectUri,
        undefined,
        'code',
        'offline',
        undefined,
        undefined,
        true // usePKCE
    );

    // Explicitly save PKCE verifier
    const verifier = (dbxAuth as any).codeVerifier;
    if (verifier) {
        window.localStorage.setItem('minph_dropbox_verifier', verifier);
    }

    return authUrl;
};

export const handleDropboxCallback = async (code: string) => {
    const dbxAuth = getDbxAuth();
    const redirectUri = window.location.origin + '/auth/dropbox/callback';

    // Recovery for PKCE: Retrieve verifier stored by getAuthenticationUrl
    const storedVerifier = window.localStorage.getItem('minph_dropbox_verifier');
    if (storedVerifier) {
        dbxAuth.setCodeVerifier(storedVerifier);
    }

    // Exchange code for tokens (PKCE)
    const response = await dbxAuth.getAccessTokenFromCode(redirectUri, code);

    const { access_token, refresh_token, expires_in } = response.result as any;

    if (access_token) localStorage.setItem('dropbox_access_token', access_token);
    if (refresh_token) localStorage.setItem('dropbox_refresh_token', refresh_token);
    if (expires_in) {
        const expiresAt = Date.now() + (expires_in * 1000);
        localStorage.setItem('dropbox_expires_at', expiresAt.toString());
    }

    return response.result;
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
        throw new Error("Dropbox not connected");
    }

    const dbxAuth = getDbxAuth();

    // Check if token expired
    if (expiresAt && Date.now() > parseInt(expiresAt) && refreshToken) {
        // Refresh token
        dbxAuth.setRefreshToken(refreshToken);
        const response = await dbxAuth.refreshAccessToken() as any;

        const newAccess = response.result.access_token;
        const newExpiresIn = response.result.expires_in;

        localStorage.setItem('dropbox_access_token', newAccess);
        localStorage.setItem('dropbox_expires_at', (Date.now() + (newExpiresIn * 1000)).toString());

        dbxAuth.setAccessToken(newAccess);
    } else {
        dbxAuth.setAccessToken(accessToken || '');
    }

    return new Dropbox({ auth: dbxAuth });
};

export const getDropboxAccountInfo = async () => {
    try {
        const dbx = await getDbxClient();
        const response = await dbx.usersGetCurrentAccount();
        return response.result;
    } catch (error) {
        console.error("Error fetching account info:", error);
        return null;
    }
};

export const uploadFileToDropbox = async (file: File, path: string) => {
    try {
        const dbx = await getDbxClient();

        // 1. Upload File
        const response = await dbx.filesUpload({
            path: path, // Full path e.g. /Orders/123/img.png
            contents: file,
            mode: { '.tag': 'overwrite' }
        });

        // 2. Create Shared Link (for viewing)
        // Access via result.path_display
        const filePath = response.result.path_display;
        if (!filePath) throw new Error("Upload failed, no path returned");

        // Try getting existing shared link or create new
        try {
            const linkResponse = await dbx.sharingCreateSharedLinkWithSettings({
                path: filePath
            });
            return linkResponse.result; // contains .url
        } catch (linkError: any) {
            // Check if link already exists
            if (linkError?.error?.['.tag'] === 'shared_link_already_exists') {
                const existingLink = await dbx.sharingListSharedLinks({
                    path: filePath,
                    direct_only: true
                });
                return existingLink.result.links[0];
            }
            throw linkError;
        }

    } catch (error) {
        console.error("Dropbox Upload Error:", error);
        throw error;
    }
};
