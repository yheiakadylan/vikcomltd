export type Role = 'ADMIN' | 'CS' | 'DS';

export interface AppUser {
    uid: string;
    email: string;
    displayName: string;
    role: Role;
    avatar?: string;
    isActive?: boolean; // Added
}

export type User = AppUser & { avatarUrl?: string }; // Alias for Admin component compatibility or migration


export type OrderStatus = 'draft' | 'new' | 'doing' | 'in_review' | 'need_fix' | 'done' | 'archived';

export interface FileAttachment {
    name: string;
    link: string; // Link Dropbox
    type?: string;
}

export interface Order {
    id: string;
    readableId: string | number; // ID ngắn #1001
    title: string;
    sku?: string; // Mã sản phẩm
    description: string;
    category: string;
    quantity: number;
    deadline: any; // Firestore Timestamp or Date or ISO String (flexible for now)

    status: OrderStatus;
    isUrgent: boolean; // Cờ ưu tiên

    createdBy: string;
    designerId?: string | null;

    dropboxPath: string; // Folder gốc trên Dropbox

    sampleFiles?: FileAttachment[]; // Ảnh mẫu
    mockupUrl?: string; // New: Link to mockup image
    customerFiles?: FileAttachment[]; // New: Customer uploaded files
    designFiles?: FileAttachment[]; // File thiết kế Final

    // Storage & Optimization
    dropboxUrl?: string; // Dropbox Link (Cold Storage)
    mockupDropboxPath?: string; // Path on Dropbox just in case
    storageCleaned?: boolean; // True if Firebase file deleted
    storageMethod?: 'dropbox' | 'firebase' | 'hybrid';

    created_at?: any;
    updatedAt?: any;
}

export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error' | 'retrying' | 'paused';

export interface UploadItem {
    id: string; // Unique ID (e.g. from uuid or timestamp)
    file: File;
    status: UploadStatus;
    progress: number; // 0-100
    error?: string;

    // Context Info
    orderId: string;
    readableId?: string; // Human-readable order ID for notifications
    targetField: 'customerFiles' | 'designFiles' | 'mockupUrl';
    dropboxPath: string; // Target path in Dropbox

    // Result
    resultUrl?: string;
}

export interface OrderLog {
    id?: string;
    action: string;
    actorId: string;
    actorName: string;
    details?: string;
    content?: string;
    attachments?: FileAttachment[];
    createdAt?: any;
}

// Sync Queue for Dropbox (Persistent Queue System)
export interface SyncQueueTask {
    id?: string;
    firebasePath: string;
    dropboxPath: string;
    orderId: string;
    readableId?: string;
    targetField?: string; // 'mockupUrl' | 'designFiles' | 'customerFiles'
    status: 'pending' | 'processing' | 'success' | 'error';
    retryCount: number;
    createdAt: any; // Firestore Timestamp
    syncedAt?: any;
    updatedAt?: any;
    errorLog?: string;
}
