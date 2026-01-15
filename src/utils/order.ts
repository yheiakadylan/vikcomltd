import dayjs from 'dayjs';
import type { Order } from '../types';

export const generateStoragePath = (order: Partial<Order> & { readableId: string, title: string }, collectionName: string = 'tasks') => {
    const year = order.created_at ? dayjs((order.created_at as any).toDate ? (order.created_at as any).toDate() : order.created_at).format('YYYY') : dayjs().format('YYYY');
    const month = order.created_at ? dayjs((order.created_at as any).toDate ? (order.created_at as any).toDate() : order.created_at).format('MM') : dayjs().format('MM');

    // Sanitize Title
    const safeTitle = (order.title || '')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d").replace(/Đ/g, "D")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .substring(0, 50);

    const skuPart = order.sku ? `${order.sku}_` : '';

    // Format: /PINK_POD_SYSTEM/{Type}/{Year}/{Month}/{ReadableID}_{SKU_}{Title}
    // Fulfill (tasks): ReadableID is OrderID.
    // Ideas: ReadableID is TeamName. SKU is required.
    // Result: 
    // Fulfill: 1002_SKU123_Title (or 1002_Title if SKU empty)
    // Idea: TeamA_SKU456_Title

    const rootDir = collectionName === 'ideas' ? '/PINK_POD_SYSTEM/IDEAS' : '/PINK_POD_SYSTEM/FULFILL';
    return `${rootDir}/${year}/${month}/${order.readableId}_${skuPart}${safeTitle}`;
};
