import React from 'react';
import { getOptimizedImageUrl } from '../../utils/image';
import { Card, Image, Button, Popconfirm, Tag } from 'antd';
import { CloudUploadOutlined, FireFilled, DeleteOutlined, RollbackOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useLanguage } from '../../contexts/LanguageContext';
import type { Order } from '../../types';

interface OrderCardProps {
    order: Order;
    isUrgent: boolean;
    isCS: boolean;
    isDS: boolean;
    onOpenDetail: (order: Order) => void;
    onOpenGiveBack: (e: React.MouseEvent, order: Order) => void;
    onDelete: (orderId: string) => void;
}

const OrderCard: React.FC<OrderCardProps> = ({
    order,
    isUrgent,
    isCS,
    isDS,
    onOpenDetail,
    onOpenGiveBack,
    onDelete
}) => {
    const { t } = useLanguage();
    const deadlineDisplay = order.deadline
        ? dayjs((order.deadline as any).seconds ? (order.deadline as any).seconds * 1000 : order.deadline).format('DD/MM')
        : null;


    return (
        <Card
            key={order.id}
            hoverable
            className={`mb-4 shadow-sm transition-all duration-300 ${isUrgent ? 'border-2 border-red-500 bg-red-50' : ''}`}
            style={{
                borderColor: isUrgent ? '#f5222d' : '#d9d9d9',
                backgroundColor: isUrgent ? '#fff1f0' : undefined,
                borderWidth: isUrgent ? 2 : 1,
                borderStyle: 'solid'
            }}
            onClick={() => onOpenDetail(order)}
            cover={
                <div
                    style={{ height: 180, position: 'relative', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
                >
                    {order.mockupUrl ? (
                        <Image
                            alt="mockup"
                            src={getOptimizedImageUrl(order.mockupUrl, 400, 300)}
                            preview={false}
                            width="100%"
                            height="100%"
                            style={{ objectFit: 'cover' }}
                            fallback={`https://placehold.co/400x300/e6e6e6/a3a3a3?text=${t('dashboard.card.noImage')}`}
                            placeholder={
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#f5f5f5' }}>
                                    <ClockCircleOutlined style={{ fontSize: 24, color: '#ccc' }} spin />
                                </div>
                            }
                        />
                    ) : (
                        <div className="text-gray-300"><CloudUploadOutlined style={{ fontSize: 32, color: '#ccc' }} /></div>
                    )}
                    {isUrgent && <div style={{ position: 'absolute', top: 0, right: 0, background: '#f5222d', color: '#fff', fontSize: 12, fontWeight: 'bold', padding: '4px 8px', borderRadius: '0 0 0 8px' }}> 🔥</div>}
                    {isCS && (
                        <div style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 10 }} onClick={e => e.stopPropagation()}>
                            <Popconfirm title={t('dashboard.card.confirmDelete')} onConfirm={() => onDelete(order.id)} onCancel={(e) => e?.stopPropagation()} okText={t('common.delete')} cancelText={t('common.cancel')}>
                                <Button shape="circle" size="small" danger icon={<DeleteOutlined />} style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                            </Popconfirm>
                        </div>
                    )}
                </div>
            }
            actions={[
                (isDS && order.status === 'doing') ? <Button type="text" danger icon={<RollbackOutlined />} onClick={(e) => onOpenGiveBack(e, order)}>{t('dashboard.card.giveBack')}</Button> : null,
            ].filter(Boolean) as React.ReactNode[]}
        >
            <Card.Meta
                title={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {/* Header: ID + Date */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 18, fontWeight: 800, color: isUrgent ? '#ff4d4f' : '#eb2f96', lineHeight: 1 }}>
                                {isUrgent && <FireFilled style={{ marginRight: 4 }} />} #{order.readableId}
                            </span>
                            {order.created_at && (
                                <span style={{ fontSize: 12, color: '#999', background: '#fafafa', padding: '2px 8px', borderRadius: 12, border: '1px solid #f0f0f0' }}>
                                    {dayjs((order.created_at as any).toDate ? (order.created_at as any).toDate() : order.created_at).format('DD/MM')}
                                </span>
                            )}
                        </div>

                        {/* Title Box */}
                        <div style={{
                            fontSize: 13,
                            background: '#f9f9f9',
                            color: '#595959',
                            padding: '6px 10px',
                            borderRadius: 8,
                            width: '100%',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            border: '1px solid #f0f0f0'
                        }} title={order.title}>
                            {order.title}
                        </div>
                    </div>
                }
                description={
                    /* Footer: Tags */
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                        {deadlineDisplay ? (
                            <Tag icon={<ClockCircleOutlined />} color={isUrgent ? 'red' : 'default'} style={{ margin: 0, fontSize: 12, border: 'none', background: isUrgent ? '#fff1f0' : '#f5f5f5' }}>
                                {deadlineDisplay}
                            </Tag>
                        ) : <span />}
                        {order.sku && <Tag color="blue" style={{ margin: 0, border: 'none', background: '#e6f7ff', color: '#1890ff' }}>SKU: {order.sku}</Tag>}
                    </div>
                }
            />
        </Card>
    );
};

export default React.memo(OrderCard);
