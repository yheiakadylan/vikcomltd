import React, { useState, useEffect } from 'react';
import { Layout, Button, Tabs, Typography, Input, Avatar, Dropdown, Tag, List, Card, message } from 'antd';
import type { MenuProps } from 'antd';
import { UserOutlined, SearchOutlined, PlusOutlined, FireOutlined, LogoutOutlined, CloudSyncOutlined } from '@ant-design/icons';
import { colors } from '../theme/themeConfig';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import NewTaskModal from '../components/modals/NewTaskModal';
import TaskDetailModal from '../components/modals/TaskDetailModal';
import type { Order } from '../types';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getAuthUrl, isAuthenticated } from '../services/dropbox';
import { sortOrders } from '../utils/sortOrders';

const { Header, Content } = Layout;

const Dashboard: React.FC = () => {
    const { appUser, logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('new');
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // Data state
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    const items = [
        { label: <span><FireOutlined /> New</span>, key: 'new' },
        { label: 'Doing', key: 'doing' },
        { label: 'In Review', key: 'in_review' },
        { label: 'Need Fix', key: 'need_fix' },
        { label: 'Done', key: 'done' },
        { label: 'Archived', key: 'archived' },
    ];

    useEffect(() => {
        if (!appUser) return;

        // Build query based on Role and Tab
        // Simplified fetching ALL for now, will filter in memory or specific queries later based on spec
        // TODO: Implement RBAC filtering here

        let q;
        if (appUser.role === 'DS' && activeTab !== 'new') {
            q = query(collection(db, "orders"), where("status", "==", activeTab), where("designerId", "==", appUser.uid));
        } else {
            q = query(collection(db, "orders"), where("status", "==", activeTab));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched: Order[] = [];
            snapshot.forEach((doc) => {
                fetched.push({ id: doc.id, ...doc.data() } as Order);
            });

            setOrders(sortOrders(fetched));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [activeTab, appUser]);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const handleConnectDropbox = async () => {
        try {
            const url = await getAuthUrl();
            window.location.href = url as string;
        } catch (e) {
            message.error("Could not initiate Dropbox connection");
        }
    };

    const userMenuItems: MenuProps['items'] = [
        {
            key: 'profile',
            label: (
                <div style={{ padding: '4px 0' }}>
                    <div style={{ fontWeight: 600 }}>{appUser?.displayName || 'User'}</div>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>{appUser?.role}</div>
                </div>
            ),
            disabled: true,
        },
        { type: 'divider' },
        {
            key: 'dropbox',
            icon: <CloudSyncOutlined style={{ color: isAuthenticated() ? colors.successGreen : undefined }} />,
            label: isAuthenticated() ? 'Dropbox Connected' : 'Connect Dropbox',
            onClick: isAuthenticated() ? undefined : handleConnectDropbox,
            disabled: isAuthenticated()
        },
        {
            key: 'logout',
            danger: true,
            label: 'Logout',
            icon: <LogoutOutlined />,
            onClick: handleLogout
        },
    ];

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Typography.Text strong style={{ fontSize: 18, color: colors.primaryPink, marginRight: 48 }}>Pink POD</Typography.Text>
                    <Input prefix={<SearchOutlined />} placeholder="Search ID, Title..." style={{ width: 300, borderRadius: 20 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {appUser?.role === 'CS' && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            style={{ background: colors.primaryPink }}
                            onClick={() => setIsTaskModalOpen(true)}
                        >
                            TẠO TASK
                        </Button>
                    )}
                    <Dropdown menu={{ items: userMenuItems }}>
                        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
                            <Avatar src={appUser?.avatar} icon={<UserOutlined />} />
                            <span>{appUser?.displayName}</span>
                        </div>
                    </Dropdown>
                </div>
            </Header>
            <Content style={{ padding: '24px' }}>
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={items}
                    type="card"
                    tabBarStyle={{ marginBottom: 24 }}
                />

                <div style={{}}>
                    <List
                        grid={{ gutter: 16, column: 4 }}
                        dataSource={orders}
                        loading={loading}
                        renderItem={(item) => (
                            <List.Item>
                                <Card
                                    onClick={() => setSelectedOrder(item)}
                                    title={
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {item.isUrgent && <FireOutlined style={{ color: colors.urgentRed }} />}
                                            <span style={{ fontSize: 14 }}>#{item.readableId}</span>
                                        </div>
                                    }
                                    extra={<Tag color={item.isUrgent ? 'red' : 'blue'}>{item.category}</Tag>}
                                    style={{
                                        borderRadius: 8,
                                        border: item.isUrgent ? `1px solid ${colors.urgentRed}` : undefined,
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                                    }}
                                    hoverable
                                    headStyle={{ minHeight: 40, fontSize: 14, padding: '0 12px' }}
                                    bodyStyle={{ padding: 12 }}
                                >
                                    <Typography.Title level={5} style={{ margin: 0, fontSize: 16 }} ellipsis={{ rows: 2 }}>
                                        {item.title}
                                    </Typography.Title>
                                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: colors.textSecondary }}>
                                        <span>x {item.quantity}</span>
                                        {/* Handle Firestore Timestamp or Date object */}
                                        <span>{item.deadline ? new Date((item.deadline as any).seconds ? (item.deadline as any).seconds * 1000 : item.deadline).toLocaleDateString() : ''}</span>
                                    </div>
                                </Card>
                            </List.Item>
                        )}
                    />
                </div>
            </Content>

            <NewTaskModal
                open={isTaskModalOpen}
                onCancel={() => setIsTaskModalOpen(false)}
                onSuccess={() => {
                    setIsTaskModalOpen(false);
                    setActiveTab('new'); // Switch to new tab to see created task
                }}
            />

            <TaskDetailModal
                order={selectedOrder}
                open={!!selectedOrder}
                onCancel={() => setSelectedOrder(null)}
                onUpdate={() => setSelectedOrder(null)}
            />
        </Layout>
    );
};

export default Dashboard;
