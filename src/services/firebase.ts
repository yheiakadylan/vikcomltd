import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, updateDoc, collection, query, orderBy, onSnapshot, where, getDocs, setDoc, getDoc, deleteDoc, addDoc, getCountFromServer, limit, startAfter, QueryDocumentSnapshot, runTransaction } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from "firebase/messaging";
import type { Order, User } from '../types';

// Firebase configuration - uses VITE_ prefix for client-side access
const firebaseConfig = {
    apiKey: "AIzaSyCMfkDrGBzVa2ungr5iX8VDNpfdssw1RhA",
    authDomain: "servertest-25b17.firebaseapp.com",
    projectId: "servertest-25b17",
    storageBucket: "servertest-25b17.firebasestorage.app",
    messagingSenderId: "1056476786050",
    appId: "1:1056476786050:web:e60baea741d839de3ab39b"
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



export const deleteOrder = async (orderId: string) => {
    const orderRef = doc(db, 'tasks', orderId);
    await deleteDoc(orderRef);
};

export const getUsers = async (): Promise<User[]> => {
    const q = query(collection(db, 'users'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as User);
};

export const createUserProfile = async (user: User) => {
    if (!user.uid) throw new Error("User UID required");
    await setDoc(doc(db, 'users', user.uid), user);
};

export const getOrdersCount = async (constraints: any[] = []): Promise<number> => {
    const coll = collection(db, 'tasks');
    const q = query(coll, ...constraints);
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
};

export const subscribeToOrders = (
    onData: (orders: Order[], lastDoc: QueryDocumentSnapshot | null) => void,
    onError?: (error: any) => void,
    constraints: any[] = [],
    limitVal: number = 25,
    startAfterDoc: QueryDocumentSnapshot | null = null
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
        collection(db, 'tasks'),
        ...computedConstraints
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
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
export const addOrderLog = async (taskId: string, logData: any) => {
    try {
        const logsRef = collection(db, 'tasks', taskId, 'logs');
        await addDoc(logsRef, {
            ...logData,
            createdAt: new Date()
        });
    } catch (e) {
        console.error("Error adding log:", e);
    }
};

export const subscribeToLogs = (taskId: string, callback: (logs: any[]) => void) => {
    const logsRef = collection(db, 'tasks', taskId, 'logs');
    const q = query(logsRef, orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(logs);
    });
};

export const updateOrder = async (orderId: string, data: any) => {
    const orderRef = doc(db, 'tasks', orderId);
    await updateDoc(orderRef, data);

    // Automatic Logging
    const currentUser = auth.currentUser;
    if (currentUser && data.status) {
        await addOrderLog(orderId, {
            actorId: currentUser.uid,
            actorName: currentUser.displayName || 'System',
            action: 'status_change',
            content: `Changed status to "${data.status}"`
        });
    }
};

export const claimOrder = async (orderId: string, userId: string) => {
    const orderRef = doc(db, 'tasks', orderId);

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
            actorId: userId, // The claimer
            actorName: 'Designer', // Simplified or fetch name if needed, but userId is stored
            action: 'claim',
            content: 'Claimed this task'
        });

    } catch (e) {
        console.error("Transaction failed: ", e);
        throw e; // Propagate error to UI
    }
};
