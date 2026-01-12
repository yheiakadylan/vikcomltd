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

    created_at?: any;
    updatedAt?: any;
}
