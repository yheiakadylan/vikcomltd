import dayjs from 'dayjs';
import type { Order } from '../types';

export const generateDropboxPath = (order: Partial<Order> & { readableId: string, title: string }) => {
    const year = order.created_at ? dayjs((order.created_at as any).toDate ? (order.created_at as any).toDate() : order.created_at).format('YYYY') : dayjs().format('YYYY');
    const month = order.created_at ? dayjs((order.created_at as any).toDate ? (order.created_at as any).toDate() : order.created_at).format('MM') : dayjs().format('MM');

    // Sanitize Title
    const safeTitle = (order.title || '')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d").replace(/Đ/g, "D")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .substring(0, 50);

    const skuPart = order.sku ? `${order.sku}_` : '';

    // Format: /PINK_POD_SYSTEM/{Year}/{Month}/{ReadableID}_[SKU_]{Title}
    return `/PINK_POD_SYSTEM/${year}/${month}/${order.readableId}_${skuPart}${safeTitle}`;
};
