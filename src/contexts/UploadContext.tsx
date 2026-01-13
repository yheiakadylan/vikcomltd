import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { UploadItem, UploadStatus } from '../types';
import { uploadFileToDropbox } from '../services/dropbox';
import { updateOrder } from '../services/firebase';
import { arrayUnion } from 'firebase/firestore';
import { notification } from 'antd';

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
            dropboxPath: `${basePath}/${file.name}`
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
                                message: `Đã nộp bài: Đơn #${readableId}`,
                                description: 'Upload hoàn tất. Đơn đã chuyển sang trạng thái chờ duyệt.',
                                placement: 'bottomRight',
                            });
                            completionActionsRef.current.delete(oid); // remove from auto submit
                        })
                        .catch(err => {
                            console.error("Auto Submit Failed", err);
                            notification.error({
                                message: `Lỗi nộp bài tự động: Đơn #${readableId}`,
                                description: 'Vui lòng kiểm tra lại đơn hàng.',
                            });
                        });
                    return; // Skip standard notification
                } else if (action === 'notify_creation') {
                    notification.success({
                        message: `Tạo Task hoàn tất: Đơn #${readableId}`,
                        description: 'Các file đính kèm đã được tải lên Dropbox thành công.',
                        placement: 'bottomRight',
                    });
                    completionActionsRef.current.delete(oid);
                    return;
                }

                if (!notifiedOrdersRef.current.has(oid)) {
                    // Standard Notification (No Action Button)
                    notification.success({
                        message: `Upload hoàn tất: Đơn #${readableId}`, // Simple ID for now, ideally queue has readableId or we fetch it
                        description: 'Tất cả file đã được tải lên thành công.',
                        placement: 'bottomRight',
                        duration: 5,
                        key: oid // Use key to prevent duplicate or allow closing
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
    }, [queue]);

    const processNext = useCallback(async () => {
        if (processingRef.current) return;

        // Find next pending item
        const nextItem = queue.find(item => item.status === 'pending' || item.status === 'retrying');
        if (!nextItem) return;

        processingRef.current = true;
        const { id, file, dropboxPath, orderId, targetField } = nextItem;

        updateItemStatus(id, 'uploading', 10);

        try {
            const result = await uploadFileToDropbox(file, dropboxPath);
            updateItemStatus(id, 'uploading', 90);

            // Update Firestore
            const attachment = {
                name: file.name,
                link: result.url,
                type: file.type
            };

            const updateData: any = {};
            if (targetField === 'mockupUrl') {
                updateData[targetField] = result.url;
            } else {
                updateData[targetField] = arrayUnion(attachment);
            }

            await updateOrder(orderId, updateData);

            updateItemStatus(id, 'success', 100, undefined, result.url);
        } catch (error: any) {
            console.error("Upload Error Context:", error);

            if (error?.status === 429 || error?.message?.includes('429')) {
                updateItemStatus(id, 'retrying', 0, "Rate Limit. Retrying in 5s...");
                setTimeout(() => {
                    updateItemStatus(id, 'pending');
                    processingRef.current = false;
                }, 5000);
                return;
            }

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
