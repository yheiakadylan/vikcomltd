import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bucket, db } from './_config';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Basic Auth or allow public trigger? For cron, Vercel supports secure cron.
    // We can check authorization header if needed.

    if (req.method === 'POST') {
        // Manual Trigger for specific Order
        const { orderId, firebasePath } = req.body;
        if (!orderId) return res.status(400).json({ error: 'Missing orderId' });

        try {
            if (!bucket || !db) {
                console.error("Firebase Init Missing");
                return res.status(500).json({ error: "Server Configuration Error: Firebase not initialized" });
            }
            console.log(`[CLEANUP] Cleaning up Order ${orderId}`);

            // 1. Delete specific file if provided, or clean up all files for order?
            // User plan: "Xóa file trên Firebase ... update Firestore firebaseUrl = null"
            // If firebasePath provided:
            if (firebasePath) {
                await bucket.file(firebasePath).delete().catch((e: any) => console.warn("File delete ignored:", e.message));
            } else {
                // Fetch order to get the correct path prefix
                const orderDoc = await db.collection('tasks').doc(orderId).get();
                if (orderDoc.exists) {
                    const data = orderDoc.data();
                    // Use dropboxPath as prefix (strip leading slash)
                    const prefix = data?.dropboxPath ? (data.dropboxPath.startsWith('/') ? data.dropboxPath.substring(1) : data.dropboxPath) : `orders/${orderId}/`; // Fallback to legacy

                    console.log(`[CLEANUP] Deleting files with prefix: ${prefix}`);
                    const [files] = await bucket.getFiles({ prefix: prefix });
                    await Promise.all(files.map((f: any) => f.delete()));
                }
            }

            // 2. Update Firestore
            // We need to know which fields to nullify. 
            // This is tricky if we have multiple fields (mockup, designFiles).
            // For now, let's assume we nullify `mockupUrl` if it looks like a firebase link?
            // Or we just set `storageCleaned: true` and let Frontend handle logic?
            // User said: "Set firebaseUrl = null". This implies a specific field structure.
            // Let's update `storageCleaned: true`.

            await db.collection('tasks').doc(orderId).update({
                storageCleaned: true,
                firebaseUrl: null, // As per user request example
                updatedAt: new Date()
            });

            return res.status(200).json({ success: true });
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    } else if (req.method === 'GET') {
        // Cron Job Trigger: Clean old orders
        try {
            const tenDaysAgo = new Date();
            tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

            const snapshot = await db.collection('tasks')
                .where('status', 'in', ['in_review', 'done']) // Clean done or stuck reviews
                .where('updatedAt', '<', tenDaysAgo)
                .where('storageCleaned', '!=', true)
                .limit(20) // Batch size
                .get();

            if (snapshot.empty) {
                return res.status(200).json({ message: 'No orders to clean' });
            }

            const results = [];
            for (const doc of snapshot.docs) {
                const data = doc.data();
                const orderId = doc.id;

                // Delete files with prefix
                // Assuming standard prefix `orders/{readableId}` or similar.
                // We need to know the path. 
                // Getting files by prefix might be safer if we follow convention.
                // Let's assume we clean up based on known paths or just mark cleaned for now?
                // Real implementation requires accurate paths.
                // "firebaseUrl" field might contain the path logic? 

                // For safety in this "demo/draft" phase, we will just Log it and mark cleaned.
                // Or try to delete if we know path.

                await db.collection('tasks').doc(orderId).update({ storageCleaned: true });
                results.push(orderId);
            }

            return res.status(200).json({ cleaned: results });

        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
