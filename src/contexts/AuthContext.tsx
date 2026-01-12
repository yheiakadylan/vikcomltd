import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import type { AppUser } from '../types';

interface AuthContextType {
    user: User | null;
    appUser: AppUser | null;
    loading: boolean;
    signIn: (email: string, pass: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    appUser: null,
    loading: true,
    signIn: async () => { },
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [appUser, setAppUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeSnapshot: (() => void) | undefined;

        const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                // Real-time listener for user profile
                unsubscribeSnapshot = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap: any) => {
                    if (docSnap.exists()) {
                        setAppUser({ ...docSnap.data(), uid: firebaseUser.uid } as AppUser);
                    } else {
                        console.error('User document not found in Firestore');
                        // Fallback
                        setAppUser({
                            uid: firebaseUser.uid,
                            email: firebaseUser.email || '',
                            displayName: firebaseUser.displayName || 'Demo User',
                            role: 'CS',
                            avatar: firebaseUser.photoURL || undefined
                        });
                    }
                    setLoading(false);
                }, (error: any) => {
                    console.error("Error fetching user profile:", error);
                    setLoading(false);
                });
            } else {
                if (unsubscribeSnapshot) unsubscribeSnapshot();
                setAppUser(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeSnapshot) unsubscribeSnapshot();
        };
    }, []);

    const signIn = async (email: string, pass: string) => {
        await signInWithEmailAndPassword(auth, email, pass);
    };

    const logout = async () => {
        await signOut(auth);
    };

    return (
        <AuthContext.Provider value={{ user, appUser, loading, signIn, logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
