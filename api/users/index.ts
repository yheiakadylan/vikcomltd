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
    // Handle different HTTP methods
    switch (req.method) {
        case 'POST':
            return createUser(req, res);
        case 'GET':
            return getUsers(req, res);
        default:
            return res.status(405).json({ error: 'Method not allowed' });
    }
}

// POST /api/users - Create new user
async function createUser(req: VercelRequest, res: VercelResponse) {
    try {
        const { email, password, displayName, role, adminToken } = req.body;

        // Validate input
        if (!email || !password || !displayName || !role || !adminToken) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify admin token
        const decodedToken = await admin.auth().verifyIdToken(adminToken);

        // Check if caller is admin
        const callerDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
        const callerRole = callerDoc.data()?.role;

        if (callerRole !== 'ADMIN') {
            return res.status(403).json({ error: 'Only admins can create users' });
        }

        // 1. Create Firebase Auth user
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: displayName,
        });

        // 2. Create Firestore user document
        await admin.firestore().collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email: email,
            displayName: displayName,
            role: role,
            isActive: true,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 3. Set custom claims for role
        await admin.auth().setCustomUserClaims(userRecord.uid, { role });

        return res.status(201).json({
            success: true,
            uid: userRecord.uid,
            message: `User ${email} created successfully`,
        });
    } catch (error: any) {
        console.error('Error creating user:', error);

        if (error.code === 'auth/email-already-exists') {
            return res.status(400).json({ error: 'Email đã tồn tại trong hệ thống' });
        }

        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}

// GET /api/users - Get all users (for admin)
async function getUsers(req: VercelRequest, res: VercelResponse) {
    try {
        const adminToken = req.headers.authorization?.replace('Bearer ', '');

        if (!adminToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify admin token
        const decodedToken = await admin.auth().verifyIdToken(adminToken);
        const callerDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
        const callerRole = callerDoc.data()?.role;

        if (callerRole !== 'ADMIN') {
            return res.status(403).json({ error: 'Only admins can view users' });
        }

        // Get all users from Firestore
        const usersSnapshot = await admin.firestore().collection('users').get();
        const users = usersSnapshot.docs.map(doc => doc.data());

        return res.status(200).json({ users });
    } catch (error: any) {
        console.error('Error fetching users:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
