import React, { useState } from 'react';
import { Modal, Form, Input, Upload, Button, message, Divider, Avatar } from 'antd';
import { UserOutlined, UploadOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { uploadFileToDropbox } from '../../services/dropbox';
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

            // Upload new avatar to Dropbox if selected
            if (avatarFile && avatarFile.originFileObj) {
                const result = await uploadFileToDropbox(
                    avatarFile.originFileObj,
                    `/PINK_POD_SYSTEM/Avatars/${user.uid}_${Date.now()}.jpg`
                );
                newAvatarUrl = (result as any).url || avatarUrl;
            }

            // Update Firestore
            await updateDoc(doc(db, 'users', user.uid), {
                displayName: values.displayName,
                avatar: newAvatarUrl,
            });

            message.success('Cập nhật thông tin thành công!');
            setAvatarFile(null);
            // Reload page to reflect changes
            setTimeout(() => window.location.reload(), 1000);
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
            title="Thông tin cá nhân"
            open={open}
            onCancel={onCancel}
            footer={null}
            width={600}
        >
            {/* Profile Section */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <Avatar
                    size={80}
                    src={avatarUrl}
                    icon={<UserOutlined />}
                    style={{ marginBottom: 8 }}
                />
                <div style={{ fontWeight: 'bold', fontSize: 18 }}>{user?.displayName}</div>
                <div style={{ color: '#8c8c8c' }}>{user?.email}</div>
                <div style={{ marginTop: 4 }}>
                    <span style={{
                        background: user?.role === 'ADMIN' ? '#f5222d' : user?.role === 'CS' ? '#1890ff' : '#52c41a',
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                    }}>
                        {user?.role}
                    </span>
                </div>
            </div>

            <Divider>Cập nhật thông tin</Divider>

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
                    <Input prefix={<UserOutlined />} placeholder="Nhập tên hiển thị" />
                </Form.Item>

                <Form.Item label="Avatar">
                    <Upload
                        maxCount={1}
                        accept="image/*"
                        beforeUpload={(file) => {
                            setAvatarFile(file as any);
                            // Preview
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                setAvatarUrl(e.target?.result as string);
                            };
                            reader.readAsDataURL(file);
                            return false;
                        }}
                        onRemove={() => {
                            setAvatarFile(null);
                            setAvatarUrl(user?.avatar || '');
                        }}
                    >
                        <Button icon={<UploadOutlined />}>Chọn ảnh mới</Button>
                    </Upload>
                    <small style={{ color: '#8c8c8c' }}>Ảnh sẽ được lưu vào Dropbox</small>
                </Form.Item>

                <Button type="primary" htmlType="submit" loading={loading} block>
                    Cập nhật thông tin
                </Button>
            </Form>

            <Divider>Đổi mật khẩu</Divider>

            <Form
                form={passwordForm}
                layout="vertical"
                onFinish={handleChangePassword}
            >
                <Form.Item
                    name="oldPassword"
                    label="Mật khẩu cũ"
                    rules={[{ required: true, message: 'Vui lòng nhập mật khẩu cũ' }]}
                >
                    <Input.Password prefix={<LockOutlined />} placeholder="Nhập mật khẩu cũ" />
                </Form.Item>

                <Form.Item
                    name="newPassword"
                    label="Mật khẩu mới"
                    rules={[
                        { required: true, message: 'Vui lòng nhập mật khẩu mới' },
                        { min: 6, message: 'Mật khẩu ít nhất 6 ký tự' }
                    ]}
                >
                    <Input.Password prefix={<LockOutlined />} placeholder="Nhập mật khẩu mới" />
                </Form.Item>

                <Form.Item
                    name="confirmPassword"
                    label="Xác nhận mật khẩu"
                    dependencies={['newPassword']}
                    rules={[
                        { required: true, message: 'Vui lòng xác nhận mật khẩu' },
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
                    <Input.Password prefix={<LockOutlined />} placeholder="Nhập lại mật khẩu mới" />
                </Form.Item>

                <Button type="primary" htmlType="submit" loading={loading} block danger>
                    Đổi mật khẩu
                </Button>
            </Form>
        </Modal>
    );
};

export default UserProfileModal;
