import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { App } from 'antd';
import { useAuth } from './AuthContext';
import {
    collection,
    query,
    where,
    onSnapshot,
    limit,
    orderBy
} from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Order } from '../types';

interface NotificationItem {
    id: string;
    readableId: string | number;
    title: string;
    status: string;
    type: 'task' | 'idea';
    timestamp: any;
    message: string;
}

interface NotificationContextType {
    notifications: NotificationItem[];
    unreadCount: number;
    markAsRead: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { appUser: user } = useAuth();
    const { notification } = App.useApp();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    // We use a ref to track "known" IDs to avoid notifying on initial load
    const knownIdsRef = useRef<Set<string>>(new Set());
    const isFirstLoadRef = useRef(true);

    useEffect(() => {
        if (!user) {
            setNotifications([]);
            return;
        }

        const role = user.role;
        const unsubscribers: (() => void)[] = [];

        // Helper to process snapshots
        const processSnapshot = (snapshot: any, type: 'task' | 'idea', alertMessage: string) => {
            const newItems: NotificationItem[] = [];

            snapshot.docs.forEach((doc: any) => {
                const data = doc.data() as Order;

                // Construct notification item
                const notif: NotificationItem = {
                    id: doc.id,
                    readableId: data.readableId,
                    title: data.title,
                    status: data.status,
                    type,
                    timestamp: data.updatedAt || data.created_at,
                    message: `${type === 'task' ? 'Đơn hàng' : 'Ý tưởng'} #${data.readableId}: ${alertMessage}`
                };

                newItems.push(notif);

                // Alert Logic (Skip if first load)
                if (!isFirstLoadRef.current && !knownIdsRef.current.has(doc.id)) {
                    // 1. In-App Notification (Antd)
                    notification.info({
                        message: 'Thông báo mới',
                        description: notif.message,
                        placement: 'bottomRight',
                        duration: 5,
                    });

                    // 2. System Notification (Browser Push)
                    if (Notification.permission === 'granted') {
                        try {
                            const systemNotif = new Notification(notif.title || 'Thông báo mới', {
                                body: notif.message,
                                icon: '/pwa-192x192.png',
                                tag: doc.id,
                            });

                            systemNotif.onclick = () => {
                                window.focus();
                                systemNotif.close();
                            };
                        } catch (e) {
                            console.error('System notification failed:', e);
                        }
                    } else if (Notification.permission !== 'denied') {
                        Notification.requestPermission();
                    }

                    // 3. Simple sound effect
                    try {
                        const audio = new Audio('/notification.mp3');
                        audio.play().catch(() => { });
                    } catch (e) { }
                }

                knownIdsRef.current.add(doc.id);
            });

            return newItems;
        };

        // REQUEST PERMISSION ON MOUNT
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }

        // --- DEFINE QUERIES BASED ON ROLE ---

        // 1. CS / IDEA / ADMIN (Creator) -> Listen for 'in_review'
        // Requirement: "CS/IDEA: Khi có file trạng thái in_review -> thông báo đến người tạo"
        if (['CS', 'IDEA', 'ADMIN'].includes(role)) {
            const qTasks = query(
                collection(db, 'tasks'),
                where('status', '==', 'in_review'),
                where('createdBy', '==', user.uid),
                orderBy('created_at', 'desc'),
                limit(20)
            );

            unsubscribers.push(onSnapshot(qTasks, (snap) => {
                const items = processSnapshot(snap, 'task', 'Đã chuyển sang In Review');
                updateNotifications('cs_tasks', items);
            }));

            const qIdeas = query(
                collection(db, 'ideas'),
                where('status', '==', 'in_review'),
                where('createdBy', '==', user.uid),
                orderBy('created_at', 'desc'),
                limit(20)
            );
            unsubscribers.push(onSnapshot(qIdeas, (snap) => {
                const items = processSnapshot(snap, 'idea', 'Đã chuyển sang In Review');
                updateNotifications('cs_ideas', items);
            }));
        }

        // 2. DS (Designer) -> Listen for 'need_fix'
        // Requirement: "DS: Khi có file trạng thái need_fix -> thông báo đến DS phân công"
        if (['DS', 'ADMIN'].includes(role)) {
            const qTasks = query(
                collection(db, 'tasks'),
                where('status', '==', 'need_fix'),
                where('designerId', '==', user.uid),
                orderBy('created_at', 'desc'),
                limit(20)
            );
            unsubscribers.push(onSnapshot(qTasks, (snap) => {
                const items = processSnapshot(snap, 'task', 'Yêu cầu sửa lại (Need Fix)');
                updateNotifications('ds_tasks', items);
            }));

            const qIdeas = query(
                collection(db, 'ideas'),
                where('status', '==', 'need_fix'),
                where('designerId', '==', user.uid),
                orderBy('created_at', 'desc'),
                limit(20)
            );
            unsubscribers.push(onSnapshot(qIdeas, (snap) => {
                const items = processSnapshot(snap, 'idea', 'Yêu cầu sửa lại (Need Fix)');
                updateNotifications('ds_ideas', items);
            }));
        }

        // 3. MANAGER (Admin / CS) -> Listen for 'check'
        // Requirement: "Manager: Khi có file cần Check -> thông báo Manager"
        if (['ADMIN', 'CS'].includes(role)) {
            const qTasks = query(
                collection(db, 'tasks'),
                where('status', '==', 'check'),
                orderBy('created_at', 'desc'),
                limit(20)
            );
            unsubscribers.push(onSnapshot(qTasks, (snap) => {
                const items = processSnapshot(snap, 'task', 'Cần kiểm tra (Check)');
                updateNotifications('manager_tasks', items);
            }));

            const qIdeas = query(
                collection(db, 'ideas'),
                where('status', '==', 'check'),
                orderBy('created_at', 'desc'),
                limit(20)
            );
            unsubscribers.push(onSnapshot(qIdeas, (snap) => {
                const items = processSnapshot(snap, 'idea', 'Cần kiểm tra (Check)');
                updateNotifications('manager_ideas', items);
            }));
        }

        // --- STATE MANAGEMENT ---
        const notifMap: Record<string, NotificationItem[]> = {};

        const updateNotifications = (key: string, items: NotificationItem[]) => {
            notifMap[key] = items;

            const allItems = Object.values(notifMap).flat();

            allItems.sort((a, b) => {
                const timeA = a.timestamp?.seconds || 0;
                const timeB = b.timestamp?.seconds || 0;
                return timeB - timeA;
            });

            setNotifications(allItems);
        };

        setTimeout(() => {
            isFirstLoadRef.current = false;
        }, 2000);

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };

    }, [user, notification]);

    const markAsRead = (_id: string) => {
        // Placeholder for mark as read
        console.log('Mark as read', _id);
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount: notifications.length, markAsRead }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within NotificationProvider');
    }
    return context;
};
