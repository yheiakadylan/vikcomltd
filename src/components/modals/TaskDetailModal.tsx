import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, InputNumber, DatePicker, Switch, Button, Upload, message, Tag, Row, Col } from 'antd';
import { InboxOutlined, CloudUploadOutlined, FileOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Order, FileAttachment } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { updateOrder } from '../../services/firebase';
import { uploadFileToDropbox } from '../../services/dropbox';

const { Dragger } = Upload;
const { TextArea } = Input;


interface TaskDetailModalProps {
    order: Order | null;
    open: boolean;
    onCancel: () => void;
    onUpdate: () => void;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ order, open, onCancel, onUpdate }) => {
    const { appUser } = useAuth();
    const [form] = Form.useForm();
    const [isUrgent, setIsUrgent] = useState(false);
    const [designFiles, setDesignFiles] = useState<FileAttachment[]>([]);
    const [uploading, setUploading] = useState(false);

    // Check Role
    const isCS = appUser?.role === 'CS' || appUser?.role === 'ADMIN';
    const isDS = appUser?.role === 'DS';

    // Check Status to show Delivery Zone
    const canDSWork = isDS && (order?.status === 'doing' || order?.status === 'need_fix') && order?.designerId === appUser?.uid;

    useEffect(() => {
        if (order) {
            form.setFieldsValue({
                ...order,
                deadline: order.deadline ? dayjs((order.deadline as any).seconds ? (order.deadline as any).seconds * 1000 : order.deadline) : null,
            });
            setIsUrgent(order.isUrgent);
            setDesignFiles(order.designFiles || []);
        }
    }, [order, form]);

    const handleUrgentToggle = async (checked: boolean) => {
        if (!isCS || !order) return;
        setIsUrgent(checked);
        try {
            await updateOrder(order.id, { isUrgent: checked });
            message.success(checked ? 'Đã bật chế độ GẤP 🔥' : 'Đã tắt chế độ Gấp');
            onUpdate();
        } catch (error) {
            message.error('Lỗi cập nhật');
            setIsUrgent(!checked); // Revert
        }
    };

    const handleDSSubmit = async () => {
        if (!order) return;
        try {
            await updateOrder(order.id, {
                status: 'in_review',
                designFiles: designFiles,
                updatedAt: new Date(),
            });
            message.success('Nộp bài thành công!');
            onUpdate();
            onCancel();
        } catch (error) {
            message.error('Lỗi khi nộp bài');
        }
    };

    const customUploadRequest = async (options: any) => {
        const { file, onSuccess, onError } = options;
        setUploading(true);
        try {
            if (!order) throw new Error("No order");

            const dropboxLink = await uploadFileToDropbox(file, `${order.dropboxPath}/designs/${file.name}`);
            const linkStr = (dropboxLink as any).path_display || '#';
            const newFile: FileAttachment = { name: file.name, link: linkStr };

            setDesignFiles(prev => [...prev, newFile]);
            setUploading(false);
            onSuccess("Ok");
            message.success(`Đã upload ${file.name} lên Dropbox`);
        } catch (err) {
            setUploading(false);
            onError(err);
            message.error('Upload thất bại');
            console.error(err);
        }
    };

    return (
        <Modal
            open={open}
            onCancel={onCancel}
            width={900}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ color: '#8c8c8c' }}>#{order?.readableId}</span>
                    <span style={{ fontWeight: 'bold', fontSize: 18 }}>{order?.title}</span>
                    {isCS && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
                            <span style={{ fontSize: 14, color: isUrgent ? '#f5222d' : '#bfbfbf', fontWeight: isUrgent ? 'bold' : 'normal' }}>
                                {isUrgent ? 'URGENT 🔥' : 'Urgent Mode'}
                            </span>
                            <Switch
                                checked={isUrgent}
                                onChange={handleUrgentToggle}
                                style={{ background: isUrgent ? '#f5222d' : undefined }}
                            />
                        </div>
                    )}
                    {isDS && isUrgent && <Tag color="red" style={{ marginLeft: 16 }}>URGENT 🔥</Tag>}
                </div>
            }
            footer={null}
            className={isUrgent ? 'urgent-modal-border' : ''}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* --- KHU VỰC 1: CS ZONE (INPUT) --- */}
                <div style={{ padding: 16, borderRadius: 8, border: isCS ? '1px solid #fff0f6' : '1px solid #f0f0f0', background: isCS ? '#fff' : '#fafafa' }}>
                    <div style={{ marginBottom: 8, fontWeight: 'bold', color: '#c41d7f', textTransform: 'uppercase', fontSize: 12 }}>Thông tin yêu cầu</div>
                    <Form form={form} layout="vertical" disabled={!isCS}>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="title" label="Task Title">
                                    <Input />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="sku" label="SKU (Mã SP)">
                                    <Input placeholder="Optional" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={8}>
                                <Form.Item name="category" label="Category">
                                    <Select>
                                        <Select.Option value="T-shirt">T-shirt</Select.Option>
                                        <Select.Option value="Hoodie">Hoodie</Select.Option>
                                        <Select.Option value="Mug">Mug</Select.Option>
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name="quantity" label="Quantity">
                                    <InputNumber min={1} style={{ width: '100%' }} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name="deadline" label="Deadline">
                                    <DatePicker style={{ width: '100%' }} showTime format="DD/MM/YYYY HH:mm" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Form.Item name="description" label="Description">
                            <TextArea rows={4} />
                        </Form.Item>

                        {/* Sample Files Area */}
                        <div>
                            <div style={{ color: '#8c8c8c', fontSize: 14, marginBottom: 8 }}>Ảnh mẫu (Idea):</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {order?.sampleFiles?.map((f, idx) => (
                                    <a key={idx} href={f.link} target="_blank" rel="noreferrer" style={{ display: 'block', padding: 8, border: '1px solid #d9d9d9', borderRadius: 4, color: '#1890ff', textDecoration: 'none', background: '#fff' }}>
                                        <FileOutlined /> {f.name}
                                    </a>
                                ))}
                            </div>
                        </div>
                    </Form>
                </div>

                {/* --- KHU VỰC 2: DS ZONE (DELIVERY) --- */}
                {(canDSWork || (order?.designFiles && order.designFiles.length > 0)) && (
                    <div style={{ padding: 16, borderRadius: 8, border: '2px dashed #b7eb8f', background: '#f6ffed' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ fontWeight: 'bold', color: '#389e0d', textTransform: 'uppercase', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CloudUploadOutlined style={{ fontSize: 18 }} /> KHU VỰC NỘP BÀI (DS ONLY)
                            </div>
                            {canDSWork && (
                                <Button
                                    type="primary"
                                    onClick={handleDSSubmit}
                                    disabled={designFiles.length === 0}
                                    style={{ background: '#eb2f96', borderColor: '#eb2f96' }}
                                >
                                    SUBMIT (Nộp bài)
                                </Button>
                            )}
                        </div>

                        {canDSWork ? (
                            <Dragger
                                customRequest={customUploadRequest}
                                showUploadList={false}
                                multiple
                            >
                                <p className="ant-upload-drag-icon">
                                    <InboxOutlined style={{ color: '#52c41a' }} />
                                </p>
                                <p className="ant-upload-text">Kéo thả file thiết kế Final vào đây</p>
                                <p className="ant-upload-hint">
                                    Hỗ trợ PNG, PSD, AI. File sẽ tự động lưu lên Dropbox.
                                </p>
                            </Dragger>
                        ) : (
                            <div style={{ color: '#8c8c8c', fontStyle: 'italic' }}>DS chưa nộp bài hoặc bạn không có quyền nộp.</div>
                        )}

                        {/* List Submitted Files */}
                        {designFiles.length > 0 && (
                            <div style={{ marginTop: 16, background: '#fff', padding: 12, borderRadius: 4, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                <div style={{ fontWeight: 600, marginBottom: 8 }}>Files đã nộp:</div>
                                {designFiles.map((file, index) => (
                                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                                        <a href={file.link} target="_blank" rel="noreferrer" style={{ color: '#1890ff', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <FileOutlined /> {file.name}
                                        </a>
                                        {canDSWork && (
                                            <Button type="text" danger size="small" onClick={() => {
                                                setDesignFiles(prev => prev.filter((_, i) => i !== index));
                                            }}>Xóa</Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {uploading && <div style={{ textAlign: 'center', marginTop: 8, color: '#eb2f96' }}>Đang upload lên Dropbox...</div>}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default TaskDetailModal;
