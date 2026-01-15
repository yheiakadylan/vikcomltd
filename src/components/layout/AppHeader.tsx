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
