import React, { useState } from 'react';
import { Layout, Input, Button, Avatar, Dropdown } from 'antd';
import { PlusOutlined, UserOutlined, SettingOutlined, LogoutOutlined, SafetyCertificateOutlined, HomeOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import UserProfileModal from '../modals/UserProfileModal';

const { Header } = Layout;
const { Search } = Input;

interface AppHeaderProps {
    onNewTask?: () => void;
    searchText?: string;
    onSearchChange?: (value: string) => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onNewTask, searchText = '', onSearchChange }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { appUser: user, logout } = useAuth();
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    const isCS = user?.role === 'CS' || user?.role === 'ADMIN';
    const isAdmin = user?.role === 'ADMIN';
    const isAdminPage = location.pathname.includes('/admin');

    const userMenuItems: any[] = [
        {
            key: 'profile',
            icon: <SettingOutlined />,
            label: 'Thông tin cá nhân',
            onClick: () => setIsProfileModalOpen(true),
        }
    ];

    if (isAdmin) {
        if (isAdminPage) {
            userMenuItems.push({
                key: 'dashboard',
                icon: <HomeOutlined />,
                label: 'Về Dashboard',
                onClick: () => navigate('/'),
            });
        } else {
            userMenuItems.push({
                key: 'admin',
                icon: <SafetyCertificateOutlined />,
                label: 'Trang Admin',
                onClick: () => navigate('/admin'),
            });
        }
    }

    userMenuItems.push(
        { type: 'divider' },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Đăng xuất',
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
                    borderBottom: '1px solid #ffadd2',
                    padding: '0 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    height: 64,
                }}
            >
                {/* Left Side: Logo + Search */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
                {/* <div style={{ fontSize: 24, fontWeight: 'bold', color: '#c41d7f', whiteSpace: 'nowrap' }}>
                        PINK<span style={{ color: '#262626' }}>Y</span>
                    </div>*/}
                    <Search
                        placeholder="Tìm kiếm..."
                        allowClear
                        value={searchText}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                        style={{ width: 300, maxWidth: '100%' }}
                    />
                </div>

                {/* Right Side: Action Buttons + User Menu */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                    {isCS && onNewTask && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={onNewTask}
                            style={{ background: '#eb2f96', borderColor: '#eb2f96' }}
                        >
                            Tạo Task
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
                                    {user?.role === 'CS' ? 'Customer Service' : user?.role === 'DS' ? 'Designer' : 'Administrator'}
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
