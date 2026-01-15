import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

const initFirebase = () => {
    if (admin.apps.length) return;

    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY) {
        throw new Error("Missing Firebase Admin Environment Variables (FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY)");
    }

    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
        });
        console.log("Firebase Admin Initialized Successfully");
    } catch (error) {
        console.error('Firebase Admin Init Error:', error);
        throw error; // Re-throw to prevent usage of uninitialized app
    }
};

// Initialize immediately to fail fast or lazily?
// If we fail here, the module fails to load.
try {
    initFirebase();
} catch (e) {
    console.error("Warning: Firebase Init Failed at startup", e);
}

export const db = admin.apps.length ? admin.firestore() : null as any;
export const bucket = admin.apps.length ? admin.storage().bucket() : null as any;

