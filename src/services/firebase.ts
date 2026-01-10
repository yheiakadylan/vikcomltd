import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, updateDoc, collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import type { Order } from '../types';

const firebaseConfig = {
    apiKey: "AIzaSyCMfkDrGBzVa2ungr5iX8VDNpfdssw1RhA",
    authDomain: "servertest-25b17.firebaseapp.com",
    projectId: "servertest-25b17",
    storageBucket: "servertest-25b17.firebasestorage.app",
    messagingSenderId: "1056476786050",
    appId: "1:1056476786050:web:e60baea741d839de3ab39b"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { orderBy, where };

export const updateOrder = async (orderId: string, data: any) => {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, data);
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

export default app;
