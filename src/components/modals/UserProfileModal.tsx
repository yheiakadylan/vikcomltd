import React, { useState } from 'react';
import { Modal, Form, Input, Upload, Button, message, Avatar, Tabs } from 'antd';
import { UserOutlined, UploadOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth, uploadFileToStorage } from '../../services/firebase';
import type { UploadFile } from 'antd';

interface UserProfileModalProps {
    open: boolean;
    onCancel: () => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ open, onCancel }) => {
    const { appUser: user } = useAuth();
    const [form] = Form.useForm();
    const [passwordForm] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [avatarFile, setAvatarFile] = useState<UploadFile | null>(null);
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');

    const handleUpdateProfile = async (values: any) => {
        if (!user) return;
        setLoading(true);
        try {
            let newAvatarUrl = avatarUrl;

            if (avatarFile) {
                // Use Firebase Storage
                const safeEmail = user.email || user.uid;
                // avatarFile set in beforeUpload is the File object itself (RcFile)
                const fileToUpload = (avatarFile as any).originFileObj || avatarFile;

                const uploadedUrl = await uploadFileToStorage(
                    fileToUpload,
                    `avatars/${safeEmail}/${fileToUpload.name}`
                );

                if (!uploadedUrl) throw new Error("Upload failed.");
                newAvatarUrl = uploadedUrl;
            }

            // Update Firestore
            await updateDoc(doc(db, 'users', user.uid), {
                displayName: values.displayName,
                avatar: newAvatarUrl,
            });

            message.success('Cập nhật thông tin thành công!');
            setAvatarFile(null);
            // No reload needed due to onSnapshot in AuthContext
            onCancel();
        } catch (error) {
            console.error(error);
            message.error('Lỗi khi cập nhật thông tin');
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (values: any) => {
        if (!user || !auth.currentUser) return;
        setLoading(true);
        try {
            // Re-authenticate user before changing password
            const credential = EmailAuthProvider.credential(
                user.email,
                values.oldPassword
            );
            await reauthenticateWithCredential(auth.currentUser, credential);

            // Change password
            await updatePassword(auth.currentUser, values.newPassword);

            message.success('Đổi mật khẩu thành công!');
            passwordForm.resetFields();
        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/wrong-password') {
                message.error('Mật khẩu cũ không đúng');
            } else {
                message.error('Lỗi khi đổi mật khẩu');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={null}
            open={open}
            onCancel={onCancel}
            footer={null}
            width={700}
            styles={{ body: { padding: 0, overflow: 'hidden', borderRadius: 12 } }}
            centered
        >
            <div style={{ display: 'flex', height: 520 }}>
                {/* Left Sidebar / Header for Mobile */}
                <div style={{
                    width: 250,
                    background: 'linear-gradient(135deg, #fff0f6 0%, #ffd6e7 100%)',
                    padding: '40px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    borderRight: '1px solid #f0f0f0'
                }}>
                    <div style={{ position: 'relative', marginBottom: 16 }}>
                        <Avatar
                            size={100}
                            src={avatarUrl}
                            icon={<UserOutlined />}
                            style={{
                                border: '4px solid #fff',
                                boxShadow: '0 4px 12px rgba(235, 47, 150, 0.2)',
                                background: '#fff'
                            }}
                        />
                        <div style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            background: '#eb2f96',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px solid #fff',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}>
                            <Upload
                                maxCount={1}
                                accept="image/*"
                                showUploadList={false}
                                beforeUpload={(file) => {
                                    setAvatarFile(file as any);
                                    const reader = new FileReader();
                                    reader.onload = (e) => setAvatarUrl(e.target?.result as string);
                                    reader.readAsDataURL(file);
                                    return false;
                                }}
                            >
                                <UploadOutlined style={{ color: '#fff', fontSize: 16 }} />
                            </Upload>
                        </div>
                    </div>

                    <h3 style={{ margin: '8px 0 4px', fontSize: 18, color: '#1f1f1f', textAlign: 'center' }}>
                        {user?.displayName}
                    </h3>
                    <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>{user?.email}</div>

                    <span style={{
                        background: '#fff',
                        color: '#eb2f96',
                        padding: '4px 12px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        border: '1px solid #ffadd2'
                    }}>
                        {user?.role === 'CS' ? 'Customer Service' : user?.role === 'DS' ? 'Designer' : 'Administrator'}
                    </span>
                </div>

                {/* Right Content */}
                <div style={{ flex: 1, padding: '30px', background: '#fff', overflowY: 'auto' }}>
                    <Tabs
                        defaultActiveKey="1"
                        items={[
                            {
                                key: '1',
                                label: 'Thông tin chung',
                                children: (
                                    <div style={{ paddingTop: 10 }}>
                                        <b style={{ display: 'block', marginBottom: 20, fontSize: 16, color: '#333' }}>
                                            Chỉnh sửa thông tin
                                        </b>
                                        <Form
                                            form={form}
                                            layout="vertical"
                                            onFinish={handleUpdateProfile}
                                            initialValues={{ displayName: user?.displayName }}
                                        >
                                            <Form.Item
                                                name="displayName"
                                                label="Tên hiển thị"
                                                rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
                                            >
                                                <Input
                                                    size="large"
                                                    prefix={<UserOutlined style={{ color: '#eb2f96' }} />}
                                                    style={{ borderRadius: 8 }}
                                                />
                                            </Form.Item>

                                            <div style={{ marginTop: 40, textAlign: 'right' }}>
                                                <Button type="text" onClick={onCancel} style={{ marginRight: 10 }}>
                                                    Hủy bỏ
                                                </Button>
                                                <Button
                                                    type="primary"
                                                    htmlType="submit"
                                                    loading={loading}
                                                    size="large"
                                                    style={{
                                                        background: '#eb2f96',
                                                        borderColor: '#eb2f96',
                                                        borderRadius: 8,
                                                        fontWeight: 500,
                                                        boxShadow: '0 4px 14px rgba(235, 47, 150, 0.3)'
                                                    }}
                                                >
                                                    Lưu thay đổi
                                                </Button>
                                            </div>
                                        </Form>
                                    </div>
                                )
                            },
                            {
                                key: '2',
                                label: 'Đổi mật khẩu',
                                children: (
                                    <div style={{ paddingTop: 10 }}>
                                        <b style={{ display: 'block', marginBottom: 20, fontSize: 16, color: '#333' }}>
                                            Đổi mật khẩu
                                        </b>
                                        <Form
                                            form={passwordForm}
                                            layout="vertical"
                                            onFinish={handleChangePassword}
                                        >
                                            <Form.Item
                                                name="oldPassword"
                                                label="Mật khẩu hiện tại"
                                                rules={[{ required: true, message: 'Nhập mật khẩu cũ' }]}
                                            >
                                                <Input.Password size="large" style={{ borderRadius: 8 }} />
                                            </Form.Item>

                                            <Form.Item
                                                name="newPassword"
                                                label="Mật khẩu mới"
                                                rules={[
                                                    { required: true, message: 'Nhập mật khẩu mới' },
                                                    { min: 6, message: 'Tối thiểu 6 ký tự' }
                                                ]}
                                            >
                                                <Input.Password size="large" style={{ borderRadius: 8 }} />
                                            </Form.Item>

                                            <Form.Item
                                                name="confirmPassword"
                                                label="Xác nhận mật khẩu mới"
                                                dependencies={['newPassword']}
                                                rules={[
                                                    { required: true, message: 'Xác nhận lại mật khẩu' },
                                                    ({ getFieldValue }) => ({
                                                        validator(_, value) {
                                                            if (!value || getFieldValue('newPassword') === value) {
                                                                return Promise.resolve();
                                                            }
                                                            return Promise.reject(new Error('Mật khẩu không khớp!'));
                                                        },
                                                    }),
                                                ]}
                                            >
                                                <Input.Password size="large" style={{ borderRadius: 8 }} />
                                            </Form.Item>

                                            <div style={{ marginTop: 40, textAlign: 'right' }}>
                                                <Button type="text" onClick={onCancel} style={{ marginRight: 10 }}>
                                                    Hủy bỏ
                                                </Button>
                                                <Button
                                                    type="primary"
                                                    htmlType="submit"
                                                    loading={loading}
                                                    size="large"
                                                    style={{
                                                        background: '#eb2f96',
                                                        borderColor: '#eb2f96',
                                                        borderRadius: 8,
                                                        fontWeight: 500
                                                    }}
                                                >
                                                    Cập nhật mật khẩu
                                                </Button>
                                            </div>
                                        </Form>
                                    </div>
                                )
                            }
                        ]}
                    />
                </div>
            </div>
        </Modal>
    );
};

export default UserProfileModal;
