import React, { useState } from 'react';
import { Layout, Input, Button, Avatar, Dropdown } from 'antd';
import { PlusOutlined, UserOutlined, SettingOutlined, LogoutOutlined } from '@ant-design/icons';
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
    const { appUser: user, logout } = useAuth();
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    const isCS = user?.role === 'CS' || user?.role === 'ADMIN';

    const userMenuItems = [
        {
            key: 'profile',
            icon: <SettingOutlined />,
            label: 'Thông tin cá nhân',
            onClick: () => setIsProfileModalOpen(true),
        },
        {
            type: 'divider' as const,
        },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Đăng xuất',
            danger: true,
            onClick: () => {
                logout();
                window.location.href = '/login';
            },
        },
    ];

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
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#c41d7f', whiteSpace: 'nowrap' }}>
                        PINK<span style={{ color: '#262626' }}>POD</span>
                    </div>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                            <Avatar
                                src={user?.avatar}
                                icon={<UserOutlined />}
                                style={{ background: '#ffd6e7', color: '#c41d7f' }}
                            />
                            <div>
                                <div style={{ fontWeight: 600 }}>{user?.displayName}</div>
                                <div style={{ fontSize: 10, color: '#8c8c8c' }}>{user?.role}</div>
                            </div>
                        </div>
                    </Dropdown>
                </div>
            </Header>

            <UserProfileModal open={isProfileModalOpen} onCancel={() => setIsProfileModalOpen(false)} />
        </>
    );
};

export default AppHeader;
