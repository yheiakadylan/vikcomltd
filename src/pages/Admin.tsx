import React, { useState, useEffect } from 'react';
import { Layout, Tabs, Table, Button, Modal, Form, Input, Select, Tag, Card, App, Popconfirm, Avatar, Spin } from 'antd';
import { PlusOutlined, DropboxOutlined, CheckCircleFilled, UserOutlined } from '@ant-design/icons';
import { getUsers, createSecondaryUser, createUserProfile, getSystemSettings } from '../services/firebase';
import { getDropboxAuthUrl, getDropboxAccountInfo } from '../services/dropbox';
import { useAuth } from '../contexts/AuthContext';
import AppHeader from '../components/layout/AppHeader';
import type { User } from '../types';

const { Content } = Layout;

const Admin: React.FC = () => {
    const { message } = App.useApp();
    const { appUser: user } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [dropboxConnected, setDropboxConnected] = useState(false);
    const [dropboxInfo, setDropboxInfo] = useState<any>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        if (user) {
            fetchUsers();
            checkDropbox();
        }
    }, [user]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await getUsers();
            setUsers(data);
        } catch (error) {
            console.error(error);
            message.error('Lỗi tải danh sách nhân viên');
        } finally {
            setLoading(false);
        }
    };

    const checkDropbox = async () => {
        try {
            // 1. Check DB first (Source of Truth)
            const settings = await getSystemSettings();
            if (settings?.dropbox?.access_token) {
                // Sync to LocalStorage for dropbox.ts service to use
                localStorage.setItem('dropbox_access_token', settings.dropbox.access_token);
                if (settings.dropbox.refresh_token) {
                    localStorage.setItem('dropbox_refresh_token', settings.dropbox.refresh_token);
                }
                setDropboxConnected(true);

                // Fetch info
                const info = await getDropboxAccountInfo();
                setDropboxInfo(info);
            } else {
                setDropboxConnected(false);
                setDropboxInfo(null);
            }
        } catch (error) {
            console.error("Error checking dropbox:", error);
            setDropboxConnected(false);
            setDropboxInfo(null);
            message.error("Kết nối Dropbox hết hạn hoặc lỗi. Vui lòng kết nối lại.");
        }
    };

    const handleCreateUser = async (values: any) => {
        try {
            setLoading(true);

            // 1. Create user in Firebase Auth (secondary app)
            const newUid = await createSecondaryUser(values.email, values.password);

            // 2. Create user profile in Firestore
            await createUserProfile({
                uid: newUid,
                email: values.email,
                displayName: values.displayName,
                role: values.role,
                isActive: true
            });

            console.log('User created:', newUid);
            message.success('Tạo nhân viên thành công! Nhân viên có thể đăng nhập ngay.');
            setIsModalOpen(false);
            form.resetFields();
            fetchUsers();
        } catch (error: any) {
            console.error(error);
            let errorMessage = 'Lỗi khi tạo nhân viên';
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'Email này đã được sử dụng!';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Mật khẩu quá yếu!';
            } else {
                errorMessage = error.message || errorMessage;
            }
            message.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleConnectDropbox = async () => {
        try {
            const authUrl = await getDropboxAuthUrl();
            window.location.href = authUrl as string;
        } catch (error) {
            console.error(error);
            message.error("Không lấy được URL xác thực Dropbox");
        }
    };

    const columns = [
        {
            title: 'Tên hiển thị',
            dataIndex: 'displayName',
            key: 'displayName',
            render: (text: string, record: User) => (
                <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar src={record.avatar || record.avatarUrl || undefined} icon={<UserOutlined />} />
                    <span style={{ fontWeight: 500 }}>{text}</span>
                </div>
            )
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
            render: (text: string) => text,
        },
        {
            title: 'Vai trò',
            dataIndex: 'role',
            key: 'role',
            render: (role: string) => {
                let color = role === 'ADMIN' ? 'red' : role === 'CS' ? 'blue' : 'green';
                return <Tag color={color}>{role}</Tag>;
            }
        },
        {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (active: boolean) => (
                active ? <Tag color="success">Active</Tag> : <Tag color="default">Locked</Tag>
            )
        }
    ];

    const UserManagementTab = () => (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
                    Thêm Nhân Viên
                </Button>
            </div>
            <Table
                columns={columns}
                dataSource={users}
                rowKey="uid"
                loading={loading}
                pagination={{ pageSize: 10 }}
            />
        </div>
    );

    const SystemConfigTab = () => (
        <div style={{ maxWidth: 672, margin: '0 auto' }}>
            <Card title="Kết nối lưu trữ (Dropbox)" className="shadow-md">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '32px 0' }}>
                    <div style={{ textAlign: 'center' }}>
                        {dropboxConnected ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                                <CheckCircleFilled style={{ fontSize: 64, color: '#52c41a' }} />
                                {dropboxInfo ? (
                                    <div style={{ background: '#f6ffed', padding: '16px 32px', borderRadius: 8, border: '1px solid #b7eb8f' }}>
                                        <div style={{ fontSize: 18, fontWeight: 600, color: '#389e0d' }}>Đã kết nối thành công</div>
                                        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <Avatar size={48} src={dropboxInfo.profile_photo_url} icon={<UserOutlined />} />
                                            <div style={{ textAlign: 'left' }}>
                                                <div style={{ fontWeight: 'bold' }}>{dropboxInfo.name.display_name}</div>
                                                <div style={{ color: '#8c8c8c' }}>{dropboxInfo.email}</div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <Spin />
                                )}
                            </div>
                        ) : (
                            <DropboxOutlined style={{ fontSize: 64, color: '#0061FE' }} />
                        )}

                        {!dropboxConnected && (
                            <>
                                <h3 style={{ marginTop: 16, fontSize: 20, fontWeight: 600 }}>Chưa kết nối Dropbox</h3>
                                <p style={{ color: '#8c8c8c', marginTop: 8 }}>
                                    Cần kết nối để tính năng upload file hoạt động.
                                </p>
                            </>
                        )}
                    </div>

                    {!dropboxConnected ? (
                        <Button
                            type="primary"
                            size="large"
                            icon={<DropboxOutlined />}
                            onClick={handleConnectDropbox}
                            style={{ background: '#0061FE', borderColor: '#0061FE' }}
                        >
                            Kết nối ngay
                        </Button>
                    ) : (
                        <Popconfirm
                            title="Ngắt kết nối Dropbox"
                            description="Bạn có chắc chắn muốn ngắt kết nối? Các tính năng upload sẽ ngừng hoạt động."
                            onConfirm={() => {
                                localStorage.removeItem('dropbox_access_token');
                                localStorage.removeItem('dropbox_refresh_token');
                                localStorage.removeItem('minph_dropbox_verifier');
                                setDropboxConnected(false);
                                setDropboxInfo(null);
                                message.success("Đã ngắt kết nối");
                            }}
                            okText="Đồng ý"
                            cancelText="Hủy"
                        >
                            <Button danger size="large">
                                Ngắt kết nối
                            </Button>
                        </Popconfirm>
                    )}
                </div>
            </Card>
        </div>
    );

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            <AppHeader />
            <Content style={{ padding: 24 }}>
                <div style={{ background: '#fff', padding: 24, borderRadius: 8, minHeight: 500 }}>
                    <Tabs items={[
                        { key: '1', label: 'Quản lý Nhân sự', children: <UserManagementTab /> },
                        { key: '2', label: 'Cấu hình Hệ thống', children: <SystemConfigTab /> },
                    ]} />
                </div>
            </Content>

            <Modal
                title="Thêm nhân viên mới"
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
            >
                <Form form={form} layout="vertical" onFinish={handleCreateUser}>
                    <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                        <Input placeholder="example@pinkpod.com" />
                    </Form.Item>
                    <Form.Item name="displayName" label="Tên hiển thị" rules={[{ required: true }]}>
                        <Input placeholder="Nguyễn Văn A" />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        label="Mật khẩu"
                        rules={[
                            { required: true, message: 'Vui lòng nhập mật khẩu' },
                            { min: 6, message: 'Mật khẩu ít nhất 6 ký tự' }
                        ]}
                    >
                        <Input.Password placeholder="Nhập mật khẩu cho nhân viên" />
                    </Form.Item>
                    <Form.Item
                        name="confirmPassword"
                        label="Xác nhận mật khẩu"
                        dependencies={['password']}
                        rules={[
                            { required: true, message: 'Vui lòng xác nhận mật khẩu' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('password') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('Mật khẩu không khớp!'));
                                },
                            }),
                        ]}
                    >
                        <Input.Password placeholder="Nhập lại mật khẩu" />
                    </Form.Item>
                    <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
                        <Select>
                            <Select.Option value="CS">CS (Customer Service)</Select.Option>
                            <Select.Option value="DS">DS (Designer)</Select.Option>
                            <Select.Option value="ADMIN">Admin</Select.Option>
                        </Select>
                    </Form.Item>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                        <Button onClick={() => setIsModalOpen(false)}>Hủy</Button>
                        <Button type="primary" htmlType="submit">Tạo mới</Button>
                    </div>
                </Form>
            </Modal>
        </Layout>
    );
};

export default Admin;
