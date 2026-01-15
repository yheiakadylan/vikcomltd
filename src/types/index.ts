export type Role = 'ADMIN' | 'CS' | 'DS' | 'IDEA';

export interface AppUser {
    uid: string;
    email: string;
    displayName: string;
    role: Role;
    avatar?: string;
    isActive?: boolean;
}

export type User = AppUser & { avatarUrl?: string }; // Alias for Admin component compatibility or migration


export type OrderStatus = 'draft' | 'new' | 'doing' | 'check' | 'in_review' | 'need_fix' | 'done' | 'archived';

export interface FileAttachment {
    name: string;
    link: string; // URL
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

    sampleFiles?: FileAttachment[]; // Ảnh mẫu
    mockupUrl?: string; // Link to mockup image (Firebase Storage)
    customerFiles?: FileAttachment[]; // New: Customer uploaded files
    designFiles?: FileAttachment[]; // File thiết kế Final
    storagePath?: string; // Path to storage folder (e.g. /Year/Month/Title)

    created_at?: any;
    updatedAt?: any;
    collectionName?: string;
    approvedByManager?: boolean;
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
    storagePath?: string; // Firebase Storage Path

    // Result
    resultUrl?: string;
    collectionName?: string;
}

export interface OrderLog {
    id?: string;
    action: string;
    actorId: string;
    actorName: string;
    details?: string;
    content?: string; // Keep
    attachments?: FileAttachment[];
    createdAt?: any;

    // NEW FIELDS
    actorDisplayName?: string;
    actionType?: string; // e.g. 'status_change', 'comment', 'assign'
    actionLabel?: string; // e.g. "Changed status to IN_REVIEW"
}
