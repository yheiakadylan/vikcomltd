export type Role = 'ADMIN' | 'CS' | 'DS';

export interface AppUser {
    uid: string;
    email: string;
    displayName: string;
    role: Role;
    avatar?: string;
}

export type OrderStatus = 'draft' | 'new' | 'doing' | 'in_review' | 'need_fix' | 'done' | 'archived';

export interface FileAttachment {
    name: string;
    link: string; // Link Dropbox
    type?: string;
}

export interface Order {
    id: string;
    readableId: number; // ID ngắn #1001
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
    designFiles?: FileAttachment[]; // File thiết kế Final

    created_at?: any;
    updatedAt?: any;
}
