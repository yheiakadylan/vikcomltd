import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bucket, db } from './_config';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Basic Auth or allow public trigger? For cron, Vercel supports secure cron.
    // We can check authorization header if needed.

    if (req.method === 'POST') {
        const { orderId, prefix } = req.body;
        if (!orderId) return res.status(400).json({ error: 'Missing orderId' });

        try {
            if (!bucket || !db) {
                return res.status(500).json({ error: "Server Configuration Error: Firebase not initialized" });
            }
            console.log(`[CLEANUP] Cleaning up Order ${orderId}`);

            // 1. Determine Delete Prefix
            let deletePrefix = prefix;

            // If no prefix provided by client, try to guess from Firestore (Legacy support)
            if (!deletePrefix) {
                const orderDoc = await db.collection('tasks').doc(orderId).get();
                if (orderDoc.exists) {
                    const data = orderDoc.data();
                    // Only use storagePath
                    const path = data?.storagePath;
                    if (path) {
                        deletePrefix = path.startsWith('/') ? path.substring(1) : path;
                    }
                }
            }

            // 2. Delete Files
            if (deletePrefix) {
                // Ensure trailing slash to avoid partial matches on similar folders if any
                if (!deletePrefix.endsWith('/')) deletePrefix += '/';

                // Remove leading slash if present (Google Cloud Storage paths don't start with /)
                if (deletePrefix.startsWith('/')) deletePrefix = deletePrefix.substring(1);

                console.log(`[CLEANUP] Deleting files with prefix: ${deletePrefix}`);
                try {
                    const [files] = await bucket.getFiles({ prefix: deletePrefix });
                    // Parallel delete
                    await Promise.all(files.map((f: any) => f.delete()));
                    console.log(`[CLEANUP] Deleted ${files.length} files.`);
                } catch (e: any) {
                    console.warn(`[CLEANUP] Failed to delete files for prefix ${deletePrefix}:`, e.message);
                }
            }

            // 3. Mark as cleaned in Firestore (Optional, but good for tracking)
            // User requested NO auto-delete logic, but since we are deleting the task anyway (in the next step of deleteOrder),
            // updates here might be redundant if the doc is about to be deleted.
            // But deleteOrder client-side deletes the doc AFTER this call.
            // So we can update just in case deleteDoc fails? 
            // Or just skip update since doc will be deleted.

            // Let's Skip Update to save a write, since doc is deleted immediately after.

            return res.status(200).json({ success: true });
        } catch (error: any) {
            console.error('[CLEANUP] Error:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
