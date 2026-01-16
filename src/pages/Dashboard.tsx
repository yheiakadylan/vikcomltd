import React, { useState, useEffect } from 'react';
import { Layout, Tabs, Empty, Spin, App, Pagination } from 'antd';
import { AppstoreOutlined, BarsOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { usePersistedState } from '../hooks/usePersistedState'; // Import hook
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
// Remove dayjs as it is likely not used directly in this file anymore, or keep if needed.
// Checked usage: not used directly except in imports potentially? Wait, let's keep it safe or remove if unused.
// It WAS used in renderOrderCard. Now those are gone.
// Let's remove dayjs import from here.

const { Content } = Layout;

const Dashboard: React.FC<{ mode?: 'fulfill' | 'idea' }> = ({ mode = 'fulfill' }) => {
    const collectionName = mode === 'idea' ? 'ideas' : 'tasks';
    // Remove accentColor variable usage, rely on CSS variables
    const { message } = App.useApp();
    const { appUser: user } = useAuth();
    const { t } = useLanguage();
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

    // Validate status or default to 'new'
    const validStatuses: OrderStatus[] = ['new', 'doing', 'check', 'in_review', 'need_fix', 'done'];
    // const activeTab: OrderStatus = (status && validStatuses.includes(status as OrderStatus)) ? (status as OrderStatus) : 'new'; // Original line
    const [activeTab, setActiveTab] = usePersistedState<string>(`activeTab_${mode}`, 'new'); // Persisted per board

    // Sync URL status to activeTab
    useEffect(() => {
        if (status && validStatuses.includes(status as OrderStatus)) {
            setActiveTab(status);
        }
    }, [status, setActiveTab]);

    // Pagination State
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const pageCursors = React.useRef<Map<number, any>>(new Map());

    const [searchText, setSearchText] = useState('');
    const [executedSearchTerm, setExecutedSearchTerm] = useState('');
    const isAutoSwitchingTab = React.useRef(false);

    // State Separation
    const [tabOrders, setTabOrders] = useState<Order[]>([]);
    const [searchOrders, setSearchOrders] = useState<Order[] | null>(null);
    const [loading, setLoading] = useState(true);

    // Derived Orders for Display
    const orders = React.useMemo(() => {
        return executedSearchTerm ? (searchOrders || []) : tabOrders;
    }, [executedSearchTerm, searchOrders, tabOrders]);

    // View Mode State
    // const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid'); // Original line
    const [viewMode, setViewMode] = usePersistedState<'list' | 'grid'>(`viewMode_${mode}`, 'grid'); // Persisted per board


    // Modal States
    const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [isGiveBackModalOpen, setIsGiveBackModalOpen] = useState(false);

    const isCS = user?.role === 'CS' || user?.role === 'ADMIN';
    const isIdea = user?.role === 'IDEA' || user?.role === 'ADMIN';
    const isDS = user?.role === 'DS' || user?.role === 'ADMIN'; // DS or Admin acts as worker sometimes or just viewer
    const isAdmin = user?.role === 'ADMIN';

    // Permission to Create Task
    const canCreate = mode === 'idea' ? isIdea : isCS;


    // Reset Page on Tab change or Search change
    useEffect(() => {
        setPage(1);
        pageCursors.current.clear();

        if (isAutoSwitchingTab.current) {
            // If switching automatically due to search, DON'T clear search
            isAutoSwitchingTab.current = false;
        } else {
            // Manual tab click -> Clear search (only if tab changed, not search term)
            // But this effect runs on executedSearchTerm too?
            // We want:
            // 1. Tab Change -> Clear Search
            // 2. Search Change -> Reset Page (Handled in onChange/onSearch)
        }
    }, [activeTab]);

    // Separate Effect for Search Mode Switch to reset cursors
    useEffect(() => {
        pageCursors.current.clear();
        if (executedSearchTerm) {
            setSearchOrders([]); // Clear previous search results visually
        }
    }, [executedSearchTerm]);

    // 1. Data Loading (Paginated + Search)
    useEffect(() => {
        if (!user) return;

        let isMounted = true; // Track mount state
        setLoading(true);
        let unsubscribe: (() => void) | undefined;
        let constraints: any[] = [];

        import('../services/firebase').then(({ where, getOrdersCount, subscribeToOrders }) => {
            if (!isMounted) return;

            const isSearchMode = !!executedSearchTerm.trim();

            // SEARCH MODE
            if (isSearchMode) {
                const term = executedSearchTerm.trim();
                console.log("🔍 Server-side Search (ID only):", term);

                // Clean '#' and whitespace
                const cleanId = term.replace(/^#/, '').trim();

                // Search ONLY by readableId
                constraints.push(where('readableId', '==', cleanId));
            }
            // TAB / FILTER MODE
            else {
                // Filtering Logic
                // 1. Strict DS (Regular DS, not Admin acting as DS)
                if (user.role === 'DS') {
                    if (activeTab === 'new') {
                        constraints.push(where('status', '==', 'new'));
                    } else {
                        constraints.push(where('designerId', '==', user.uid));
                        constraints.push(where('status', '==', activeTab));
                    }
                    // DS Restriction: Cannot see check tab (handled by tabItems)
                    // If they visit /check manually, they get no data due to designerId filter (unless they are assigned? No, Check has no assignee per se, but task keeps designerId)
                    // If task is in 'check', DS shouldn't see it?
                    if (activeTab === 'check') {
                        // Force empty
                        constraints.push(where('status', '==', 'impossible_status'));
                    }
                }
                // 2. Admin / CS / Idea
                else {
                    // Standard filtering
                    constraints.push(where('status', '==', activeTab));

                    // APPROVAL LOGIC
                    // For 'in_review', NON-ADMINS (CS, IDEA) must only see approved tasks.
                    // This matches Firestore Rule: status == 'in_review' requires approvedByManager==true (or isMyTask).
                    // We enforce approvedByManager==true here to satisfy the rule for the general list.
                    if (activeTab === 'in_review' && !isAdmin) {
                        console.log("🔒 Securing View: Adding manager approval constraint");
                        constraints.push(where('approvedByManager', '==', true));
                    }

                    // CHECK TAB LOGIC
                    // Only Admin can see Check tab content
                    if (activeTab === 'check' && !isAdmin) {
                        // This should theoretically be handled by the UI not showing the tab, 
                        // but if they force the URL, we block it.
                        constraints.push(where('status', '==', 'impossible_status_block'));
                    }
                }
            }

            // 1. Get Total Count (Only on first page or tab/search change)
            // We should fetch count if page is 1
            if (page === 1) {
                getOrdersCount(constraints, collectionName).then(count => {
                    if (!isMounted) return;
                    setTotal(count);
                    // Handle No Match Alert here or in subscribe?
                    // If count is 0 and we are searching, we know immediately.
                    if (isSearchMode && count === 0) {
                        message.warning(t('dashboard.messages.noOrderFound') || 'Order not found / Không tìm thấy đơn hàng');
                    }
                });
            }

            // 2. Determine Cursor
            const startAfterDoc = page > 1 ? pageCursors.current.get(page - 1) : null;

            // 3. Subscribe
            unsubscribe = subscribeToOrders((newOrders, lastDoc) => {
                if (!isMounted) return;

                // Client-side Security Filter (Crucial for Search Mode)
                // Filter out 'check' tasks for non-Admins
                const safeOrders = newOrders.filter(o => {
                    if (o.status === 'check' && !isAdmin) {
                        return false;
                    }
                    return true;
                });

                // ROUTE DATA TO CORRECT STATE
                if (isSearchMode) {
                    setSearchOrders(safeOrders);
                } else {
                    setTabOrders(safeOrders);
                    setSearchOrders(null); // Ensure search is null when in tab mode
                }

                if (lastDoc) {
                    pageCursors.current.set(page, lastDoc);
                }

                // Auto-Switch Tab Logic
                if (isSearchMode && safeOrders.length > 0) {
                    const foundOrder = safeOrders[0]; // Assuming ID search returns 1 result
                    // Check if order is in a different tab and valid status
                    if (validStatuses.includes(foundOrder.status) && foundOrder.status !== activeTab) {
                        console.log(`Auto - switching tab from ${activeTab} to ${foundOrder.status} `);
                        isAutoSwitchingTab.current = true;
                        // Use correct board path
                        navigate(`/board/${mode === 'idea' ? 'idea' : 'fulfill'}/${foundOrder.status}`);
                    }
                } else if (isSearchMode && newOrders.length > 0 && safeOrders.length === 0) {
                    // Case: Found in DB but filtered out by Security
                    message.warning(t('dashboard.messages.noPermission') || 'No permission to view this task');
                }

                setLoading(false);
            }, (error) => {
                if (!isMounted) return;
                console.error("Error:", error);
                setLoading(false);
                if (error?.code === 'permission-denied') message.error(t('dashboard.messages.noPermission'));
            }, constraints, pageSize, startAfterDoc, collectionName);
        });

        return () => {
            isMounted = false; // Mark unmounted
            if (unsubscribe) unsubscribe();
        };
        // Dependency Trick: When searching, changes to activeTab should NOT trigger re-fetch.
        // We use a conditional dependency: if executedSearchTerm is set, we pass a static string instead of activeTab.
    }, [user, executedSearchTerm ? (mode === 'idea' ? 'search_idea' : 'search_task') : activeTab, isDS, page, pageSize, executedSearchTerm, collectionName, mode, isAdmin]);

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
                                    value={searchText}
                                    onChange={(val) => {
                                        setSearchText(val);
                                        // Auto-clear logic
                                        if (!val) {
                                            setExecutedSearchTerm('');
                                            setPage(1);
                                        }
                                    }}
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
                            <TaskDetailModal order={selectedOrder} open={isDetailModalOpen} onCancel={() => { setIsDetailModalOpen(false); setSelectedOrder(null); }} onUpdate={() => { }} />
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
