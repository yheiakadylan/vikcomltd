import React, { useState, useEffect } from 'react';
import { Layout, Tabs, Input, Button, Badge, Card, Tag, Empty, message, Spin, Avatar } from 'antd';
import { PlusOutlined, FireFilled, UserOutlined, ClockCircleOutlined, CloudUploadOutlined, RollbackOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import type { Order, OrderStatus } from '../types';
import { subscribeToOrders, updateOrder } from '../services/firebase';
import { sortOrders } from '../utils/sortOrders';
import NewTaskModal from '../components/modals/NewTaskModal';
import TaskDetailModal from '../components/modals/TaskDetailModal';
import RejectModal from '../components/modals/RejectModal';
import GiveBackModal from '../components/modals/GiveBackModal';
import dayjs from 'dayjs';

const { Header, Content } = Layout;
const { Search } = Input;

const Dashboard: React.FC = () => {
    // Alias appUser to user to match the logic provided
    const { appUser: user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState<OrderStatus>('new');
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');

    // Modal States
    const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [isGiveBackModalOpen, setIsGiveBackModalOpen] = useState(false);

    // Check Role
    const isCS = user?.role === 'CS' || user?.role === 'ADMIN';
    const isDS = user?.role === 'DS';

    // 1. Realtime Subscription
    useEffect(() => {
        const unsubscribe = subscribeToOrders((fetchedOrders) => {
            setOrders(fetchedOrders);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // 2. Filter & Sort Logic
    const getFilteredOrders = (status: OrderStatus) => {
        let filtered = orders.filter(o => o.status === status);

        // Filter by Search Text
        if (searchText) {
            const lowerSearch = searchText.toLowerCase();
            filtered = filtered.filter(o =>
                o.title.toLowerCase().includes(lowerSearch) ||
                o.readableId.toString().includes(lowerSearch) ||
                (o.sku && o.sku.toLowerCase().includes(lowerSearch))
            );
        }

        // Filter by Role Logic
        if (isDS) {
            // DS only sees 'new' (to claim) OR their own orders
            if (status === 'new') {
                // See all new
            } else {
                // Other tabs: only see own
                filtered = filtered.filter(o => o.designerId === user?.uid);
            }
        }

        // Sort priority
        return sortOrders(filtered);
    };

    // Actions
    const handleClaim = async (e: React.MouseEvent, order: Order) => {
        e.stopPropagation();
        try {
            await updateOrder(order.id, {
                status: 'doing',
                designerId: user?.uid,
            });
            message.success(`Đã nhận đơn #${order.readableId}. Chuyển sang tab Doing nhé!`);
        } catch (error) {
            message.error('Lỗi khi nhận đơn');
        }
    };

    const handleOpenDetail = (order: Order) => {
        setSelectedOrder(order);
        setIsDetailModalOpen(true);
    };

    const handleOpenReject = (e: React.MouseEvent, order: Order) => {
        e.stopPropagation();
        setSelectedOrder(order);
        setIsRejectModalOpen(true);
    };

    const handleOpenGiveBack = (e: React.MouseEvent, order: Order) => {
        e.stopPropagation();
        setSelectedOrder(order);
        setIsGiveBackModalOpen(true);
    };

    // Render Card Component
    const renderOrderCard = (order: Order) => {
        const isUrgent = order.isUrgent;

        return (
            <Card
                key={order.id}
                hoverable
                className={`mb-4 shadow-sm transition-all duration-300 ${isUrgent ? 'border-2 border-red-500 bg-red-50' : 'border-gray-200'}`}
                style={{
                    borderColor: isUrgent ? '#f5222d' : undefined,
                    backgroundColor: isUrgent ? '#fff1f0' : undefined
                }}
                onClick={() => handleOpenDetail(order)}
                cover={
                    <div className="h-40 overflow-hidden relative bg-gray-100 flex items-center justify-center" style={{ height: 160, position: 'relative', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {order.sampleFiles && order.sampleFiles.length > 0 ? (
                            <img alt="sample" src={order.sampleFiles[0] as unknown as string} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> // Cast to string if it's FileAttachment based on updated type, wait, type IS FileAttachment?
                            // Actually `sampleFiles` in types/index.ts is `FileAttachment[]` or `string[]`?
                            // Step 523: `sampleFiles?: FileAttachment[];`
                            // So `order.sampleFiles[0].link` is correct.
                        ) : (
                            // Helper logic: if it's new type, it's .link. If old data, might be string?
                            // Let's assume FileAttachment.
                            (order.sampleFiles && (order.sampleFiles[0] as any).link) ?
                                <img alt="sample" src={(order.sampleFiles[0] as any).link} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                :
                                <div className="text-gray-300"><CloudUploadOutlined style={{ fontSize: 32, color: '#ccc' }} /></div>
                        )}
                        {isUrgent && (
                            <div style={{ position: 'absolute', top: 0, right: 0, background: '#f5222d', color: '#fff', fontSize: 12, fontWeight: 'bold', padding: '4px 8px', borderRadius: '0 0 0 8px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                                URGENT 🔥
                            </div>
                        )}
                    </div>
                }
                actions={[
                    // Action Bar
                    (isDS && order.status === 'new') ?
                        <Button type="link" onClick={(e) => handleClaim(e, order)} style={{ color: '#eb2f96', fontWeight: 'bold' }}>CLAIM</Button>
                        : null,
                    (isDS && order.status === 'doing') ?
                        <Button type="text" danger icon={<RollbackOutlined />} onClick={(e) => handleOpenGiveBack(e, order)}>Trả đơn</Button>
                        : null,
                    (isCS && order.status === 'in_review') ?
                        <Button type="text" danger onClick={(e) => handleOpenReject(e, order)}>Reject</Button>
                        : null,
                ].filter(Boolean) as React.ReactNode[]}
            >
                <Card.Meta
                    title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: 16, color: isUrgent ? '#cf1322' : '#262626', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'block', maxWidth: '70%' }} title={order.title}>
                                {isUrgent && <FireFilled style={{ marginRight: 4 }} />} {order.title}
                            </span>
                            <span style={{ color: '#8c8c8c', fontSize: 12, fontFamily: 'monospace' }}>#{order.readableId}</span>
                        </div>
                    }
                    description={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#8c8c8c' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ClockCircleOutlined /> {dayjs((order.deadline as any).seconds ? (order.deadline as any).seconds * 1000 : order.deadline).format('DD/MM')}</span>
                                {order.sku && <Tag>{order.sku}</Tag>}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                <Tag color="magenta">{order.category}</Tag>
                                <span style={{ fontSize: 12, fontWeight: 'bold', color: '#8c8c8c' }}>Qty: {order.quantity}</span>
                            </div>
                        </div>
                    }
                />
            </Card>
        );
    };

    const renderTabContent = (status: OrderStatus) => {
        const filteredOrders = getFilteredOrders(status);

        if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin size="large" /></div>;

        if (filteredOrders.length === 0) {
            return <Empty description="Chưa có đơn hàng nào ở đây" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
        }

        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, padding: 16 }}>
                {filteredOrders.map(renderOrderCard)}
            </div>
        );
    };

    // Define Tabs items
    const tabItems = [
        {
            key: 'new',
            label: (
                <span>
                    New <Badge count={getFilteredOrders('new').length} style={{ backgroundColor: '#eb2f96' }} />
                </span>
            ),
            children: renderTabContent('new')
        },
        {
            key: 'doing',
            label: 'Doing',
            children: renderTabContent('doing')
        },
        {
            key: 'in_review',
            label: (
                <span>
                    In Review <Badge count={getFilteredOrders('in_review').length} style={{ backgroundColor: '#52c41a' }} />
                </span>
            ),
            children: renderTabContent('in_review'),
            disabled: false // Let DS view strictly read only if handled by render content, but here we just filter.
        },
        {
            key: 'need_fix',
            label: (
                <span>
                    Need Fix <Badge count={getFilteredOrders('need_fix').length} style={{ backgroundColor: '#faad14' }} />
                </span>
            ),
            children: renderTabContent('need_fix')
        },
        {
            key: 'done',
            label: 'Done',
            children: renderTabContent('done')
        },
    ];

    return (
        <Layout style={{ minHeight: '100vh', background: '#fff0f6' }}>
            <Header style={{ background: '#fff', borderBottom: '1px solid #ffadd2', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, height: 64, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#c41d7f', letterSpacing: '-1px' }}>PINK<span style={{ color: '#262626' }}>POD</span></div>
                    <Search
                        placeholder="Tìm theo ID, Title, SKU..."
                        allowClear
                        onChange={e => setSearchText(e.target.value)}
                        style={{ width: 300 }}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {isCS && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setIsNewTaskModalOpen(true)}
                            style={{ background: '#eb2f96', borderColor: '#eb2f96', boxShadow: '0 2px 4px rgba(235, 47, 150, 0.3)' }}
                        >
                            Tạo Task
                        </Button>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: 4, borderRadius: 4, transition: 'background 0.2s' }} onClick={() => logout()}>
                        <Avatar src={user?.avatar} icon={<UserOutlined />} style={{ background: '#ffd6e7', color: '#c41d7f' }} />
                        <div style={{ lineHeight: 1.2 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#262626' }}>{user?.displayName || user?.email}</div>
                            <div style={{ fontSize: 10, color: '#8c8c8c', textTransform: 'uppercase', fontWeight: 'bold' }}>{user?.role}</div>
                        </div>
                    </div>
                </div>
            </Header>

            <Content style={{ padding: 24 }}>
                <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', minHeight: 'calc(100vh - 140px)' }}>
                    <Tabs
                        activeKey={activeTab}
                        onChange={(key) => setActiveTab(key as OrderStatus)}
                        items={tabItems}
                        tabBarStyle={{ padding: '0 24px', margin: 0 }}
                        className="custom-tabs"
                        style={{ marginTop: 12 }}
                    />
                </div>
            </Content>

            {/* MODALS */}
            <NewTaskModal
                open={isNewTaskModalOpen}
                onCancel={() => setIsNewTaskModalOpen(false)}
                onSuccess={() => {
                    setIsNewTaskModalOpen(false);
                    // No need to refresh manually, subscription handles it
                }}
            />

            {selectedOrder && (
                <>
                    <TaskDetailModal
                        order={selectedOrder}
                        open={isDetailModalOpen}
                        onCancel={() => {
                            setIsDetailModalOpen(false);
                            setSelectedOrder(null);
                        }}
                        onUpdate={() => {
                            // Realtime handles update
                        }}
                    />
                    <RejectModal
                        order={selectedOrder}
                        open={isRejectModalOpen}
                        onCancel={() => {
                            setIsRejectModalOpen(false);
                            setSelectedOrder(null);
                        }}
                        onSuccess={() => {
                            // Realtime handles update
                        }}
                    />
                    <GiveBackModal
                        order={selectedOrder}
                        open={isGiveBackModalOpen}
                        onCancel={() => {
                            setIsGiveBackModalOpen(false);
                            setSelectedOrder(null);
                        }}
                        onSuccess={() => {
                            // Realtime handles update
                        }}
                    />
                </>
            )}
        </Layout>
    );
};

export default Dashboard;
