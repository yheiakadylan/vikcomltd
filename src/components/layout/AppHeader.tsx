import React, { useState } from 'react';
import { Layout, Button, Avatar, Dropdown, Badge, List, Typography, Empty } from 'antd';
import { PlusOutlined, UserOutlined, SettingOutlined, LogoutOutlined, SafetyCertificateOutlined, HomeOutlined, BellOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNotification } from '../../contexts/NotificationContext';
import LanguageSwitcher from '../common/LanguageSwitcher';
import UserProfileModal from '../modals/UserProfileModal';

const { Header } = Layout;
const { Text } = Typography;

const NotificationBell = () => {
    const { notifications, unreadCount } = useNotification();
    const navigate = useNavigate();

    const menuItems = [
        {
            key: 'header',
            label: (
                <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0', fontWeight: 'bold' }}>
                    Thông báo ({unreadCount})
                </div>
            ),
        },
        {
            key: 'list',
            label: (
                <div style={{ maxHeight: '400px', overflowY: 'auto', width: 300 }}>
                    {notifications.length === 0 ? (
                        <Empty description="Không có thông báo mới" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                        <List
                            rowKey="id"
                            itemLayout="horizontal"
                            dataSource={notifications}
                            renderItem={(item) => (
                                <List.Item
                                    style={{
                                        padding: '12px 16px',
                                        cursor: 'pointer',
                                        background: '#fff',
                                        transition: 'background 0.2s'
                                    }}
                                    className="notification-item"
                                    onClick={() => {
                                        // Navigate logic
                                        const route = item.type === 'idea' ? '/board/idea' : '/board/fulfill';
                                        navigate(`${route}?taskId=${item.id}`);
                                    }}
                                >
                                    <List.Item.Meta
                                        title={<Text style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</Text>}
                                        description={
                                            <div style={{ fontSize: 12 }}>
                                                <div>{item.message}</div>
                                                <div style={{ color: '#aaa', marginTop: 4, fontSize: 10 }}>
                                                    {item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000).toLocaleString('vi-VN') : 'Vừa xong'}
                                                </div>
                                            </div>
                                        }
                                    />
                                </List.Item>
                            )}
                        />
                    )}
                </div>
            ),
        }
    ];

    return (
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight" overlayStyle={{ minWidth: 300 }}>
            <Badge count={unreadCount} size="small" offset={[-5, 5]}>
                <Button
                    type="text"
                    icon={<BellOutlined style={{ fontSize: 20, color: '#595959' }} />}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                />
            </Badge>
        </Dropdown>
    );
};

interface AppHeaderProps {
    onNewTask?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onNewTask }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { appUser: user, logout } = useAuth();
    const { t } = useLanguage();
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    const role = user?.role || '';
    const canAccessFulfill = ['ADMIN', 'CS', 'DS'].includes(role);
    const canAccessIdea = ['ADMIN', 'DS', 'IDEA'].includes(role);

    const isAdmin = role === 'ADMIN';
    const isAdminPage = location.pathname.includes('/admin');
    const isIdeaBoard = location.pathname.includes('/board/idea');

    const userMenuItems: any[] = [
        {
            key: 'profile',
            icon: <SettingOutlined />,
            label: t('header.profile'),
            onClick: () => setIsProfileModalOpen(true),
        }
    ];

    if (isAdmin) {
        if (isAdminPage) {
            userMenuItems.push({
                key: 'dashboard',
                icon: <HomeOutlined />,
                label: t('header.dashboard'),
                onClick: () => navigate('/'),
            });
        } else {
            userMenuItems.push({
                key: 'admin',
                icon: <SafetyCertificateOutlined />,
                label: t('header.admin'),
                onClick: () => navigate('/admin'),
            });
        }
    }

    userMenuItems.push(
        { type: 'divider' },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: t('header.logout'),
            danger: true,
            onClick: () => {
                logout();
                window.location.href = '/login';
            },
        }
    );

    return (
        <>
            <Header
                style={{
                    background: '#fff',
                    borderBottom: '1px solid #91D5FF',
                    padding: '0 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    height: 80,
                }}
            >
                {/* Left Side: Logo + Switcher */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <LanguageSwitcher />

                    {!isAdminPage && (canAccessFulfill || canAccessIdea) && (
                        <div className="header-toggle-container">
                            {canAccessFulfill && (
                                <div
                                    onClick={() => navigate('/board/fulfill')}
                                    className={`header-toggle-item ${!isIdeaBoard ? 'active fulfill' : ''}`}
                                >
                                    <HomeOutlined /> Fulfill
                                </div>
                            )}
                            {canAccessIdea && (
                                <div
                                    onClick={() => navigate('/board/idea')}
                                    className={`header-toggle-item ${isIdeaBoard ? 'active idea' : ''}`}
                                >
                                    <SafetyCertificateOutlined /> Idea
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Side: Action Buttons + User Menu */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                    <NotificationBell />

                    {onNewTask && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={onNewTask}
                            style={{ background: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}
                        >
                            {t('header.newTask')}
                        </Button>
                    )}

                    <Dropdown
                        menu={{ items: userMenuItems }}
                        trigger={['click']}
                        placement="bottomRight"
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                            <div style={{ lineHeight: 'normal', textAlign: 'right' }}>
                                <div style={{ fontWeight: 600 }}>{user?.displayName}</div>
                                <div style={{ fontSize: 10, color: '#8c8c8c' }}>
                                    {user?.role === 'CS' ? t('header.role.cs') :
                                        user?.role === 'DS' ? t('header.role.ds') :
                                            user?.role === 'IDEA' ? 'Idea' :
                                                t('header.role.admin')}
                                </div>
                            </div>
                            <Avatar
                                src={user?.avatar}
                                icon={<UserOutlined />}
                                style={{ background: '#ffd6e7', color: '#c41d7f' }}
                            />
                        </div>
                    </Dropdown>
                </div>
            </Header>

            <UserProfileModal open={isProfileModalOpen} onCancel={() => setIsProfileModalOpen(false)} />
        </>
    );
};

export default AppHeader;
