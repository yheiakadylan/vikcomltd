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

        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                try {
                    // 1. Get Claims (Instant Role)
                    // Force refresh to ensure we get latest claims (e.g. after role update)
                    const tokenResult = await firebaseUser.getIdTokenResult(true);
                    const claims = tokenResult.claims;

                    // 2. Setup Realtime Listener for critical status (Ban/Active)
                    // We still listen to DB, but we can render faster if we assume claims are fresh enough?
                    // Actually, for "Pro" feel, we want instant access. 
                    // But if we return 'loading=false' before DB returns, 'appUser.isActive' might be undefined?

                    unsubscribeSnapshot = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap: any) => {
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            setAppUser({
                                uid: firebaseUser.uid,
                                email: firebaseUser.email || '',
                                displayName: firebaseUser.displayName || data.displayName || 'User',
                                photoURL: firebaseUser.photoURL,
                                ...data,
                                // Role priority: Claim > DB (Security) or DB > Claim (Realtime)?
                                // Usually Claim is source of truth for backend. DB is source for UI.
                                // Let's trust DB for UI to reflect changes immediately without re-login.
                                // BUT Custom Claims is requested.
                                role: (claims.role as any) || data.role || 'CS'
                            } as AppUser);
                        } else {
                            // Fallback if DB missing
                            setAppUser({
                                uid: firebaseUser.uid,
                                email: firebaseUser.email || '',
                                displayName: firebaseUser.displayName || 'User',
                                role: (claims.role as any) || 'CS',
                                isActive: true
                            });
                        }
                        setLoading(false);
                    }, (error: any) => {
                        console.warn("Profile sync error:", error);
                        setLoading(false);
                    });

                } catch (e) {
                    console.error("Auth Token Error", e);
                    setLoading(false);
                }
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
