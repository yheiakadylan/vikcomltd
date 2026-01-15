import React, { useState } from 'react';
import { Layout, Button, Avatar, Dropdown } from 'antd';
import { PlusOutlined, UserOutlined, SettingOutlined, LogoutOutlined, SafetyCertificateOutlined, HomeOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import LanguageSwitcher from '../common/LanguageSwitcher';
import UserProfileModal from '../modals/UserProfileModal';

const { Header } = Layout;

interface AppHeaderProps {
    onNewTask?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onNewTask }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { appUser: user, logout } = useAuth();
    const { t } = useLanguage();
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    const isCS = user?.role === 'CS' || user?.role === 'ADMIN';
    const isAdmin = user?.role === 'ADMIN';
    const isAdminPage = location.pathname.includes('/admin');

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
                {/* Left Side: Logo + Search */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
                    <div style={{ marginRight: 8 }}>
                        <LanguageSwitcher />
                    </div>
                </div>

                {/* Right Side: Action Buttons + User Menu */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                    {isCS && onNewTask && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={onNewTask}
                            style={{ background: '#1677FF', borderColor: '#1677FF' }}
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
                                    {user?.role === 'CS' ? t('header.role.cs') : user?.role === 'DS' ? t('header.role.ds') : t('header.role.admin')}
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
