import React from 'react';
// import { getOptimizedImageUrl } from '../../utils/image';
import { Button, Popconfirm, Tag, Spin } from 'antd';
import { CloudUploadOutlined, FireFilled, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useLanguage } from '../../contexts/LanguageContext';
import type { Order } from '../../types';
import SmartImage from '../common/SmartImage';

interface OrderRowProps {
    order: Order;
    isUrgent: boolean;
    isCS: boolean;
    onOpenDetail: (order: Order) => void;
    onDelete: (orderId: string) => void;
}

const OrderRow: React.FC<OrderRowProps> = ({
    order,
    isUrgent,
    isCS,
    onOpenDetail,
    onDelete
}) => {
    const { t } = useLanguage();
    const deadlineDisplay = order.deadline
        ? dayjs((order.deadline as any).seconds ? (order.deadline as any).seconds * 1000 : order.deadline).format('DD/MM')
        : null;

    return (
        <div
            key={order.id}
            className={`cinematic-row-card ${isUrgent ? 'border-red-500 bg-red-50' : ''} `}
            style={{ borderColor: isUrgent ? '#f5222d' : undefined }}
            onClick={() => onOpenDetail(order)}
        >
            <div
                style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', marginRight: 16, flexShrink: 0 }}
            >
                {order.mockupUrl ? (
                    <SmartImage
                        src={order.mockupUrl}
                        backupSrc={order.dropboxUrl}
                        preview={false}
                        alt={order.title}
                        width={80}
                        height={80}
                        style={{ borderRadius: 8 }}
                        placeholder={<div style={{ width: 80, height: 80, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div>}
                        updatedAt={order.updatedAt}
                        fit="contain"
                    />
                ) : (
                    <div style={{ width: '100%', height: '100%', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CloudUploadOutlined style={{ color: '#ccc' }} />
                    </div>
                )}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 800, fontSize: 18, color: isUrgent ? '#cf1322' : '#eb2f96', lineHeight: 1.2 }}>
                            {isUrgent && <FireFilled style={{ marginRight: 4 }} />} #{order.readableId}
                        </span>
                        <span style={{ fontSize: 13, color: '#666', background: '#f5f5f5', padding: '2px 8px', borderRadius: 4, marginTop: 4, maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {order.title}
                        </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: '#999' }}>
                            {order.created_at ? dayjs((order.created_at as any).toDate ? (order.created_at as any).toDate() : order.created_at).format('DD/MM HH:mm') : ''}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    {deadlineDisplay && <Tag color={isUrgent ? 'red' : 'default'} style={{ margin: 0 }}>{deadlineDisplay}</Tag>}
                    {order.sku && <Tag color="blue" style={{ margin: 0 }}>SKU: {order.sku}</Tag>}
                    <span style={{ fontSize: 13, color: '#666', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {order.description || t('dashboard.card.noDesc')}
                    </span>
                </div>
            </div>
            {isCS && (
                <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 12 }}>
                    <Popconfirm title={t('dashboard.card.confirmDelete')} onConfirm={() => onDelete(order.id)} onCancel={(e) => e?.stopPropagation()} okText={t('common.delete')} cancelText={t('common.cancel')}>
                        <Button type="text" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()} />
                    </Popconfirm>
                </div>
            )}
        </div>
    );
};

export default React.memo(OrderRow);
