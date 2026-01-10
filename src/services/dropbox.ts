import { Dropbox, DropboxAuth } from 'dropbox';

const APP_KEY = import.meta.env.VITE_DROPBOX_APP_KEY;
// Note: App Secret is rarely used in client-side only apps due to security, 
// but we prepare the config. For implicit/PKCE, usually just ClientId (App Key) is needed.

let dbx: Dropbox | null = null;
let accessToken: string | null = localStorage.getItem('dropbox_access_token');

export const initializeDropbox = () => {
    if (accessToken) {
        dbx = new Dropbox({ accessToken });
    }
};

export const getAuthUrl = async () => {
    const dbxAuth = new DropboxAuth({ clientId: APP_KEY });
    // Using implicit flow for simplicity in this demo, or we could use PKCE
    // Redirect URI must be set in Dropbox App Console to match window.location.origin
    const authUrl = await dbxAuth.getAuthenticationUrl(window.location.origin + '/auth/dropbox/callback');
    return authUrl;
};

export const handleAuthCallback = () => {
    // Logic to parse URL hash to get token
    const hash = window.location.hash;
    if (hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get('access_token');
        if (token) {
            accessToken = token;
            localStorage.setItem('dropbox_access_token', token);
            dbx = new Dropbox({ accessToken });
            return true;
        }
    }
    return false;
};

export const uploadFileToDropbox = async (file: File, path: string) => {
    if (!dbx) {
        throw new Error("Dropbox not authenticated");
    }

    try {
        const response = await dbx.filesUpload({
            path: path + '/' + file.name,
            contents: file,
            mode: { '.tag': 'overwrite' }
        });
        return response.result;
    } catch (error) {
        console.error("Dropbox Upload Error:", error);
        throw error;
    }
};

export const isAuthenticated = () => !!accessToken;
