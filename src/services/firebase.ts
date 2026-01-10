import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, updateDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
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

export const updateOrder = async (orderId: string, data: any) => {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, data);
};

export const subscribeToOrders = (callback: (orders: Order[]) => void) => {
    const q = query(
        collection(db, 'orders'),
        orderBy('created_at', 'desc') // Ensure field name matches creation. User snippet said 'createdAt', my NewTaskModal used 'created_at'.
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Order[];
        callback(orders);
    }, (error) => {
        console.error("Error fetching realtime orders:", error);
    });

    return unsubscribe;
};

export default app;
