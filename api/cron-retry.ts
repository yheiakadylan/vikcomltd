import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, bucket, getDropboxClient } from './_config';

const MAX_RETRY = 5;
const BATCH_SIZE = 10; // Process 10 tasks at a time to avoid rate limits

export default async function handler(req: VercelRequest, res: VercelResponse) {
    console.log('[CRON] Starting retry job...');

    try {
        // Find pending/error tasks that haven't exceeded retry limit
        const snapshot = await db.collection('sync_queue')
            .where('status', 'in', ['pending', 'error'])
            .where('retryCount', '<', MAX_RETRY)
            .orderBy('retryCount', 'asc') // Prioritize tasks with fewer retries
            .orderBy('createdAt', 'asc') // Oldest first
            .limit(BATCH_SIZE)
            .get();

        if (snapshot.empty) {
            console.log('[CRON] Queue is empty');
            return res.json({ message: 'No pending tasks', processed: 0 });
        }

        console.log(`[CRON] Found ${snapshot.docs.length} tasks to process`);

        const results: any[] = [];

        // Process sequentially to avoid overwhelming Dropbox
        for (const doc of snapshot.docs) {
            const task = doc.data();
            console.log(`[CRON] Processing task ${doc.id} (retry: ${task.retryCount})`);

            try {
                await processSyncTask(doc.id, task);
                results.push({ id: doc.id, status: 'success' });
            } catch (error: any) {
                console.error(`[CRON] Failed task ${doc.id}:`, error.message);
                results.push({ id: doc.id, status: 'error', error: error.message });
            }

            // Small delay between tasks to be nice to Dropbox API
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log('[CRON] Batch complete');
        return res.json({
            processed: snapshot.docs.length,
            results
        });

    } catch (error: any) {
        console.error('[CRON] Job failed:', error);
        return res.status(500).json({ error: error.message });
    }
}

// Core sync logic (extracted for reuse)
async function processSyncTask(queueId: string, task: any) {
    const CHUNK_SIZE = 4 * 1024 * 1024;

    // Mark as processing
    await db.collection('sync_queue').doc(queueId).update({
        status: 'processing',
        updatedAt: new Date()
    });

    // Check Firebase file
    if (!bucket) throw new Error("Firebase Storage not initialized");

    const file = bucket.file(task.firebasePath);
    const [exists] = await file.exists();
    if (!exists) {
        await db.collection('sync_queue').doc(queueId).update({
            status: 'error',
            errorLog: 'File not found in Firebase Storage',
            retryCount: task.retryCount + 1,
            updatedAt: new Date()
        });
        throw new Error('File not found in Firebase');
    }

    // Get Dropbox credentials
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

    const dbx = getDropboxClient({
        accessToken: dropboxToken,
        clientId: appKey,
        clientSecret: appSecret,
        refreshToken: refreshToken
    });

    // Stream upload
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
                await dbx.filesUploadSessionAppendV2({
                    cursor: { session_id: sessionId, offset },
                    close: false,
                    contents: buffer
                });
            }
            offset += buffer.length;
            buffer = Buffer.alloc(0);
        }
    }

    if (!sessionId) {
        await dbx.filesUpload({
            path: task.dropboxPath,
            contents: buffer,
            mode: { '.tag': 'overwrite' }
        });
    } else {
        await dbx.filesUploadSessionFinish({
            cursor: { session_id: sessionId, offset },
            commit: {
                path: task.dropboxPath,
                mode: { '.tag': 'overwrite' },
                mute: false
            },
            contents: buffer
        });
    }

    // Create shared link
    let shareLink = '';
    try {
        const share = await dbx.sharingCreateSharedLinkWithSettings({ path: task.dropboxPath });
        shareLink = share.result.url.replace('?dl=0', '?raw=1');
    } catch (e: any) {
        if (e.error?.['.tag'] === 'shared_link_already_exists' || e.error?.error?.['.tag'] === 'shared_link_already_exists') {
            const links = await dbx.sharingListSharedLinks({ path: task.dropboxPath });
            if (links.result.links.length > 0) {
                shareLink = links.result.links[0].url.replace('?dl=0', '?raw=1');
            }
        }
    }

    // Update Firestore task
    const updateData: any = { dropboxReady: true };
    if (task.targetField === 'mockupUrl' || task.dropboxPath.includes('/Mockup/')) {
        updateData.dropboxUrl = shareLink;
    }
    await db.collection('tasks').doc(task.orderId).update(updateData);

    // Delete queue task (no need to keep success records)
    await db.collection('sync_queue').doc(queueId).delete();

    console.log(`[CRON] Task ${queueId} synced successfully - Deleted from queue`);
}
