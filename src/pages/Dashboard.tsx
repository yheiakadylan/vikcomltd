import React, { useState, useEffect } from 'react';
import { Layout, Tabs, Empty, Spin, App, Pagination } from 'antd';
import { AppstoreOutlined, BarsOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { Order, OrderStatus } from '../types';
import { deleteOrder } from '../services/firebase';
import { sortOrders } from '../utils/sortOrders';
import NewTaskModal from '../components/modals/NewTaskModal';
import TaskDetailModal from '../components/modals/TaskDetailModal';
import RejectModal from '../components/modals/RejectModal';
import GiveBackModal from '../components/modals/GiveBackModal';
import AppHeader from '../components/layout/AppHeader';
import SearchInput from '../components/common/SearchInput';
import OrderCard from '../components/dashboard/OrderCard';
import OrderRow from '../components/dashboard/OrderRow';
// Remove dayjs as it is likely not used directly in this file anymore, or keep if needed.
// Checked usage: not used directly except in imports potentially? Wait, let's keep it safe or remove if unused.
// It WAS used in renderOrderCard. Now those are gone.
// Let's remove dayjs import from here.

const { Content } = Layout;

const Dashboard: React.FC = () => {
    const { message } = App.useApp();
    const { appUser: user } = useAuth();
    const { t } = useLanguage();
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
    const [executedSearchTerm, setExecutedSearchTerm] = useState('');

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
        // Don't reset executedSearchTerm here usually, but if tab changes, maybe we should?
        // Let's keep search term active even on tab change? Or clear it?
        // Usually tabs filtered by 'search' means global search ignores tabs.
        // If we switch TABS, do we clear search?
        // User behavior: if I search #1005, I see result. If I click "New", do I expect to see #1005 or New list?
        // I expect to see New list. So clear search.
        if (executedSearchTerm) {
            setSearchText('');
            setExecutedSearchTerm('');
        }
    }, [activeTab]);

    // 1. Data Loading (Paginated + Search)
    useEffect(() => {
        if (!user) return;

        setLoading(true);
        let unsubscribe: (() => void) | undefined;
        let constraints: any[] = [];

        import('../services/firebase').then(({ where }) => {
            // SEARCH MODE
            if (executedSearchTerm.trim()) {
                const term = executedSearchTerm.trim();
                console.log("🔍 Server-side Search (ID only):", term);

                // Clean '#' and whitespace
                const cleanId = term.replace(/^#/, '').trim();

                // Search ONLY by readableId
                constraints.push(where('readableId', '==', cleanId));
            }
            // TAB / FILTER MODE
            else {
                if (isDS) {
                    if (activeTab === 'new') {
                        constraints.push(where('status', '==', 'new'));
                    } else {
                        constraints.push(where('designerId', '==', user.uid));
                        constraints.push(where('status', '==', activeTab));
                    }
                } else {
                    if (activeTab !== 'new' && activeTab !== 'doing' && activeTab !== 'in_review' && activeTab !== 'need_fix' && activeTab !== 'done') {
                        constraints.push(where('status', '==', activeTab));
                    } else {
                        constraints.push(where('status', '==', activeTab));
                    }
                }
            }

            // 1. Get Total Count (Only on first page or tab/search change)
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
                    if (error?.code === 'permission-denied') message.error(t('dashboard.messages.noPermission'));
                }, constraints, pageSize, startAfterDoc);
            });
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [user, activeTab, isDS, page, pageSize, executedSearchTerm]); // Add executedSearchTerm dependency

    const handlePageChange = (p: number, ps: number) => {
        setPage(p);
        setPageSize(ps);
    };

    // Use server-fetched data directly (already filtered)
    const filteredOrders = React.useMemo(() => {
        return sortOrders(orders);
    }, [orders]);

    // Actions
    const handleOpenDetail = React.useCallback((order: Order) => { setSelectedOrder(order); setIsDetailModalOpen(true); }, []);

    const handleOpenGiveBack = React.useCallback((e: React.MouseEvent, order: Order) => {
        e.stopPropagation();
        setSelectedOrder(order);
        setIsGiveBackModalOpen(true);
    }, []);

    const handleDelete = React.useCallback(async (orderId: string) => {
        try {
            await deleteOrder(orderId);
            message.success(t('dashboard.messages.deleteSuccess'));
        } catch (error) {
            message.error(t('dashboard.messages.deleteError'));
        }
    }, [message]);

    const renderTabContent = () => {
        if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin size="large" /></div>;
        if (filteredOrders.length === 0) return <Empty description={t('dashboard.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />;

        if (viewMode === 'list') {
            return (
                <div style={{ padding: 16 }}>
                    {filteredOrders.map(order => (
                        <OrderRow
                            key={order.id}
                            order={order}
                            isUrgent={order.isUrgent}
                            isCS={isCS}
                            onOpenDetail={handleOpenDetail}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            );
        }
        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, padding: 16 }}>
                {filteredOrders.map(order => (
                    <OrderCard
                        key={order.id}
                        order={order}
                        isUrgent={order.isUrgent}
                        isCS={isCS}
                        isDS={isDS}
                        onOpenDetail={handleOpenDetail}
                        onOpenGiveBack={handleOpenGiveBack}
                        onDelete={handleDelete}
                    />
                ))}
            </div>
        );
    };

    const tabItems = [
        { key: 'new', label: t('dashboard.tabs.new'), children: null },
        { key: 'doing', label: t('dashboard.tabs.doing'), children: null },
        { key: 'in_review', label: t('dashboard.tabs.in_review'), children: null },
        { key: 'need_fix', label: t('dashboard.tabs.need_fix'), children: null },
        { key: 'done', label: t('dashboard.tabs.done'), children: null },
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
                    <div style={{ height: '80px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px' }}>
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
                                    onSearch={(val) => {
                                        setExecutedSearchTerm(val);
                                        setPage(1);
                                    }}
                                    style={{ width: 300 }}
                                    placeholder={t('dashboard.searchPlaceholder')}
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
                            showTotal={(total, range) => `${range[0]}-${range[1]} ${t('dashboard.pagination.of')} ${total} ${t('dashboard.pagination.items')}`}
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
