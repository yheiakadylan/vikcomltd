export type UserRole = 'CS' | 'DS' | 'ADMIN';

export interface AppUser {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    avatar?: string;
}

export type OrderStatus = 'draft' | 'new' | 'doing' | 'in_review' | 'need_fix' | 'done' | 'archived';

export interface Order {
    id: string; // UUID
    readableId: number; // Auto-inc
    title: string;
    sku?: string;
    description: string;
    category: string; // Default 'T-shirt'
    quantity: number; // Default 1
    deadline: Date; // Timestamp in DB
    status: OrderStatus;
    isUrgent: boolean;
    createdBy: string; // UID of CS
    designerId?: string | null; // UID of DS
    dropboxPath: string;
    sampleFiles?: string[];
    designFiles?: string[];
    logs?: any[]; // To be defined
    created_at?: Date; // Added for sorting logic if needed

    // Frontend helper props
    key?: string; // For table
}
