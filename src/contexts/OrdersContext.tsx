import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { subscribeToOrders } from '../services/firebase'; // Ensure this path is correct
import type { Order } from '../types';

interface ViewState {
    data: Order[];
    loading: boolean;
    error: any;
    lastDoc: any;
    total?: number; // Optional total count if needed
    unsubscribe?: () => void;
    timestamp: number; // Last updated timestamp
}

interface OrdersContextType {
    views: Record<string, ViewState>;
    registerView: (key: string, constraints: any[], collectionName: string, activePageSize?: number, startAfterDoc?: any) => void;
    unregisterView: (key: string) => void;
    // Helper to check if a view is "fresh" enough or exists
    isViewActive: (key: string) => boolean;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export const OrdersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // We use a ref for subscriptions to avoid re-renders when just storing functions
    // But we need State for Data to trigger UI updates.
    const [views, setViews] = useState<Record<string, ViewState>>({});

    // Keep track of unsubscribe functions separately to avoid circular JSON issues or strict mode double-invocations
    const unsubscibersRef = useRef<Record<string, () => void>>({});

    // Register (Subscribe) to a View
    const registerView = useCallback((key: string, constraints: any[], collectionName: string, activePageSize: number = 25, startAfterDoc: any = null) => {

        // If we already have an active subscription for this EXACT key
        // We could double check if constraints changed, but we assume the KEY embodies the constraints.
        // e.g. Key = "fulfill_new_page1"
        if (unsubscibersRef.current[key]) {
            // Already active, do nothing. Data is flowing.
            return;
        }

        console.log(`[OrdersContext] 🔌 Subscribing to view: ${key}`);

        // Set initial loading state
        setViews(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || {}), // Keep old data if exists (stale-while-revalidate)? Or clear?
                // For a new subscription, we might want to show loading
                loading: true,
                error: null,
                data: prev[key]?.data || [], // Optimistic keep
                timestamp: Date.now()
            }
        }));

        const unsubscribe = subscribeToOrders(
            (newOrders, lastDoc) => {
                setViews(prev => ({
                    ...prev,
                    [key]: {
                        data: newOrders,
                        lastDoc,
                        loading: false,
                        error: null,
                        timestamp: Date.now()
                    }
                }));
            },
            (error) => {
                console.error(`[OrdersContext] Error in view ${key}:`, error);
                setViews(prev => ({
                    ...prev,
                    [key]: {
                        ...(prev[key] || {}),
                        loading: false,
                        error,
                        data: [],
                        timestamp: Date.now()
                    }
                }));
            },
            constraints,
            activePageSize,
            startAfterDoc,
            collectionName
        );

        unsubscibersRef.current[key] = unsubscribe;
    }, []);

    const unregisterView = useCallback((key: string) => {
        if (unsubscibersRef.current[key]) {
            console.log(`[OrdersContext] 🔌 Unsubscribing view: ${key}`);
            unsubscibersRef.current[key]();
            delete unsubscibersRef.current[key];

            // Optional: Clear data from state to save RAM? 
            // Or keep it for "Back/Forward" cache?
            // Let's keep it in state, but mark as "inactive" implicitely by lack of sub?
            // No, getting rid of it fully is safer for memory leak in long run.
            // But for "Smart Cache", we WANT to keep it.
            // But unregister usually means "I really don't need this anymore".
            // Let's NOT clear data immediately here, allows for "fast back".
            // But we do need a way to clean up eventually.
        }
    }, []);

    const isViewActive = useCallback((key: string) => {
        return !!unsubscibersRef.current[key];
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            Object.values(unsubscibersRef.current).forEach(unsub => unsub());
            unsubscibersRef.current = {};
        };
    }, []);

    return (
        <OrdersContext.Provider value={{ views, registerView, unregisterView, isViewActive }}>
            {children}
        </OrdersContext.Provider>
    );
};

export const useOrders = () => {
    const context = useContext(OrdersContext);
    if (!context) {
        throw new Error('useOrders must be used within an OrdersProvider');
    }
    return context;
};
