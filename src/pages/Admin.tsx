import React, { useState, useEffect } from 'react';
import { Layout, Tabs, Table, Button, Modal, Form, Input, Select, Tag, App, Avatar } from 'antd';
import { PlusOutlined, UserOutlined } from '@ant-design/icons';
import { getUsers, createSecondaryUser, createUserProfile } from '../services/firebase';
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
    const [form] = Form.useForm();

    useEffect(() => {
        if (user) {
            fetchUsers();
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
