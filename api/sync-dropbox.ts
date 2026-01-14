import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bucket, db, getDropboxClient } from './_config';

const CHUNK_SIZE = 4 * 1024 * 1024;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { firebasePath, dropboxPath, orderId, readableId, targetField } = req.body;
    if (!firebasePath || !dropboxPath || !orderId) return res.status(400).json({ error: 'Missing required fields' });

    try {
        console.log(`[SYNC] Streaming Order #${readableId || orderId}`);

        if (!bucket) throw new Error("Firebase Storage bucket not initialized");
        const file = bucket.file(firebasePath);
        const [exists] = await file.exists();
        if (!exists) return res.status(404).json({ error: 'File not found' });

        // Dropbox Auth
        let dropboxToken = process.env.DROPBOX_ACCESS_TOKEN;
        let appKey = process.env.DROPBOX_APP_KEY;
        let appSecret = process.env.DROPBOX_APP_SECRET;
        let refreshToken = process.env.DROPBOX_REFRESH_TOKEN;

        if (!dropboxToken || !refreshToken) {
            const settingsDoc = await db.collection('settings').doc('system').get();
            if (settingsDoc.exists) {
                const data = settingsDoc.data();
                const dbxConfig = data?.dropbox || {};
                dropboxToken = dropboxToken || dbxConfig.access_token || dbxConfig.accessToken || data.dropbox_token;
                appKey = appKey || dbxConfig.app_key;
                appSecret = appSecret || dbxConfig.app_secret;
                refreshToken = refreshToken || dbxConfig.refresh_token;
            }
        }

        if (!dropboxToken) throw new Error("Dropbox Token not found");

        const dbx = getDropboxClient({ accessToken: dropboxToken, clientId: appKey, clientSecret: appSecret, refreshToken: refreshToken });

        // Streaming Upload
        let sessionId = '';
        let offset = 0;
        const readStream = file.createReadStream();
        let buffer = Buffer.alloc(0);

        for await (const chunk of readStream) {
            buffer = Buffer.concat([buffer, chunk]);
            if (buffer.length >= CHUNK_SIZE) {
                if (!sessionId) {
                    const start = await dbx.filesUploadSessionStart({ close: false, contents: buffer });
                    sessionId = start.result.session_id;
                } else {
                    await dbx.filesUploadSessionAppendV2({ cursor: { session_id: sessionId, offset }, close: false, contents: buffer });
                }
                offset += buffer.length;
                buffer = Buffer.alloc(0);
            }
        }

        if (!sessionId) {
            await dbx.filesUpload({ path: dropboxPath, contents: buffer, mode: { '.tag': 'overwrite' } });
        } else {
            await dbx.filesUploadSessionFinish({ cursor: { session_id: sessionId, offset }, commit: { path: dropboxPath, mode: { '.tag': 'overwrite' }, mute: false }, contents: buffer });
        }

        // Shared Link
        let shareLink = '';
        try {
            const share = await dbx.sharingCreateSharedLinkWithSettings({ path: dropboxPath });
            shareLink = share.result.url.replace('?dl=0', '?raw=1');
        } catch (e: any) {
            if (e.error?.['.tag'] === 'shared_link_already_exists' || e.error?.error?.['.tag'] === 'shared_link_already_exists') {
                const links = await dbx.sharingListSharedLinks({ path: dropboxPath });
                if (links.result.links.length > 0) shareLink = links.result.links[0].url.replace('?dl=0', '?raw=1');
            }
        }

        // Firestore Update
        const updateData: any = { dropboxReady: true };
        if (targetField === 'mockupUrl' || dropboxPath.includes('/Mockup/')) updateData.dropboxUrl = shareLink;
        await db.collection('tasks').doc(orderId).update(updateData);

        return res.status(200).json({ success: true, dropboxUrl: shareLink });

    } catch (error: any) {
        console.error('[SYNC] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
