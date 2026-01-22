import React, { useState, useEffect } from 'react';
import { Layout, Tabs, Empty, Spin, App, Pagination } from 'antd';
import { AppstoreOutlined, BarsOutlined } from '@ant-design/icons';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useOrders } from '../contexts/OrdersContext'; // Import Context
import { usePersistedState } from '../hooks/usePersistedState';
import type { Order, OrderStatus } from '../types';
import { deleteOrder } from '../services/firebase';
import { generateStoragePath } from '../utils/order';
import { sortOrders } from '../utils/sortOrders';

// Lazy load modals for performance
const NewTaskModal = React.lazy(() => import('../components/modals/NewTaskModal'));
const TaskDetailModal = React.lazy(() => import('../components/modals/TaskDetailModal'));
const RejectModal = React.lazy(() => import('../components/modals/RejectModal'));
const GiveBackModal = React.lazy(() => import('../components/modals/GiveBackModal'));
import AppHeader from '../components/layout/AppHeader';
import SearchInput from '../components/common/SearchInput';
import OrderCard from '../components/dashboard/OrderCard';
import OrderRow from '../components/dashboard/OrderRow';

const { Content } = Layout;

const Dashboard: React.FC<{ mode?: 'fulfill' | 'idea' }> = ({ mode = 'fulfill' }) => {
    const collectionName = mode === 'idea' ? 'ideas' : 'tasks';
    const { message } = App.useApp();
    const { appUser: user } = useAuth();
    const { t } = useLanguage();
    const { registerView, views } = useOrders(); // Use Context
    const { status } = useParams<{ status: string }>();
    const navigate = useNavigate();

    // Theme Effect
    useEffect(() => {
        if (mode === 'idea') {
            document.body.classList.add('theme-idea');
        } else {
            document.body.classList.remove('theme-idea');
        }
        return () => {
            document.body.classList.remove('theme-idea');
        };
    }, [mode]);

    // url params...
    const [searchParams, setSearchParams] = useSearchParams();
    const activePage = parseInt(searchParams.get('page') || '1', 10);
    const activePageSize = parseInt(searchParams.get('pageSize') || '25', 10);
    const activeSearch = searchParams.get('q') || '';
    const activeTaskId = searchParams.get('taskId');

    // DEEP LINKING: Check for 'taskId' in URL
    useEffect(() => {
        if (activeTaskId) {
            import('../services/firebase').then(async ({ db }) => {
                try {
                    const docRef = doc(db, collectionName, activeTaskId);
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        const orderData = { id: snap.id, ...snap.data(), collectionName } as Order;
                        setSelectedOrder(orderData);
                        setIsDetailModalOpen(true);
                    } else {
                        // Handle 404 Case?
                        console.warn("Deep linked task not found");
                    }
                } catch (e) {
                    console.error("Deep link fetch failed", e);
                }
            });
        } else {
            // Close modal if URL param is missing (e.g. Back button)
            setIsDetailModalOpen(false);
            setSelectedOrder(null);
        }
    }, [activeTaskId, collectionName]);

    const validStatuses: OrderStatus[] = ['new', 'doing', 'check', 'in_review', 'need_fix', 'done'];
    const [activeTab, setActiveTab] = usePersistedState<string>(`activeTab_${mode}`, 'new');

    useEffect(() => {
        if (status && validStatuses.includes(status as OrderStatus)) {
            setActiveTab(status);
        }
    }, [status, setActiveTab]);

    const [total, setTotal] = useState(0);

    // Cursors for Pagination
    const pageCursors = React.useRef<Map<number, any>>(new Map());
    const isAutoSwitchingTab = React.useRef(false);

    // Dialog States
    const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [isGiveBackModalOpen, setIsGiveBackModalOpen] = useState(false);

    const isCS = user?.role === 'CS' || user?.role === 'ADMIN';
    const isIdea = user?.role === 'IDEA' || user?.role === 'ADMIN';
    const isDS = user?.role === 'DS' || user?.role === 'ADMIN';
    const isAdmin = user?.role === 'ADMIN';
    const canCreate = mode === 'idea' ? isIdea : isCS;

    const [viewMode, setViewMode] = usePersistedState<'list' | 'grid'>(`viewMode_${mode}`, 'grid');

    // 1. Compute Cache Key
    const viewKey = React.useMemo(() => {
        if (activeSearch) return `${collectionName}_search_${activeSearch}_p${activePage}`;
        // Unique key for each view configuration
        const roleSuffix = user?.role === 'DS' && activeTab !== 'new' ? `_${user.uid}` : '';
        return `${collectionName}_tab_${activeTab}_p${activePage}${roleSuffix}`;
    }, [collectionName, activeSearch, activePage, activeTab, user]);

    // 2. Get Data from Context
    const viewState = views[viewKey] || { data: [], loading: true, lastDoc: null };
    const orders = viewState.data;
    const loading = viewState.loading && views[viewKey] === undefined; // Only load if not cached

    // 3. Sync Cursors (Backwards compatibility for pagination)
    useEffect(() => {
        if (viewState.lastDoc) {
            pageCursors.current.set(activePage, viewState.lastDoc);
        }
    }, [viewState.lastDoc, activePage]);

    // 4. Data Fetching Effect
    useEffect(() => {
        if (!user) return;

        let isMounted = true;
        let constraints: any[] = [];

        import('../services/firebase').then(({ where, getOrdersCount }) => {
            if (!isMounted) return;

            const isSearchMode = !!activeSearch.trim();

            if (isSearchMode) {
                const term = activeSearch.trim();
                const cleanId = term.replace(/^#/, '').trim();
                constraints.push(where('readableId', '==', cleanId));
            } else {
                if (user.role === 'DS') {
                    if (activeTab === 'new') {
                        constraints.push(where('status', '==', 'new'));
                    } else {
                        constraints.push(where('designerId', '==', user.uid));
                        constraints.push(where('status', '==', activeTab));
                    }
                    if (activeTab === 'check') {
                        constraints.push(where('status', '==', 'impossible_status'));
                    }
                } else {
                    constraints.push(where('status', '==', activeTab));
                    if (activeTab === 'in_review' && !isAdmin) {
                        constraints.push(where('approvedByManager', '==', true));
                    }
                    if (activeTab === 'check' && !isAdmin) {
                        constraints.push(where('status', '==', 'impossible_status_block'));
                    }
                }
            }

            // Count logic
            if (activePage === 1) {
                // We re-count on first page load or tab switch
                getOrdersCount(constraints, collectionName).then(count => {
                    if (!isMounted) return;
                    setTotal(count);
                    if (isSearchMode && count === 0) {
                        // Optional: Warning
                    }
                });
            }

            // Determine Cursor
            const startAfterDoc = activePage > 1 ? pageCursors.current.get(activePage - 1) : null;

            // REGISTER VIEW (This triggers the subscription if needed)
            registerView(viewKey, constraints, collectionName, activePageSize, startAfterDoc);

            // Auto Switch Logic (If search returns result in different tab)
            // Implementation note: Ideally this sits in the Context or a separate effect watching 'orders'.
            // For now, we simplify and assume if we search, we stay put, or simple redirect if 'status' differs.
            if (isSearchMode && orders.length > 0) {
                const found = orders[0];
                if (validStatuses.includes(found.status) && found.status !== activeTab) {
                    if (!isAutoSwitchingTab.current) {
                        console.log(`Auto - switching tab from ${activeTab} to ${found.status} `);
                        isAutoSwitchingTab.current = true;
                        navigate(`/board/${mode === 'idea' ? 'idea' : 'fulfill'}/${found.status}?q=${activeSearch}`);
                    }
                }
            }

        });

        return () => {
            isMounted = false;
        };
    }, [viewKey, user, registerView]); // Depend on viewKey to re-trigger



    // Clear cursors on tab change
    useEffect(() => {
        // Reset cursors only if tab actually changes
        if (!activeSearch) pageCursors.current.clear();
    }, [activeTab]);

    const handlePageChange = (p: number, ps: number) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.set('page', p.toString());
            newParams.set('pageSize', ps.toString());
            return newParams;
        });
    };

    // Use server-fetched data directly (already filtered)
    const filteredOrders = React.useMemo(() => {
        return sortOrders(orders);
    }, [orders]);

    // Actions
    const handleOpenDetail = React.useCallback((order: Order) => {
        setSelectedOrder(order);
        setIsDetailModalOpen(true);
        setSearchParams(prev => {
            const p = new URLSearchParams(prev);
            p.set('taskId', order.id);
            return p;
        });
    }, [setSearchParams]);

    const handleOpenGiveBack = React.useCallback((e: React.MouseEvent, order: Order) => {
        e.stopPropagation();
        setSelectedOrder(order);
        setIsGiveBackModalOpen(true);
    }, []);



    const handleDelete = React.useCallback(async (order: Order) => {
        try {
            const prefix = order.storagePath || generateStoragePath(order as any, collectionName);

            await deleteOrder(order.id, prefix, collectionName);
            message.success(t('dashboard.messages.deleteSuccess'));
        } catch (error) {
            console.error("Delete Error:", error);
            message.error(t('dashboard.messages.deleteError'));
        }
    }, [collectionName, t, message]); // Removed 'orders' dependency


    const handleQuickApprove = React.useCallback(async (e: React.MouseEvent, order: Order) => {
        e.stopPropagation();
        try {
            import('../services/firebase').then(async ({ updateOrder, addOrderLog }) => {
                await updateOrder(order.id, {
                    status: 'in_review',
                    approvedByManager: true
                }, true, order.collectionName);
                await addOrderLog(order.id, {
                    action: 'manager_approve',
                    actorId: user?.uid || 'admin',
                    actorName: user?.displayName || 'Manager',
                    actorDisplayName: user?.displayName,
                    actionType: 'manager_approve',
                    actionLabel: 'Manager Approved',
                    details: 'Manager Approved (Quick Action)'
                }, order.collectionName);
                message.success('Approved');
            });
        } catch (err) { message.error('Failed'); }
    }, [user, message]);

    const handleQuickReject = React.useCallback(async (e: React.MouseEvent, order: Order) => {
        e.stopPropagation();
        // For reject, maybe we need a reason? Quick Reject might need default reason or open modal.
        // Prompt says "Thông báo confirm trước khi action".
        // Let's just open the Reject Modal or Detail Modal?
        // "Nút Approve / Reject". If Reject requires reason, maybe open RejectModal directly?
        setSelectedOrder(order);
        setIsRejectModalOpen(true);
    }, []);

    // Memoize tab content to prevent re-render when switching tabs
    const tabContent = React.useMemo(() => {
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
                            isCS={canCreate} // Pass Creator role validity for edit/delete actions
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
                        isCS={canCreate}
                        isDS={(isDS || user?.role === 'ADMIN') && order.designerId === user?.uid} // Only show DS actions (Give Back) if I AM the assigned designer
                        isAdmin={isAdmin}
                        onOpenDetail={handleOpenDetail}
                        onOpenGiveBack={handleOpenGiveBack}
                        onDelete={handleDelete}
                        onQuickApprove={handleQuickApprove}
                        onQuickReject={handleQuickReject}
                    />
                ))}
            </div>
        );
    }, [loading, filteredOrders, viewMode, t, isCS, isDS, user, isAdmin, handleOpenDetail, handleOpenGiveBack, handleDelete, handleQuickApprove, handleQuickReject]);


    const tabItems = [
        { key: 'new', label: t('dashboard.tabs.new'), children: null },
        { key: 'doing', label: t('dashboard.tabs.doing'), children: null },
        ...(isAdmin ? [{ key: 'check', label: t('dashboard.tabs.check'), children: null }] : []), // Conditional Check Tab
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
        <Layout style={{ minHeight: '100vh', background: 'var(--primary-bg)' }}>
            <AppHeader
                onNewTask={canCreate ? () => setIsNewTaskModalOpen(true) : undefined}
            />
            <Content style={{ padding: 18 }}>
                <div style={{ background: '#fff', borderRadius: 12, minHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: '80px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px' }}>
                        <Tabs
                            activeKey={activeTab}
                            onChange={(key) => navigate(`/board/${mode === 'idea' ? 'idea' : 'fulfill'}/${key}`)}
                            items={tabItems}
                            tabBarStyle={{ margin: 0, border: 'none' }}
                            style={{ flex: 1 }}
                            tabBarExtraContent={
                                <SearchInput
                                    value={activeSearch}
                                    onChange={(val) => {
                                        // Auto-clear logic only
                                        if (!val) {
                                            setSearchParams(prev => {
                                                const p = new URLSearchParams(prev);
                                                p.delete('q');
                                                p.set('page', '1');
                                                return p;
                                            });
                                        }
                                    }}
                                    onSearch={(val) => {
                                        setSearchParams(prev => {
                                            const p = new URLSearchParams(prev);
                                            if (val) p.set('q', val);
                                            else p.delete('q');
                                            p.set('page', '1');
                                            return p;
                                        });
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
                            current={activePage}
                            total={total}
                            pageSize={activePageSize}
                            onChange={handlePageChange}
                            showSizeChanger={false}
                            pageSizeOptions={['25']}
                            showTotal={(total, range) => `${range[0]} -${range[1]} ${t('dashboard.pagination.of')} ${total} ${t('dashboard.pagination.items')} `}
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
                        {tabContent}
                    </div>
                </div>
            </Content>

            {/* Lazy Load Modals */}
            <React.Suspense fallback={null}>
                <NewTaskModal
                    open={isNewTaskModalOpen}
                    onCancel={() => setIsNewTaskModalOpen(false)}
                    onSuccess={() => setIsNewTaskModalOpen(false)}
                    collectionName={collectionName}
                    mode={mode}
                />
                {
                    selectedOrder && (
                        <>
                            <TaskDetailModal
                                order={selectedOrder}
                                open={isDetailModalOpen}
                                onCancel={() => {
                                    setIsDetailModalOpen(false);
                                    setSelectedOrder(null);
                                    setSearchParams(prev => {
                                        const p = new URLSearchParams(prev);
                                        p.delete('taskId');
                                        return p;
                                    });
                                }}
                                onUpdate={() => { }}
                            />
                            <RejectModal order={selectedOrder} open={isRejectModalOpen} onCancel={() => { setIsRejectModalOpen(false); setSelectedOrder(null); }} onSuccess={() => { }} />
                            <GiveBackModal order={selectedOrder} open={isGiveBackModalOpen} onCancel={() => { setIsGiveBackModalOpen(false); setSelectedOrder(null); }} onSuccess={() => { }} />
                        </>
                    )
                }
            </React.Suspense>
        </Layout >
    );
};

export default Dashboard;
