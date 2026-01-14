import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bucket, db, getDropboxClient } from './_config';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { firebasePath, dropboxPath, orderId, readableId, targetField } = req.body;

    if (!firebasePath || !dropboxPath || !orderId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        console.log(`[SYNC] Starting sync for Order #${readableId || orderId}`);

        // 1. Download file from Firebase Storage
        if (!bucket) {
            throw new Error("Firebase Storage bucket not initialized (Check server logs/env vars)");
        }
        const file = bucket.file(firebasePath);
        const [exists] = await file.exists();
        if (!exists) {
            return res.status(404).json({ error: 'File not found in Firebase Storage' });
        }

        const [buffer] = await file.download();

        // 2. Upload to Dropbox
        // Fetch Tokens from Firestore if not in Env
        let dropboxToken = process.env.DROPBOX_ACCESS_TOKEN;
        let appKey = process.env.DROPBOX_APP_KEY;
        let appSecret = process.env.DROPBOX_APP_SECRET;
        let refreshToken = process.env.DROPBOX_REFRESH_TOKEN;

        if (!dropboxToken || !refreshToken) { // If any key is missing, check DB
            console.log("[SYNC] Authorization: Fetching Dropbox Config from Firestore...");
            const settingsDoc = await db.collection('settings').doc('system').get();
            if (settingsDoc.exists) {
                const data = settingsDoc.data();
                const dbxConfig = data?.dropbox || {};

                if (!dropboxToken) dropboxToken = dbxConfig.access_token || dbxConfig.accessToken || data.dropbox_token;
                if (!appKey) appKey = dbxConfig.app_key;
                if (!appSecret) appSecret = dbxConfig.app_secret;
                if (!refreshToken) refreshToken = dbxConfig.refresh_token;
            }
        }

        if (!dropboxToken) {
            throw new Error("Dropbox Access Token not found in Env or Firestore");
        }

        const dbx = getDropboxClient({
            accessToken: dropboxToken,
            clientId: appKey,
            clientSecret: appSecret,
            refreshToken: refreshToken
        });
        console.log(`[SYNC] Uploading to Dropbox: ${dropboxPath}`);

        const uploadResult = await dbx.filesUpload({
            path: dropboxPath,
            contents: buffer,
            mode: { '.tag': 'overwrite' } // overwrite if exists
        });

        // 3. Create Shared Link (Raw)
        let shareLink = '';
        try {
            const share = await dbx.sharingCreateSharedLinkWithSettings({
                path: uploadResult.result.path_display || dropboxPath
            });
            shareLink = share.result.url.replace('?dl=0', '?raw=1');
        } catch (e: any) {
            // Check for shared_link_already_exists error
            if (e.error?.['.tag'] === 'shared_link_already_exists' || e.error?.error?.['.tag'] === 'shared_link_already_exists') {
                // Fetch existing
                const links = await dbx.sharingListSharedLinks({ path: uploadResult.result.path_display || dropboxPath });
                if (links.result.links.length > 0) {
                    shareLink = links.result.links[0].url.replace('?dl=0', '?raw=1');
                }
            } else {
                console.warn("[SYNC] Warning: Could not create shared link, continuing...", e);
            }
        }

        // 4. Update Firestore with Dropbox URL
        const updateData: any = { dropboxReady: true };

        // Critical: Only update the main 'dropboxUrl' (Mockup Backup) if this sync was for the Mockup
        // or if the path explicitly indicates it's a mockup folder.
        // This prevents 'Customer Files' or other uploads from overwriting the main dashboard image backup.
        if (targetField === 'mockupUrl' || dropboxPath.includes('/Mockup/')) {
            updateData.dropboxUrl = shareLink;
        }

        await db.collection('tasks').doc(orderId).update(updateData);

        return res.status(200).json({ success: true, dropboxUrl: shareLink });
    } catch (error: any) {
        console.error('[SYNC] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
