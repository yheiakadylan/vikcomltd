import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // Authenticate Request
        const adminToken = req.headers.authorization?.replace('Bearer ', '');
        if (!adminToken) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }

        const decodedToken = await admin.auth().verifyIdToken(adminToken);
        const callerDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
        const callerRole = callerDoc.data()?.role;

        if (callerRole !== 'ADMIN') {
            return res.status(403).json({ error: 'Forbidden: Only admins allowed' });
        }

        switch (req.method) {
            case 'POST':
                return createUser(req, res);
            case 'GET':
                return getUsers(req, res);
            case 'PUT':
                return updateUser(req, res);
            case 'DELETE':
                return deleteUser(req, res);
            default:
                return res.status(405).json({ error: 'Method not allowed' });
        }

    } catch (error: any) {
        console.error("API Error:", error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}

// POST /api/users - Create new user
async function createUser(req: VercelRequest, res: VercelResponse) {
    const { email, password, displayName, role } = req.body;

    if (!email || !password || !displayName || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // 1. Create Firebase Auth user
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName,
        });

        // 2. Create Firestore user document
        await admin.firestore().collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email,
            displayName,
            role,
            isActive: true,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 3. Set custom claims for role
        await admin.auth().setCustomUserClaims(userRecord.uid, {
            role,
            isActive: true
        });

        return res.status(201).json({
            success: true,
            uid: userRecord.uid,
            message: `User ${email} created successfully`,
        });
    } catch (error: any) {
        if (error.code === 'auth/email-already-exists') {
            return res.status(400).json({ error: 'Email đã tồn tại' });
        }
        throw error;
    }
}

// GET /api/users - Get all users
async function getUsers(req: VercelRequest, res: VercelResponse) {
    const usersSnapshot = await admin.firestore().collection('users').get();
    const users = usersSnapshot.docs.map(doc => doc.data());
    return res.status(200).json({ users });
}

// PUT /api/users - Update user
async function updateUser(req: VercelRequest, res: VercelResponse) {
    const { uid, displayName, role, password, email } = req.body;

    if (!uid) return res.status(400).json({ error: 'Missing UID' });

    try {
        const updateData: any = {};
        if (displayName) updateData.displayName = displayName;
        if (role) updateData.role = role;
        if (email) updateData.email = email;

        // 1. Update Auth Profile (Password & Email, DisplayName)
        const authUpdates: any = {};
        if (password) authUpdates.password = password;
        if (email) authUpdates.email = email;
        if (displayName) authUpdates.displayName = displayName;

        if (Object.keys(authUpdates).length > 0) {
            await admin.auth().updateUser(uid, authUpdates);
        }

        // 2. Update Firestore
        if (Object.keys(updateData).length > 0) {
            await admin.firestore().collection('users').doc(uid).update(updateData);
        }

        // 3. Update Claims if role changed
        if (role) {
            const userRecord = await admin.auth().getUser(uid);
            await admin.auth().setCustomUserClaims(uid, {
                ...(userRecord.customClaims || {}),
                role
            });
        }

        return res.status(200).json({ success: true, message: 'Updated successfully' });
    } catch (error: any) {
        throw error;
    }
}

// DELETE /api/users?uid=... - Delete user
async function deleteUser(req: VercelRequest, res: VercelResponse) {
    const { uid } = req.query;

    if (!uid || typeof uid !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid UID' });
    }

    try {
        // 1. Delete from Auth
        await admin.auth().deleteUser(uid);

        // 2. Delete from Firestore
        await admin.firestore().collection('users').doc(uid).delete();

        return res.status(200).json({ success: true, message: 'Deleted successfully' });
    } catch (error: any) {
        throw error;
    }
}
