import React, { useState, useEffect } from 'react';
import { Layout, Tabs, Button, Badge, Card, Tag, Empty, Spin, App } from 'antd';
import { FireFilled, ClockCircleOutlined, CloudUploadOutlined, RollbackOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom'; // Added imports
import { useAuth } from '../contexts/AuthContext';
import type { Order, OrderStatus } from '../types';
import { subscribeToOrders, updateOrder, where } from '../services/firebase'; // Added where
import { sortOrders } from '../utils/sortOrders';
import NewTaskModal from '../components/modals/NewTaskModal';
import TaskDetailModal from '../components/modals/TaskDetailModal';
import RejectModal from '../components/modals/RejectModal';
import GiveBackModal from '../components/modals/GiveBackModal';
import AppHeader from '../components/layout/AppHeader';
import dayjs from 'dayjs';

const { Content } = Layout;

const Dashboard: React.FC = () => {
    const { message } = App.useApp();
    const { appUser: user } = useAuth();
    const { status } = useParams<{ status: string }>();
    const navigate = useNavigate();

    // Validate status or default to 'new'
    const validStatuses: OrderStatus[] = ['new', 'doing', 'in_review', 'need_fix', 'done'];
    const activeTab: OrderStatus = (status && validStatuses.includes(status as OrderStatus)) ? (status as OrderStatus) : 'new';

    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');

    // Modal States
    const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [isGiveBackModalOpen, setIsGiveBackModalOpen] = useState(false);

    const isCS = user?.role === 'CS' || user?.role === 'ADMIN';
    const isDS = user?.role === 'DS';

    // 1. Realtime Subscription
    useEffect(() => {
        if (!user) return; // Wait for auth

        setLoading(true);
        let constraints: any[] = [];

        // CS/Admin: Load ALL orders (Rules allow)
        // DS: Must restrict query to match Rules to avoid "Permission Denied"
        if (isDS) {
            // DS Rules:
            // - Can read 'new'
            // - Can read assigned to self

            // To make badges work ideally we need all allowed docs.
            // But we can't OR query 'status==new' OR 'designerId==me' easily in one go.
            // Strategy: Load based on Active Tab to ensure speed and permission success.
            if (activeTab === 'new') {
                constraints.push(where('status', '==', 'new'));
            } else {
                // For 'doing', 'in_review', 'need_fix', 'done' -> Only show assigned
                // Also filter by status to optimize? Yes.
                constraints.push(where('designerId', '==', user.uid));
                constraints.push(where('status', '==', activeTab));
            }
        }

        // If CS, constraints is empty -> fetches all.

        const unsubscribe = subscribeToOrders(
            (fetchedOrders) => {
                setOrders(fetchedOrders);
                setLoading(false);
            },
            (error) => {
                console.error("Subscription error:", error);
                setLoading(false);
                // Only show error if it persists or user needs to know
                if (error?.code === 'permission-denied') {
                    message.error("Không có quyền truy cập dữ liệu tab này.");
                }
            },
            constraints
        );

        return () => unsubscribe();
    }, [user, activeTab, isDS]); // Re-run when Tab changes (crucial for DS queries)

    // 2. Filter & Sort Logic
    const getFilteredOrders = (filterStatus: OrderStatus) => {
        // If CS, 'orders' has EVERYTHING. We filter locally.
        // If DS, 'orders' has ONLY CURRENT TAB data (due to query constraints above).

        let filtered = orders;

        if (isCS) {
            filtered = orders.filter(o => o.status === filterStatus);
        } else {
            // DS: 'orders' is already filtered by query for the *activeTab*.
            // If this function is called for a *different* tab (e.g. Badge count),
            // 'orders' won't contain those items.
            // So Badges will be 0 for non-active tabs. This is expected behavior with this fix.
            // We just ensure we don't show "Active Tab" items in "Other Tab" slots if something overlaps.
            // Actually, the query logic guarantees checking `activeTab` vs `filterStatus`.
            if (filterStatus !== activeTab) {
                return []; // DS Badge 0 for other tabs
            }
            // For the active tab, 'orders' is already correct.
        }

        // Search
        if (searchText) {
            const lowerSearch = searchText.toLowerCase();
            filtered = filtered.filter(o =>
                o.title.toLowerCase().includes(lowerSearch) ||
                o.readableId.toString().includes(lowerSearch) ||
                (o.sku && o.sku.toLowerCase().includes(lowerSearch))
            );
        }

        return sortOrders(filtered);
    };

    // Actions ... (rest remains similar)
    const handleClaim = async (e: React.MouseEvent, order: Order) => {
        e.stopPropagation();
        try {
            await updateOrder(order.id, {
                status: 'doing',
                designerId: user?.uid,
                updatedAt: new Date()
            });
            message.success(`Đã nhận đơn #${order.readableId}.`);
            // The subscription will check constraints. 
            // If DS, 'doing' is NOT 'new'. The item vanishes from this view. Correct.
        } catch (error) {
            message.error('Lỗi khi nhận đơn');
        }
    };

    // ... Copy modal handlers ...
    const handleOpenDetail = (order: Order) => { setSelectedOrder(order); setIsDetailModalOpen(true); };
    const handleOpenReject = (e: React.MouseEvent, order: Order) => { e.stopPropagation(); setSelectedOrder(order); setIsRejectModalOpen(true); };
    const handleOpenGiveBack = (e: React.MouseEvent, order: Order) => { e.stopPropagation(); setSelectedOrder(order); setIsGiveBackModalOpen(true); };

    // Render Card ... (No change)
    const renderOrderCard = (order: Order) => {
        const isUrgent = order.isUrgent;
        return (
            <Card
                key={order.id}
                hoverable
                className={`mb-4 shadow-sm transition-all duration-300 ${isUrgent ? 'border-2 border-red-500 bg-red-50' : 'border-gray-200'}`}
                style={{ borderColor: isUrgent ? '#f5222d' : undefined, backgroundColor: isUrgent ? '#fff1f0' : undefined }}
                onClick={() => handleOpenDetail(order)}
                cover={
                    <div style={{ height: 160, position: 'relative', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {(order.sampleFiles && order.sampleFiles.length > 0) ? (
                            <img alt="sample" src={(order.sampleFiles[0] as any).link || order.sampleFiles[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div className="text-gray-300"><CloudUploadOutlined style={{ fontSize: 32, color: '#ccc' }} /></div>
                        )}
                        {isUrgent && <div style={{ position: 'absolute', top: 0, right: 0, background: '#f5222d', color: '#fff', fontSize: 12, fontWeight: 'bold', padding: '4px 8px', borderRadius: '0 0 0 8px' }}>URGENT 🔥</div>}
                    </div>
                }
                actions={[
                    (isDS && order.status === 'new') ? <Button type="link" onClick={(e) => handleClaim(e, order)} style={{ color: '#eb2f96', fontWeight: 'bold' }}>CLAIM</Button> : null,
                    (isDS && order.status === 'doing') ? <Button type="text" danger icon={<RollbackOutlined />} onClick={(e) => handleOpenGiveBack(e, order)}>Trả đơn</Button> : null,
                    (isCS && order.status === 'in_review') ? <Button type="text" danger onClick={(e) => handleOpenReject(e, order)}>Reject</Button> : null,
                ].filter(Boolean) as React.ReactNode[]}
            >
                <Card.Meta
                    title={
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 16, color: isUrgent ? '#cf1322' : '#262626', maxWidth: '75%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={order.title}>
                                {isUrgent && <FireFilled style={{ marginRight: 4 }} />} {order.title}
                            </span>
                            <span style={{ fontSize: 12, color: '#8c8c8c' }}>#{order.readableId}</span>
                        </div>
                    }
                    description={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8c8c8c' }}>
                                <span><ClockCircleOutlined /> {order.deadline ? dayjs((order.deadline as any).seconds ? (order.deadline as any).seconds * 1000 : order.deadline).format('DD/MM') : 'N/A'}</span>
                                {order.sku && <Tag>{order.sku}</Tag>}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                <Tag color="magenta">{order.category}</Tag>
                                <span style={{ fontWeight: 'bold', color: '#8c8c8c', fontSize: 12 }}>Qty: {order.quantity}</span>
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
        if (filteredOrders.length === 0) return <Empty description="Trống" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
        return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, padding: 16 }}>{filteredOrders.map(renderOrderCard)}</div>;
    };

    const tabItems = [
        { key: 'new', label: <span>New {isCS && <Badge count={getFilteredOrders('new').length} style={{ backgroundColor: '#eb2f96' }} />}</span>, children: renderTabContent('new') },
        { key: 'doing', label: <span>Doing {isCS && <Badge count={getFilteredOrders('doing').length} />}</span>, children: renderTabContent('doing') }, // DS badge removed
        { key: 'in_review', label: <span>In Review {isCS && <Badge count={getFilteredOrders('in_review').length} style={{ backgroundColor: '#52c41a' }} />}</span>, children: renderTabContent('in_review') },
        { key: 'need_fix', label: <span>Need Fix {isCS && <Badge count={getFilteredOrders('need_fix').length} style={{ backgroundColor: '#faad14' }} />}</span>, children: renderTabContent('need_fix') },
        { key: 'done', label: 'Done', children: renderTabContent('done') },
    ];

    return (
        <Layout style={{ minHeight: '100vh', background: '#fff0f6' }}>
            <AppHeader
                onNewTask={isCS ? () => setIsNewTaskModalOpen(true) : undefined}
                searchText={searchText}
                onSearchChange={setSearchText}
            />
            <Content style={{ padding: 24 }}>
                <div style={{ background: '#fff', borderRadius: 12, minHeight: 'calc(100vh - 140px)' }}>
                    <Tabs
                        activeKey={activeTab}
                        onChange={(key) => navigate('/' + key)}
                        items={tabItems}
                        tabBarStyle={{ padding: '0 24px' }}
                        style={{ marginTop: 12 }}
                    />
                </div>
            </Content>

            <NewTaskModal open={isNewTaskModalOpen} onCancel={() => setIsNewTaskModalOpen(false)} onSuccess={() => setIsNewTaskModalOpen(false)} />
            {selectedOrder && (
                <>
                    <TaskDetailModal order={selectedOrder} open={isDetailModalOpen} onCancel={() => { setIsDetailModalOpen(false); setSelectedOrder(null); }} onUpdate={() => { }} />
                    <RejectModal order={selectedOrder} open={isRejectModalOpen} onCancel={() => { setIsRejectModalOpen(false); setSelectedOrder(null); }} onSuccess={() => { }} />
                    <GiveBackModal order={selectedOrder} open={isGiveBackModalOpen} onCancel={() => { setIsGiveBackModalOpen(false); setSelectedOrder(null); }} onSuccess={() => { }} />
                </>
            )}
        </Layout>
    );
};
export default Dashboard;
