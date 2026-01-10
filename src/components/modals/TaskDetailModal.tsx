import React, { useState, useEffect } from 'react';
import { Modal, Row, Col, Typography, Tag, Button, Switch, Upload, message, Divider } from 'antd';
import { FireOutlined, UploadOutlined } from '@ant-design/icons';
import { colors } from '../../theme/themeConfig';
import type { Order } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { uploadFileToDropbox } from '../../services/dropbox';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Dragger } = Upload;

interface TaskDetailModalProps {
    order: Order | null;
    open: boolean;
    onCancel: () => void;
    onUpdate: () => void;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ order, open, onCancel, onUpdate }) => {
    const { appUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [localUrgent, setLocalUrgent] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);

    useEffect(() => {
        if (order) {
            setLocalUrgent(order.isUrgent);
            setUploadedFiles([]); // Reset on new open
        }
    }, [order]);

    if (!order || !appUser) return null;

    const isCS = appUser.role === 'CS' || appUser.role === 'ADMIN';
    const isDS = appUser.role === 'DS';

    // Logic: Who can do what?
    // CS can edit Urgent always
    // DS can only Submit if status is 'doing'
    // CS can Approve/Reject if status is 'in_review'

    const showClaim = isDS && order.status === 'new';
    const showSubmit = isDS && (order.status === 'doing' || order.status === 'need_fix');
    const showReview = isCS && order.status === 'in_review';

    const handleUrgentToggle = async (checked: boolean) => {
        if (!isCS) return;
        setLocalUrgent(checked);
        try {
            await updateDoc(doc(db, "orders", order.id), { isUrgent: checked });
            message.success("Priority updated");
            onUpdate();
        } catch (e) {
            message.error("Failed to update priority");
            setLocalUrgent(!checked); // Revert
        }
    };

    const handleClaim = async () => {
        setLoading(true);
        try {
            await updateDoc(doc(db, "orders", order.id), {
                status: 'doing',
                designerId: appUser.uid
            });
            message.success("Nhận việc thành công!");
            onUpdate();
            onCancel();
        } catch (e) {
            console.error(e);
            message.error("Failed to claim task");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (uploadedFiles.length === 0) {
            message.error("Vui lòng upload file thiết kế!");
            return;
        }
        setLoading(true);
        try {
            // Upload to Dropbox
            const uploadPromises = uploadedFiles.map(async (file) => {
                // Antd Upload file object sometimes wraps the native file in originFileObj, 
                // or if it's drag/dropped it might be the file itself if we managed it differently.
                // In our Dragger implementation in helper, we pushed 'file'.

                // If using manual state management with beforeUpload returning false:
                const fileToUpload = file.originFileObj || file;
                // We need a specific folder for designs, let's put it in 'PROJECT/designs' or just same folder?
                // Spec says: "Artist submit design (file png/psd) lên dropbox"
                // Let's assume order.dropboxPath exists.
                if (order.dropboxPath) {
                    return uploadFileToDropbox(fileToUpload, order.dropboxPath + '/designs');
                }
                return null;
            });

            await Promise.all(uploadPromises);

            // Prepare design files metadata
            const newDesignFiles = uploadedFiles.map(f => f.name);

            await updateDoc(doc(db, "orders", order.id), {
                status: 'in_review',
                designFiles: newDesignFiles
            });
            message.success("Nộp bài thành công!");
            onUpdate();
            onCancel();
        } catch (e) {
            console.error(e);
            message.error("Failed to submit (Dropbox upload or DB error)");
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        setLoading(true);
        try {
            await updateDoc(doc(db, "orders", order.id), { status: 'done' });
            message.success("Đã duyệt đơn hàng!");
            onUpdate();
            onCancel();
        } catch (e) {
            message.error("Failed to approve");
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        // Simple reject for now, ideally needs a Reason Modal
        setLoading(true);
        try {
            await updateDoc(doc(db, "orders", order.id), {
                status: 'need_fix',
                isUrgent: true // Auto urgent on reject
            });
            message.warning("Đã trả lại để sửa!");
            onUpdate();
            onCancel();
        } catch (e) {
            message.error("Failed to reject");
        } finally {
            setLoading(false);
        }
    };

    // Render Work Zone (Right Column)
    const renderWorkZone = () => {
        if (showClaim) {
            return (
                <div style={{ textAlign: 'center', padding: 40, background: '#f9f9f9', borderRadius: 8 }}>
                    <Button type="primary" size="large" onClick={handleClaim} loading={loading}>
                        CLAIM THIS TASK
                    </Button>
                </div>
            );
        }

        if (showSubmit) {
            return (
                <div style={{ marginTop: 24 }}>
                    <Title level={5}>Nộp bài (Submit via Dropbox)</Title>
                    <Dragger
                        multiple
                        fileList={uploadedFiles}
                        beforeUpload={(file) => {
                            setUploadedFiles([...uploadedFiles, file]);
                            return false;
                        }}
                        onRemove={(file) => setUploadedFiles(uploadedFiles.filter(f => f.uid !== file.uid))}
                        style={{ background: '#f6ffed', borderColor: colors.successGreen }}
                    >
                        <p className="ant-upload-drag-icon">
                            <UploadOutlined style={{ color: colors.successGreen }} />
                        </p>
                        <p className="ant-upload-text">Kéo thả file Final vào đây</p>
                    </Dragger>
                    <Button
                        type="primary"
                        block
                        size="large"
                        style={{ marginTop: 16, background: colors.primaryPink }}
                        onClick={handleSubmit}
                        loading={loading}
                        disabled={uploadedFiles.length === 0}
                    >
                        SUBMIT DESIGN
                    </Button>
                </div>
            );
        }

        if (showReview) {
            return (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ marginBottom: 24, padding: 16, border: '1px dashed #d9d9d9', borderRadius: 8 }}>
                        <Text type="secondary">Files submitted: {order.designFiles?.length || 0}</Text>
                        {/* List files here */}
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <Button danger size="large" onClick={handleReject} loading={loading} style={{ flex: 1 }}>REJECT (Fix)</Button>
                        <Button type="primary" size="large" onClick={handleApprove} loading={loading} style={{ background: colors.successGreen, flex: 1 }}>APPROVE</Button>
                    </div>
                </div>
            );
        }

        return <div style={{ padding: 20, textAlign: 'center', color: '#ccc' }}>Read Only Mode</div>;
    };

    return (
        <Modal
            open={open}
            onCancel={onCancel}
            footer={null}
            width={900}
            style={{ top: 20 }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Tag color="blue">#{order.readableId}</Tag>
                    <Text>ID</Text>
                    <Title level={4} style={{ margin: '8px 0 0' }}>{order.title}</Title>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Switch
                        checked={localUrgent}
                        onChange={handleUrgentToggle}
                        disabled={!isCS} // Only CS can toggle
                        checkedChildren={<FireOutlined />}
                        unCheckedChildren={<FireOutlined />}
                        style={{ background: localUrgent ? colors.urgentRed : undefined }}
                    />
                    {localUrgent && <Text strong style={{ color: colors.urgentRed }}>URGENT</Text>}
                </div>
            </div>

            <Row gutter={24}>
                <Col span={14} style={{ borderRight: '1px solid #f0f0f0' }}>
                    <div style={{ marginBottom: 24 }}>
                        <Text type="secondary">Description</Text>
                        <div style={{ background: '#fafafa', padding: 12, borderRadius: 8, marginTop: 8, minHeight: 100 }}>
                            {order.description}
                        </div>
                    </div>

                    <Row gutter={16}>
                        <Col span={12}>
                            <div style={{ background: '#fff0f6', padding: 12, borderRadius: 8 }}>
                                <Text type="secondary">Quantity</Text>
                                <div style={{ fontSize: 18, fontWeight: 600 }}>{order.quantity}</div>
                            </div>
                        </Col>
                        <Col span={12}>
                            <div style={{ background: '#fff0f6', padding: 12, borderRadius: 8 }}>
                                <Text type="secondary">Deadline</Text>
                                <div style={{ fontSize: 18, fontWeight: 600 }}>
                                    {order.deadline ? dayjs((order.deadline as any).seconds ? (order.deadline as any).seconds * 1000 : order.deadline).format('DD/MM HH:mm') : 'N/A'}
                                </div>
                            </div>
                        </Col>
                    </Row>

                    <Divider />

                    <Title level={5}>Sample Files</Title>
                    {/* Placeholder for Sample Images */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {order.sampleFiles && order.sampleFiles.length > 0 ? (
                            order.sampleFiles.map((_, idx) => (
                                <div key={idx} style={{ width: 80, height: 80, background: '#eee', borderRadius: 4 }}></div>
                            ))
                        ) : <Text type="secondary" italic>No samples</Text>}
                    </div>
                </Col>

                <Col span={10}>
                    {renderWorkZone()}
                </Col>
            </Row>
        </Modal>
    );
};

export default TaskDetailModal;
