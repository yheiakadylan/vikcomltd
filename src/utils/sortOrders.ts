import type { Order } from '../types';

export const sortOrders = (orders: Order[]) => {
    return orders.sort((a, b) => {
        // Helper to get date info consistently
        const getDate = (dateVal: any) => dateVal ? new Date((dateVal.seconds ? dateVal.seconds * 1000 : dateVal)) : new Date(0);

        // 1. Need Fix + Urgent (Cháy nhà - Quan trọng nhất)
        const aFixUrgent = a.status === 'need_fix' && a.isUrgent;
        const bFixUrgent = b.status === 'need_fix' && b.isUrgent;
        if (aFixUrgent && !bFixUrgent) return -1;
        if (!aFixUrgent && bFixUrgent) return 1;

        // 2. New/Doing + Urgent (Mới gấp)
        const aActiveUrgent = (a.status === 'new' || a.status === 'doing') && a.isUrgent;
        const bActiveUrgent = (b.status === 'new' || b.status === 'doing') && b.isUrgent;
        if (aActiveUrgent && !bActiveUrgent) return -1;
        if (!aActiveUrgent && bActiveUrgent) return 1;

        // 3. Need Fix thường
        if (a.status === 'need_fix' && b.status !== 'need_fix') return -1;
        if (b.status === 'need_fix' && a.status !== 'need_fix') return 1;

        // 4. Còn lại xếp theo Deadline (Gần nhất lên trước)
        return getDate(a.deadline).getTime() - getDate(b.deadline).getTime();
    });
};
