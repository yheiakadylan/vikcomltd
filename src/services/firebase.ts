import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

export default app;
