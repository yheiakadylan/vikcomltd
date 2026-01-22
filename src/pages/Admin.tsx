import React, { useState, useEffect } from 'react';
import { Layout, Tabs, Table, Button, Modal, Form, Input, Select, Tag, App, Avatar, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, UserOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getUsers, apiCreateUser, apiUpdateUser, apiDeleteUser } from '../services/firebase';
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
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        if (user) {
            fetchUsers();
        }
    }, [user]);

    // Reset/Fill form when modal opens or editingUser changes
    useEffect(() => {
        if (isModalOpen) {
            if (editingUser) {
                form.setFieldsValue({
                    email: editingUser.email,
                    displayName: editingUser.displayName,
                    role: editingUser.role,
                    password: '', // Reset password field
                    confirmPassword: ''
                });
            } else {
                form.resetFields();
            }
        }
    }, [isModalOpen, editingUser, form]);

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

    const handleUserSubmit = async (values: any) => {
        setLoading(true);
        try {
            if (editingUser) {
                // UPDATE MODE (Server Side)
                if (!editingUser.uid) throw new Error("Missing User UID");

                await apiUpdateUser(editingUser.uid, {
                    displayName: values.displayName,
                    role: values.role,
                    email: values.email,
                    // Only send password if user entered it
                    ...(values.password ? { password: values.password } : {})
                });

                message.success('Cập nhật thông tin thành công!');
            } else {
                // CREATE MODE (Server Side)
                // Note: apiCreateUser handles both Auth and Firestore
                await apiCreateUser({
                    email: values.email,
                    password: values.password,
                    displayName: values.displayName,
                    role: values.role
                });

                message.success('Tạo nhân viên thành công! Nhân viên có thể đăng nhập ngay.');
            }

            setIsModalOpen(false);
            setEditingUser(null);
            form.resetFields();
            fetchUsers();
        } catch (error: any) {
            console.error(error);
            message.error(error.message || 'Thao tác thất bại');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (record: User) => {
        if (!record.uid) return;
        setLoading(true);
        try {
            await apiDeleteUser(record.uid);
            message.success(`Đã xóa tài khoản ${record.displayName}`);
            fetchUsers();
        } catch (error: any) {
            console.error(error);
            message.error(error.message || 'Không thể xóa tài khoản');
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (record: User) => {
        setEditingUser(record);
        setIsModalOpen(true);
    };

    const openCreateModal = () => {
        setEditingUser(null);
        setIsModalOpen(true);
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
                let color = role === 'ADMIN' ? 'red' : role === 'CS' ? 'blue' : role === 'IDEA' ? 'purple' : 'green';
                return <Tag color={color}>{role}</Tag>;
            }
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (_: any, record: User) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <Tooltip title="Chỉnh sửa / Đổi mật khẩu">
                        <Button
                            icon={<EditOutlined />}
                            size="small"
                            onClick={() => openEditModal(record)}
                        />
                    </Tooltip>

                    <Popconfirm
                        title="Xóa tài khoản này?"
                        description="Hành động này sẽ xóa hoàn toàn tài khoản khỏi hệ thống (Auth & Data). Không thể hoàn tác."
                        onConfirm={() => handleDeleteUser(record)}
                        okText="Xóa vĩnh viễn"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Tooltip title="Xóa tài khoản">
                            <Button
                                icon={<DeleteOutlined />}
                                size="small"
                                danger
                            />
                        </Tooltip>
                    </Popconfirm>
                </div>
            )
        }
    ];

    const UserManagementTab = () => (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                    Thêm Nhân Viên
                </Button>
            </div>
            <Table
                columns={columns}
                dataSource={users}
                rowKey={(record) => record.uid || String(Math.random())}
                loading={loading}
                pagination={{ pageSize: 10 }}
            />
        </div>
    );

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            <AppHeader />
            <Content style={{ padding: 24 }}>
                <div style={{ background: '#fff', padding: 24, borderRadius: 8, minHeight: 500 }}>
                    <Tabs items={[
                        { key: '1', label: 'Quản lý Nhân sự', children: <UserManagementTab /> },
                    ]} />
                </div>
            </Content>

            <Modal
                title={editingUser ? "Cập nhật tài khoản" : "Thêm nhân viên mới"}
                open={isModalOpen}
                onCancel={() => { setIsModalOpen(false); setEditingUser(null); }}
                footer={null}
            >
                <Form form={form} layout="vertical" onFinish={handleUserSubmit}>
                    <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                        <Input placeholder="example@pinkpod.com" />
                    </Form.Item>

                    <Form.Item name="displayName" label="Tên hiển thị" rules={[{ required: true }]}>
                        <Input placeholder="Nguyễn Văn A" />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        label={editingUser ? "Mật khẩu mới (Để trống nếu không đổi)" : "Mật khẩu"}
                        rules={[
                            { required: !editingUser, message: 'Vui lòng nhập mật khẩu' },
                            { min: 6, message: 'Mật khẩu ít nhất 6 ký tự' }
                        ]}
                    >
                        <Input.Password placeholder={editingUser ? "............" : "Nhập mật khẩu"} />
                    </Form.Item>

                    <Form.Item
                        name="confirmPassword"
                        label="Xác nhận mật khẩu"
                        dependencies={['password']}
                        rules={[
                            { required: !editingUser, message: 'Vui lòng xác nhận mật khẩu' },
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
                            <Select.Option value="IDEA">Idea</Select.Option>
                            <Select.Option value="ADMIN">Admin</Select.Option>
                        </Select>
                    </Form.Item>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                        <Button onClick={() => { setIsModalOpen(false); setEditingUser(null); }}>Hủy</Button>
                        <Button type="primary" htmlType="submit">
                            {editingUser ? 'Cập nhật' : 'Tạo mới'}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </Layout>
    );
};

export default Admin;
