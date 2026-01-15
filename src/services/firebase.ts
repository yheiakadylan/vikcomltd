import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, updateDoc, collection, query, orderBy, onSnapshot, where, getDocs, setDoc, getDoc, deleteDoc, addDoc, getCountFromServer, limit, startAfter, QueryDocumentSnapshot, runTransaction, writeBatch } from 'firebase/firestore';

// ...

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getMessaging, isSupported } from "firebase/messaging";
import type { Order, User } from '../types';

// Firebase configuration - uses VITE_ prefix for client-side access
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};


const app = initializeApp(firebaseConfig);

export { app };
export const auth = getAuth(app);
auth.languageCode = 'en'; // Defaults to English
export const db = getFirestore(app);
export const storage = getStorage(app);

// HÀM QUAN TRỌNG: Khởi tạo messaging an toàn
export const getMessagingInstance = async () => {
    try {
        const supported = await isSupported();
        if (supported) {
            return getMessaging(app);
        }
        console.warn("Firebase Messaging is not supported in this browser.");
        return null;
    } catch (err) {
        console.error("Error checking messaging support:", err);
        return null;
    }
};

export { orderBy, where };

/**
 * Settings Management (System-wide)
 */
export const getSystemSettings = async () => {
    try {
        const docRef = doc(db, 'settings', 'system');
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data() : null;
    } catch (error) {
        console.error("Error getting system settings:", error);
        return null;
    }
};

export const saveSystemSettings = async (settings: any) => {
    const docRef = doc(db, 'settings', 'system');
    // merge: true so we don't overwrite other settings
    await setDoc(docRef, settings, { merge: true });
};



export const deleteOrder = async (orderId: string, storagePrefix?: string, collectionName: string = 'tasks') => {
    // 1. Clean up Storage files (hot storage only)
    // We call the server API to ensure it handles the prefixes correctly using server credentials or logic
    // But since we are client-side, we can just call the endpoint.
    try {
        await fetch('/api/cleanup-storage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: orderId, prefix: storagePrefix })
        });
    } catch (e) {
        console.warn("Storage cleanup failed (might be empty or network error), proceeding to delete doc:", e);
    }

    // 2. Delete Logs Subcollection (Firestore does not auto-delete subcollections)
    const logsRef = collection(db, collectionName, orderId, 'logs');
    const logsSnapshot = await getDocs(logsRef);

    // Check if there are logs to delete
    if (!logsSnapshot.empty) {
        const batch = writeBatch(db);
        logsSnapshot.docs.forEach((logDoc) => {
            batch.delete(logDoc.ref);
        });
        await batch.commit();
    }

    // 3. Delete Firestore Document
    const orderRef = doc(db, collectionName, orderId);
    await deleteDoc(orderRef);
};

export const getUsers = async (): Promise<User[]> => {
    const q = query(collection(db, 'users'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as User);
};

export const createUserProfile = async (user: User) => {
    console.log("Creating User Profile:", user);
    console.log("Current Auth User:", auth.currentUser?.uid, auth.currentUser?.email);
    if (!user.uid) throw new Error("User UID required");
    try {
        await setDoc(doc(db, 'users', user.uid), user);
        console.log("Create Profile Success");
    } catch (e) {
        console.error("Create Profile Failed:", e);
        throw e;
    }
};

export const getOrdersCount = async (constraints: any[] = [], collectionName: string = 'tasks'): Promise<number> => {
    const coll = collection(db, collectionName);
    const q = query(coll, ...constraints);
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
};

export const subscribeToOrders = (
    onData: (orders: Order[], lastDoc: QueryDocumentSnapshot | null) => void,
    onError?: (error: any) => void,
    constraints: any[] = [],
    limitVal: number = 25,
    startAfterDoc: QueryDocumentSnapshot | null = null,
    collectionName: string = 'tasks'
) => {
    // Construct Query constraints
    const computedConstraints = [
        orderBy('created_at', 'desc'),
        ...constraints
    ];

    if (startAfterDoc) {
        computedConstraints.push(startAfter(startAfterDoc));
    }

    // Always apply limit
    computedConstraints.push(limit(limitVal));

    const q = query(
        collection(db, collectionName),
        ...computedConstraints
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            collectionName
        })) as Order[];

        // Return the last document for pagination cursor
        const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

        onData(orders, lastDoc);
    }, (error) => {
        console.error("Error fetching realtime orders:", error);
        if (onError) onError(error);
    });

    return unsubscribe;
};

/**
 * Creates a new user using a secondary Firebase App to avoid logging out the current user.
 */
export const createSecondaryUser = async (email: string, pass: string) => {
    const secondaryApp = initializeApp(firebaseConfig, "Secondary");
    const secondaryAuth = getAuth(secondaryApp);

    try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
        // We must sign out immediately from the secondary app just in case, 
        // though deleting the app should handle it.
        await signOut(secondaryAuth);
        return userCredential.user.uid;
    } finally {
        await deleteApp(secondaryApp);
    }
};

export default app;

/**
 * Activity Logs
 */
export const addOrderLog = async (taskId: string, logData: any, collectionName: string = 'tasks') => {
    try {
        let finalDisplayName = logData.actorDisplayName || logData.actorName;

        // Lookup real display name if actorId is provided and we want to ensure accuracy
        if (logData.actorId && !logData.actorDisplayName) {
            try {
                // Try to get from Auth first if it matches current user (fastest)
                if (auth.currentUser && auth.currentUser.uid === logData.actorId && auth.currentUser.displayName) {
                    finalDisplayName = auth.currentUser.displayName;
                } else {
                    // Fetch from Firestore Users collection
                    const userDoc = await getDoc(doc(db, 'users', logData.actorId));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        finalDisplayName = userData.displayName || userData.email || finalDisplayName;
                    }
                }
            } catch (err) {
                console.warn("Failed to lookup actor display name:", err);
            }
        }

        const logsRef = collection(db, collectionName, taskId, 'logs');
        await addDoc(logsRef, {
            ...logData,
            actorDisplayName: finalDisplayName,
            conversationId: logData.conversationId || null, // Optional for grouping if needed later
            createdAt: new Date()
        });
    } catch (e) {
        console.error("Error adding log:", e);
    }
};

export const getOrderLogs = async (taskId: string, collectionName: string = 'tasks') => {
    const logsRef = collection(db, collectionName, taskId, 'logs');
    const q = query(logsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
};

export const updateOrder = async (orderId: string, data: any, skipAutoLog: boolean = false, collectionName: string = 'tasks') => {
    const orderRef = doc(db, collectionName, orderId);
    await updateDoc(orderRef, data);

    // Automatic Logging
    const currentUser = auth.currentUser;
    if (!skipAutoLog && currentUser && data.status) {
        await addOrderLog(orderId, {
            actorId: currentUser.uid,
            actorName: currentUser.displayName || 'System', // Fallback
            actorDisplayName: currentUser.displayName, // Explicitly pass if available
            action: 'status_change',
            actionType: 'status_change',
            actionLabel: `Changed status to ${data.status.toUpperCase()}`,
            content: `Changed status to "${data.status}"`
        }, collectionName);
    }
};

export const claimOrder = async (orderId: string, userId: string, collectionName: string = 'tasks') => {
    const orderRef = doc(db, collectionName, orderId);

    try {
        await runTransaction(db, async (transaction) => {
            const sfDoc = await transaction.get(orderRef);
            if (!sfDoc.exists()) {
                throw new Error("Task does not exist!");
            }

            const data = sfDoc.data();
            if (data.status !== 'new') {
                throw new Error("Task has already been claimed by someone else!");
            }

            transaction.update(orderRef, {
                status: 'doing',
                designerId: userId,
                updatedAt: new Date()
            });
        });

        // Log outside transaction (less critical)
        await addOrderLog(orderId, {
            actorId: userId,
            actorName: 'Designer',
            action: 'claim',
            actionType: 'claim',
            actionLabel: 'Claimed Task',
            content: 'Claimed this task'
        }, collectionName);

    } catch (e) {
        console.error("Transaction failed: ", e);
        throw e; // Propagate error to UI
    }
};

export const uploadFileToStorage = async (file: File, path: string) => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
};
// ...

export const checkOrderExists = async (readableId: string, collectionName: string = 'tasks'): Promise<boolean> => {
    try {
        const q = query(collection(db, collectionName), where('readableId', '==', readableId));
        const snapshot = await getCountFromServer(q);
        return snapshot.data().count > 0;
    } catch (error: any) {
        // If permission denied (e.g. checking against hidden 'check' status tasks), 
        // we assume it doesn't exist in our visible scope.
        if (error.code === 'permission-denied' || error.message?.includes('permission-denied')) {
            console.warn("Permission denied checking order existence (likely hidden status). Assuming unique.");
            return false;
        }
        console.error("Error checking order existence:", error);
        throw error;
    }
};
