import React, { useState, useEffect } from 'react';
import { Layout, Tabs, Button, Card, Tag, Empty, Spin, App, Popconfirm, Image, Pagination } from 'antd';
import { FireFilled, ClockCircleOutlined, CloudUploadOutlined, RollbackOutlined, DeleteOutlined, AppstoreOutlined, BarsOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Order, OrderStatus } from '../types';
import { deleteOrder } from '../services/firebase';
import { sortOrders } from '../utils/sortOrders';
import NewTaskModal from '../components/modals/NewTaskModal';
import TaskDetailModal from '../components/modals/TaskDetailModal';
import RejectModal from '../components/modals/RejectModal';
import GiveBackModal from '../components/modals/GiveBackModal';
import AppHeader from '../components/layout/AppHeader';
import SearchInput from '../components/common/SearchInput';
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

    // Pagination State
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const pageCursors = React.useRef<Map<number, any>>(new Map());

    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');

    // View Mode State
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Modal States
    const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [isGiveBackModalOpen, setIsGiveBackModalOpen] = useState(false);

    const isCS = user?.role === 'CS' || user?.role === 'ADMIN';
    const isDS = user?.role === 'DS';

    // Reset Page on Tab change
    useEffect(() => {
        setPage(1);
        pageCursors.current.clear();
    }, [activeTab]);

    // 1. Data Loading (Paginated)
    useEffect(() => {
        if (!user) return;

        setLoading(true);
        let unsubscribe: (() => void) | undefined;
        let constraints: any[] = [];

        // Build Constraints based on Role & Tab
        import('../services/firebase').then(({ where }) => {
            if (isDS) {
                if (activeTab === 'new') {
                    constraints.push(where('status', '==', 'new'));
                } else {
                    constraints.push(where('designerId', '==', user.uid));
                    constraints.push(where('status', '==', activeTab));
                }
            } else {
                if (activeTab !== 'new' && activeTab !== 'doing' && activeTab !== 'in_review' && activeTab !== 'need_fix' && activeTab !== 'done') {
                    // If unexpected tab, maybe fetch all? Or stick to known statuses.
                    // The View 'all' is not in tabs.
                    constraints.push(where('status', '==', activeTab));
                } else {
                    constraints.push(where('status', '==', activeTab));
                }
            }

            // 1. Get Total Count (Only on first page or tab change)
            if (page === 1) {
                import('../services/firebase').then(({ getOrdersCount }) => {
                    getOrdersCount(constraints).then(count => setTotal(count));
                });
            }

            // 2. Determine Cursor
            const startAfterDoc = page > 1 ? pageCursors.current.get(page - 1) : null;

            // 3. Subscribe
            import('../services/firebase').then(({ subscribeToOrders }) => {
                unsubscribe = subscribeToOrders((newOrders, lastDoc) => {
                    setOrders(newOrders);
                    if (lastDoc) {
                        pageCursors.current.set(page, lastDoc);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Error:", error);
                    setLoading(false);
                    if (error?.code === 'permission-denied') message.error('Không có quyền truy cập.');
                }, constraints, pageSize, startAfterDoc);
            });
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [user, activeTab, isDS, page, pageSize]); // Dependencies

    const handlePageChange = (p: number, ps: number) => {
        setPage(p);
        setPageSize(ps);
    };

    // Client-side Search (on current page data)
    const filteredOrders = React.useMemo(() => {
        let res = orders;
        if (searchText) {
            const lower = searchText.toLowerCase();
            res = res.filter(o =>
                o.title.toLowerCase().includes(lower) ||
                o.readableId.toString().includes(lower) ||
                (o.sku && o.sku.toLowerCase().includes(lower))
            );
        }
        return sortOrders(res);
    }, [orders, searchText]);

    // Actions
    const handleOpenDetail = (order: Order) => { setSelectedOrder(order); setIsDetailModalOpen(true); };
    const handleOpenGiveBack = (e: React.MouseEvent, order: Order) => { e.stopPropagation(); setSelectedOrder(order); setIsGiveBackModalOpen(true); };
    const handleDelete = async (orderId: string) => {
        try {
            await deleteOrder(orderId);
            message.success('Đã xóa task.');
        } catch (error) {
            message.error('Lỗi khi xóa task');
        }
    };

    const renderOrderCard = (order: Order) => {
        const isUrgent = order.isUrgent;
        const deadlineDisplay = order.deadline
            ? dayjs((order.deadline as any).seconds ? (order.deadline as any).seconds * 1000 : order.deadline).format('DD/MM')
            : null;

        const formatDropboxUrl = (url?: string) => {
            if (!url) return '';
            if (url.includes('?') && url.lastIndexOf('?') > url.indexOf('?')) return url.replace(/\?raw=1$/, '&raw=1');
            if (url.includes('raw=1')) return url;
            if (url.includes('dropbox.com')) {
                const clean = url.replace('?dl=0', '').replace('&dl=0', '');
                return clean + (clean.includes('?') ? '&' : '?') + 'raw=1';
            }
            return url;
        };

        return (
            <Card
                key={order.id}
                hoverable
                className={`mb-4 shadow-sm transition-all duration-300 ${isUrgent ? 'border-2 border-red-500 bg-red-50' : 'border-gray-200'}`}
                style={{ borderColor: isUrgent ? '#f5222d' : undefined, backgroundColor: isUrgent ? '#fff1f0' : undefined }}
                onClick={() => handleOpenDetail(order)}
                cover={
                    <div style={{ height: 180, position: 'relative', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {order.mockupUrl ? (
                            <Image
                                alt="mockup"
                                src={formatDropboxUrl(order.mockupUrl)}
                                preview={false}
                                width="100%"
                                height="100%"
                                style={{ objectFit: 'cover' }}
                                fallback="https://placehold.co/400x300/e6e6e6/a3a3a3?text=No+Image"
                            />
                        ) : (
                            <div className="text-gray-300"><CloudUploadOutlined style={{ fontSize: 32, color: '#ccc' }} /></div>
                        )}
                        {isUrgent && <div style={{ position: 'absolute', top: 0, right: 0, background: '#f5222d', color: '#fff', fontSize: 12, fontWeight: 'bold', padding: '4px 8px', borderRadius: '0 0 0 8px' }}> 🔥</div>}
                        {isCS && (
                            <div style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 10 }} onClick={e => e.stopPropagation()}>
                                <Popconfirm title="Xóa task?" onConfirm={() => handleDelete(order.id)} onCancel={(e) => e?.stopPropagation()} okText="Xóa" cancelText="Hủy">
                                    <Button shape="circle" size="small" danger icon={<DeleteOutlined />} style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                                </Popconfirm>
                            </div>
                        )}
                    </div>
                }
                actions={[
                    (isDS && order.status === 'doing') ? <Button type="text" danger icon={<RollbackOutlined />} onClick={(e) => handleOpenGiveBack(e, order)}>Trả đơn</Button> : null,
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
                            {order.sku && <Tag color="blue" style={{ margin: 0, border: 'none', background: '#e6f7ff', color: '#1890ff' }}>{order.sku}</Tag>}
                        </div>
                    }
                />
            </Card>
        );
    };

    const renderOrderRow = (order: Order) => {
        const isUrgent = order.isUrgent;
        const deadlineDisplay = order.deadline
            ? dayjs((order.deadline as any).seconds ? (order.deadline as any).seconds * 1000 : order.deadline).format('DD/MM')
            : null;

        return (
            <div
                key={order.id}
                className={`cinematic-row-card ${isUrgent ? 'border-red-500 bg-red-50' : ''}`}
                style={{ borderColor: isUrgent ? '#f5222d' : undefined }}
                onClick={() => handleOpenDetail(order)}
            >
                <div style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', marginRight: 16, flexShrink: 0 }}>
                    {order.mockupUrl ? (
                        <Image
                            src={order.mockupUrl}
                            preview={false}
                            width="100%"
                            height="100%"
                            style={{ objectFit: 'cover' }}
                            fallback="https://placehold.co/80x80/e6e6e6/a3a3a3?text=Img"
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
                        {order.sku && <Tag color="blue" style={{ margin: 0 }}>{order.sku}</Tag>}
                        <span style={{ fontSize: 13, color: '#666', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {order.description || 'No desc'}
                        </span>
                    </div>
                </div>
                {isCS && (
                    <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 12 }}>
                        <Popconfirm title="Xóa?" onConfirm={() => handleDelete(order.id)} onCancel={(e) => e?.stopPropagation()} okText="Xóa" cancelText="Hủy">
                            <Button type="text" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()} />
                        </Popconfirm>
                    </div>
                )}
            </div>
        );
    };

    const renderTabContent = () => {
        if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin size="large" /></div>;
        if (filteredOrders.length === 0) return <Empty description="Trống" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

        if (viewMode === 'list') {
            return <div style={{ padding: 16 }}>{filteredOrders.map(renderOrderRow)}</div>;
        }
        return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, padding: 16 }}>{filteredOrders.map(renderOrderCard)}</div>;
    };

    const tabItems = [
        { key: 'new', label: 'New', children: null },
        { key: 'doing', label: 'Doing', children: null },
        { key: 'in_review', label: 'In Review', children: null },
        { key: 'need_fix', label: 'Need Fix', children: null },
        { key: 'done', label: 'Done', children: null },
    ];
    // Note: Children are handled by common renderTabContent, but Ant Tabs expects 'children' if using Items.
    // Actually we render content BELOW Tabs, not inside, to keep Pagination cleanly separate?
    // OR we render Pagination INSIDE each Tab?
    // User requested: "thanh kiểu như này nằm ngay dưới thanh tab".
    // So: [Tabs Bar]
    //     [Pagination Bar]
    //     [Grid Content]
    // This implies Tabs operates as a Filter Controller, not carrying content directly?
    // AntD Tabs usually switches content.
    // Strategy: Render Pagination + Grid in the `children` of ALL tabs? Or just have Tabs be Header and content is outside?
    // If Tabs is just header, we can use `renderTabBar` or just `items` without children and handle content separately.
    // Let's use `items` with empty children and render content below.

    return (
        <Layout style={{ minHeight: '100vh', background: '#fff0f6' }}>
            <AppHeader
                onNewTask={isCS ? () => setIsNewTaskModalOpen(true) : undefined}
            />
            <Content style={{ padding: 18 }}>
                <div style={{ background: '#fff', borderRadius: 12, minHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{height:'80px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px' }}>
                        <Tabs
                            activeKey={activeTab}
                            onChange={(key) => navigate('/' + key)}
                            items={tabItems}
                            tabBarStyle={{ margin: 0, border: 'none' }}
                            style={{ flex: 1 }}
                            tabBarExtraContent={
                                <SearchInput
                                    value={searchText}
                                    onChange={setSearchText}
                                    style={{ width: 300 }}
                                />
                            }
                        />
                    </div>

                    {/* Pagination Bar (Cinematic) */}
                    <div style={{
                        padding: '12px 24px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#fafafa',
                        borderBottom: '1px solid #eee'
                    }}>
                        <Pagination
                            className="cinematic-pagination"
                            current={page}
                            total={total}
                            pageSize={pageSize}
                            onChange={handlePageChange}
                            showSizeChanger={false}
                            pageSizeOptions={['25']}
                            showTotal={(total, range) => `${range[0]}-${range[1]} of ${total} items`}
                            size="small"
                        />
                        <div style={{ display: 'flex', gap: 8, background: '#fff', padding: 4, borderRadius: 8, border: '1px solid #eee' }}>
                            <AppstoreOutlined
                                className={`view-switcher-icon ${viewMode === 'grid' ? 'active' : ''}`}
                                onClick={() => setViewMode('grid')}
                            />
                            <BarsOutlined
                                className={`view-switcher-icon ${viewMode === 'list' ? 'active' : ''}`}
                                onClick={() => setViewMode('list')}
                            />
                        </div>
                    </div>

                    <div style={{ flex: 1 }}>
                        {renderTabContent()}
                    </div>
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
