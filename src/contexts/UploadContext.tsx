import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage } from '../services/firebase';

import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import type { UploadTask } from 'firebase/storage';

// --- Configuration ---
const MAX_CONCURRENT_UPLOADS = 5; // Limit parallel uploads to avoid 429

// --- Types ---
export type UploadStatus = 'pending' | 'compressing' | 'uploading' | 'success' | 'error' | 'paused';

export interface UploadItem {
    id: string;
    file: File;
    status: UploadStatus;
    progress: number;
    error?: string;
    resultUrl?: string;
    metadata?: any;
    path: string; // Storage path
    task?: UploadTask; // Firebase Upload Task for cancellation
}

interface UploadContextType {
    queue: UploadItem[];
    addToQueue: (files: File[], basePath: string, metadata?: any) => Promise<string[]>; // Returns array of IDs
    retry: (id: string) => void;
    cancel: (id: string) => void;
    clearCompleted: () => void;
    isUploading: boolean;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const useUpload = () => {
    const context = useContext(UploadContext);
    if (!context) throw new Error('useUpload must be used within UploadProvider');
    return context;
};

// --- Provider ---
export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [queue, setQueue] = useState<UploadItem[]>([]);
    const [activeCount, setActiveCount] = useState(0);

    // Queue Processor
    useEffect(() => {
        const processQueue = () => {
            if (activeCount >= MAX_CONCURRENT_UPLOADS) return;

            const pendingItems = queue.filter(item => item.status === 'pending');
            const availableSlots = MAX_CONCURRENT_UPLOADS - activeCount;
            const itemsToStart = pendingItems.slice(0, availableSlots);

            itemsToStart.forEach(nextItem => {
                // Start Item
                setActiveCount(prev => prev + 1);

                // Optimistically update status to prevent re-selection
                updateItem(nextItem.id, { status: 'uploading', progress: 0 });

                const startUpload = async () => {
                    try {
                        // Check logic again inside async just in case cancellation happened instantly (rare)
                        if (!queue.find(i => i.id === nextItem.id)) {
                            setActiveCount(prev => prev - 1);
                            return;
                        }

                        // 2. Upload Phase (Resumable)
                        const storageRef = ref(storage, nextItem.path);
                        const uploadTask = uploadBytesResumable(storageRef, nextItem.file);

                        // Attach task to state so we can cancel it
                        updateItem(nextItem.id, { task: uploadTask });

                        uploadTask.on('state_changed',
                            (snapshot) => {
                                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                                updateItem(nextItem.id, { progress });
                            },
                            (error) => {
                                console.error("Upload error", error);
                                updateItem(nextItem.id, { status: 'error', error: error.message });
                                setActiveCount(prev => prev - 1);
                            },
                            async () => {
                                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                                updateItem(nextItem.id, { status: 'success', progress: 100, resultUrl: downloadURL });
                                setActiveCount(prev => prev - 1);

                                // Callback via metadata if needed
                                if (nextItem.metadata?.onSuccess) {
                                    nextItem.metadata.onSuccess(downloadURL);
                                }
                            }
                        );

                    } catch (err: any) {
                        updateItem(nextItem.id, { status: 'error', error: err.message });
                        setActiveCount(prev => prev - 1);
                    }
                };

                startUpload();
            });
        };

        processQueue();
    }, [queue, activeCount]);

    const updateItem = (id: string, partial: Partial<UploadItem>) => {
        setQueue(prev => prev.map(item => item.id === id ? { ...item, ...partial } : item));
    };

    const addToQueue = async (files: File[], basePath: string, metadata?: any): Promise<string[]> => {
        const newItems: UploadItem[] = files.map(file => {
            const id = Math.random().toString(36).substr(2, 9) + Date.now();
            // Handle filename duplicates or simple sanitization
            const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const path = `${basePath}/${cleanName}`;

            return {
                id,
                file,
                status: 'pending',
                progress: 0,
                path,
                metadata
            };
        });

        setQueue(prev => [...prev, ...newItems]);
        return newItems.map(i => i.id);
    };

    const retry = (id: string) => {
        updateItem(id, { status: 'pending', progress: 0, error: undefined });
    };

    const cancel = (id: string) => {
        const item = queue.find(i => i.id === id);
        if (item?.task) item.task.cancel();
        setQueue(prev => prev.filter(i => i.id !== id));
    };

    const clearCompleted = () => {
        setQueue(prev => prev.filter(i => i.status !== 'success'));
    };

    return (
        <UploadContext.Provider value={{
            queue,
            addToQueue,
            retry,
            cancel,
            clearCompleted,
            isUploading: activeCount > 0
        }}>
            {children}
        </UploadContext.Provider>
    );
};
