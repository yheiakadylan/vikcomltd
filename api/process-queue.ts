import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bucket, db, getDropboxClient } from './_config';

const CHUNK_SIZE = 4 * 1024 * 1024;

interface ProcessQueueBody {
    queueId: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { queueId } = req.body as ProcessQueueBody;
    if (!queueId) return res.status(400).json({ error: 'Missing queueId' });

    try {
        // 1. Get task from queue
        const queueDoc = await db.collection('sync_queue').doc(queueId).get();
        if (!queueDoc.exists) {
            return res.status(404).json({ error: 'Queue task not found' });
        }

        const task = queueDoc.data();
        if (task?.status === 'success') {
            return res.json({ message: 'Already synced' });
        }

        // Mark as processing
        await queueDoc.ref.update({ status: 'processing', updatedAt: new Date() });

        console.log(`[QUEUE] Processing: ${queueId}`);

        // 2. Check Firebase file
        if (!bucket) throw new Error("Firebase Storage not initialized");

        const file = bucket.file(task.firebasePath);
        const [exists] = await file.exists();
        if (!exists) {
            await queueDoc.ref.update({
                status: 'error',
                errorLog: 'File not found in Firebase Storage',
                updatedAt: new Date()
            });
            return res.status(404).json({ error: 'File not found in Firebase' });
        }

        // 3. Get Dropbox credentials
        let dropboxToken = process.env.DROPBOX_ACCESS_TOKEN;
        let appKey = process.env.DROPBOX_APP_KEY;
        let appSecret = process.env.DROPBOX_APP_SECRET;
        let refreshToken = process.env.DROPBOX_REFRESH_TOKEN;

        if (!dropboxToken || !refreshToken) {
            const settingsDoc = await db.collection('settings').doc('system').get();
            if (settingsDoc.exists) {
                const data = settingsDoc.data();
                const dbxConfig = data?.dropbox || {};
                dropboxToken = dropboxToken || dbxConfig.access_token || dbxConfig.accessToken;
                appKey = appKey || dbxConfig.app_key;
                appSecret = appSecret || dbxConfig.app_secret;
                refreshToken = refreshToken || dbxConfig.refresh_token;
            }
        }

        if (!dropboxToken) throw new Error("Dropbox Token not found");

        const dbx = getDropboxClient({ accessToken: dropboxToken, clientId: appKey, clientSecret: appSecret, refreshToken: refreshToken });

        // 4. Stream upload to Dropbox
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
            await dbx.filesUpload({ path: task.dropboxPath, contents: buffer, mode: { '.tag': 'overwrite' } });
        } else {
            await dbx.filesUploadSessionFinish({ cursor: { session_id: sessionId, offset }, commit: { path: task.dropboxPath, mode: { '.tag': 'overwrite' }, mute: false }, contents: buffer });
        }

        // 5. Create shared link
        let shareLink = '';
        try {
            const share = await dbx.sharingCreateSharedLinkWithSettings({ path: task.dropboxPath });
            shareLink = share.result.url.replace('?dl=0', '?raw=1');
        } catch (e: any) {
            if (e.error?.['.tag'] === 'shared_link_already_exists' || e.error?.error?.['.tag'] === 'shared_link_already_exists') {
                const links = await dbx.sharingListSharedLinks({ path: task.dropboxPath });
                if (links.result.links.length > 0) shareLink = links.result.links[0].url.replace('?dl=0', '?raw=1');
            }
        }

        // 6. Update Firestore task
        const updateData: any = { dropboxReady: true };
        if (task.targetField === 'mockupUrl' || task.dropboxPath.includes('/Mockup/')) {
            updateData.dropboxUrl = shareLink;
        }
        await db.collection('tasks').doc(task.orderId).update(updateData);

        // 7. Delete queue task (no need to keep success records)
        await queueDoc.ref.delete();

        console.log(`[QUEUE] Success: ${queueId} - Task deleted from queue`);
        return res.status(200).json({ success: true, dropboxUrl: shareLink });

    } catch (error: any) {
        console.error('[QUEUE] Error:', error);

        // Handle rate limiting
        if (error?.status === 429) {
            const retryAfter = error.headers?.get?.('Retry-After') || 60;
            console.log(`[QUEUE] Rate limited. Retry after ${retryAfter}s`);
        }

        // Update queue with error
        try {
            const queueDoc = await db.collection('sync_queue').doc(queueId).get();
            if (queueDoc.exists) {
                await queueDoc.ref.update({
                    status: 'error',
                    retryCount: (queueDoc.data()?.retryCount || 0) + 1,
                    errorLog: error.message || 'Unknown error',
                    updatedAt: new Date()
                });
            }
        } catch (updateError) {
            console.error('[QUEUE] Failed to update error status:', updateError);
        }

        return res.status(500).json({ error: error.message, scheduledForRetry: true });
    }
}
