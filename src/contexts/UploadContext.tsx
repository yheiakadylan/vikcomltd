import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { UploadItem, UploadStatus } from '../types';
import { uploadFileToStorage } from '../services/firebase';
import { updateOrder } from '../services/firebase';
import { arrayUnion } from 'firebase/firestore';
import { notification } from 'antd';
import { useLanguage } from './LanguageContext';
import { translations } from '../utils/translations';

interface UploadContextType {
    queue: UploadItem[];
    enqueue: (files: File[], orderId: string, itemType: 'customerFiles' | 'designFiles' | 'mockupUrl', basePath: string, readableId?: string) => void;
    retry: (id: string) => void;
    cancel: (id: string) => void;
    clearCompleted: () => void;
    isUploading: boolean;
    registerCompletionAction: (orderId: string, action: 'auto_submit' | 'notify_creation') => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { language } = useLanguage();
    const [queue, setQueue] = useState<UploadItem[]>([]);
    const processingRef = useRef(false);
    const notifiedOrdersRef = useRef<Set<string>>(new Set());
    const completionActionsRef = useRef<Map<string, 'auto_submit' | 'notify_creation'>>(new Map());

    // Enqueue new files
    const enqueue = useCallback((files: File[], orderId: string, targetField: 'customerFiles' | 'designFiles' | 'mockupUrl', basePath: string, readableId?: string) => {
        const newItems: UploadItem[] = files.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            status: 'pending',
            progress: 0,
            orderId,
            readableId, // Assign readableId
            targetField,
            storagePath: `${basePath}/${file.name}`
        }));

        setQueue(prev => [...prev, ...newItems]);

        // If we are adding files to an order that was already notified as done, 
        // we should remove it from the notified set so it can trigger again.
        if (notifiedOrdersRef.current.has(orderId)) {
            notifiedOrdersRef.current.delete(orderId);
        }
    }, []);

    const updateItemStatus = (id: string, status: UploadStatus, progress: number = 0, error?: string, resultUrl?: string) => {
        setQueue(prev => prev.map(item =>
            item.id === id ? { ...item, status, progress, error, resultUrl } : item
        ));
    };

    const registerCompletionAction = useCallback((orderId: string, action: 'auto_submit' | 'notify_creation') => {
        completionActionsRef.current.set(orderId, action);
    }, []);

    // Check for Order Completion
    useEffect(() => {
        // ... (Completion logic remains the same)
        // Group by OrderId
        const orders = Array.from(new Set(queue.map(i => i.orderId)));

        orders.forEach(oid => {
            const items = queue.filter(i => i.orderId === oid);
            if (items.length === 0) return;

            const allSuccess = items.every(i => i.status === 'success');
            const hasPending = items.some(i => i.status === 'pending' || i.status === 'uploading' || i.status === 'retrying');

            if (allSuccess && !hasPending) {
                const action = completionActionsRef.current.get(oid);
                const readableId = items[0]?.readableId || oid; // Fallback to oid if readableId not available

                if (action === 'auto_submit') {
                    // Perform Auto Submit
                    updateOrder(oid, { status: 'in_review', updatedAt: new Date() })
                        .then(() => {
                            notification.success({
                                title: `${translations[language].notifications.uploadSuccess.message}${readableId}`,
                                description: translations[language].notifications.uploadSuccess.description,
                                placement: 'bottomRight',
                                duration: 5
                            });
                            completionActionsRef.current.delete(oid); // remove from auto submit
                        })
                        .catch(err => {
                            console.error("Auto Submit Failed", err);
                            notification.error({
                                title: `${translations[language].notifications.uploadError.message}${readableId}`,
                                description: translations[language].notifications.uploadError.description,
                                duration: 5
                            });
                        });
                    return; // Skip standard notification
                } else if (action === 'notify_creation') {
                    notification.success({
                        title: `${translations[language].notifications.createTaskSuccess.message}${readableId}`,
                        description: translations[language].notifications.createTaskSuccess.description,
                        placement: 'bottomRight',
                        duration: 5
                    });
                    completionActionsRef.current.delete(oid);
                    return;
                }

                if (!notifiedOrdersRef.current.has(oid)) {
                    // Standard Notification (No Action Button)
                    notification.success({
                        title: `${translations[language].notifications.uploadComplete.message}${readableId}`,
                        description: translations[language].notifications.uploadComplete.description,
                        placement: 'bottomRight',
                        duration: 5,
                        key: oid
                    });

                    notifiedOrdersRef.current.add(oid);
                }
            } else {
                if (notifiedOrdersRef.current.has(oid)) {
                    // If it was notified but now has pending items (e.g. user added more files), reset flag
                    notifiedOrdersRef.current.delete(oid);
                }
            }
        });
    }, [queue, language]);

    const processNext = useCallback(async () => {
        if (processingRef.current) return;

        // Find next pending item
        const nextItem = queue.find(item => item.status === 'pending' || item.status === 'retrying');
        if (!nextItem) return;

        processingRef.current = true;
        const { id, file, storagePath, orderId, targetField } = nextItem;

        updateItemStatus(id, 'uploading', 10);

        try {
            // 1. Upload to Firebase Storage (Hot Storage)
            // Use storagePath directly (remove leading slash if present for consistency)
            const finalPath = storagePath ? (storagePath.startsWith('/') ? storagePath.substring(1) : storagePath) : `uploads/${orderId}/${file.name}`;

            const firebaseUrl = await uploadFileToStorage(file, finalPath);
            updateItemStatus(id, 'uploading', 90);

            // 2. Update Firestore with firebaseUrl
            const attachment = {
                name: file.name,
                link: firebaseUrl, // Direct access
                type: file.type,
            };

            const updateData: any = {};
            // Save firebaseUrl for immediate display
            if (targetField === 'mockupUrl') {
                updateData[targetField] = firebaseUrl;
            } else {
                updateData[targetField] = arrayUnion(attachment);
            }

            await updateOrder(orderId, updateData);

            updateItemStatus(id, 'success', 100, undefined, firebaseUrl);
        } catch (error: any) {
            console.error("Upload Error Context:", error);
            updateItemStatus(id, 'error', 0, error.message || "Upload Failed");
        } finally {
            if (queue.find(i => i.id === id)?.status !== 'retrying') {
                processingRef.current = false;
            }
        }
    }, [queue]);

    // Watch queue
    useEffect(() => {
        const hasPending = queue.some(i => i.status === 'pending');
        const isProcessing = queue.some(i => i.status === 'uploading');

        if (hasPending && !isProcessing && !processingRef.current) {
            processNext();
        }
    }, [queue, processNext]);

    const retry = (id: string) => {
        updateItemStatus(id, 'pending', 0, undefined);
    };

    const cancel = (id: string) => {
        setQueue(prev => prev.filter(i => i.id !== id));
    };

    const clearCompleted = () => {
        setQueue(prev => prev.filter(i => i.status !== 'success'));
    };

    const isUploading = queue.some(i => i.status === 'uploading' || i.status === 'pending');

    return (
        <UploadContext.Provider value={{ queue, enqueue, retry, cancel, clearCompleted, isUploading, registerCompletionAction }}>
            {children}
        </UploadContext.Provider>
    );
};

export const useUpload = () => {
    const context = useContext(UploadContext);
    if (!context) throw new Error("useUpload must be used within UploadProvider");
    return context;
};
