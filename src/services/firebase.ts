import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, updateDoc, collection, query, orderBy, onSnapshot, where, getDocs, setDoc, getDoc } from 'firebase/firestore';
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


export const updateOrder = async (orderId: string, data: any) => {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, data);
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

export const subscribeToOrders = (onData: (orders: Order[]) => void, onError?: (error: any) => void, constraints: any[] = []) => {
    const q = query(
        collection(db, 'orders'),
        orderBy('created_at', 'desc'),
        ...constraints
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Order[];
        onData(orders);
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
