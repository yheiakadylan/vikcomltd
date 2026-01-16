import React, { useState } from 'react';
import { Modal, Input, Checkbox, Button, message, Upload } from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import type { Order } from '../../types';
import { updateOrder, uploadFileToStorage } from '../../services/firebase';
import { generateStoragePath } from '../../utils/order';

import type { UploadFile } from 'antd/es/upload/interface';

interface RejectModalProps {
    order: Order | null;
    open: boolean;
    onCancel: () => void;
    onSuccess: () => void;
}

const RejectModal: React.FC<RejectModalProps> = ({ order, open, onCancel, onSuccess }) => {
    const [reason, setReason] = useState('');
    const [isUrgent, setIsUrgent] = useState(true); // Default Urgent
    const [loading, setLoading] = useState(false);
    const [files, setFiles] = useState<UploadFile[]>([]);

    const handleReject = async () => {
        if (!reason.trim()) {
            message.error('Vui lòng nhập lý do từ chối!');
            return;
        }
        if (!order) return;
        setLoading(true);

        try {
            let descriptionUpdate = order.description + `\n\n[REJECTED]: ${reason}`;

            // Handle File Uploads
            if (files.length > 0) {
                const uploadPromises = files.map(async (file) => {
                    const storagePath = `${generateStoragePath(order as any)}/reject_evidence/${file.name}`;
                    const url = await uploadFileToStorage(file as any, storagePath);
                    return `\n- Evidence: ${url}`;
                });

                const uploadedUrls = await Promise.all(uploadPromises);
                descriptionUpdate += `\n\n[EVIDENCE]:${uploadedUrls.join('')}`;
            }

            await updateOrder(order.id, {
                status: 'need_fix',
                isUrgent: isUrgent, // Update Urgent flag
                description: descriptionUpdate
            }, false, order.collectionName);

            message.success('Đã trả đơn về Need Fix!');
            onSuccess();
            onCancel();
            setReason('');
            setFiles([]);
        } catch (error) {
            console.error(error);
            message.error('Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Từ chối duyệt đơn"
            open={open}
            onCancel={onCancel}
            footer={[
                <Button key="back" onClick={onCancel}>Hủy</Button>,
                <Button
                    key="submit"
                    type="primary"
                    danger
                    loading={loading}
                    onClick={handleReject}
                >
                    Yêu cầu sửa
                </Button>,
            ]}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Input.TextArea
                    rows={4}
                    placeholder="Nhập lý do sai sót (VD: Sai màu, sai font...)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                />
                <Upload.Dragger
                    multiple
                    accept="image/*"
                    beforeUpload={(file) => {
                        setFiles(prev => [...prev, file]);
                        return false;
                    }}
                    onRemove={(file) => {
                        setFiles(prev => prev.filter(f => f.uid !== file.uid));
                    }}
                    fileList={files}
                >
                    <p className="ant-upload-drag-icon">
                        <CloudUploadOutlined />
                    </p>
                    <p className="ant-upload-text">Kéo thả hoặc click để tải ảnh minh họa</p>
                </Upload.Dragger>
                <Checkbox
                    checked={isUrgent}
                    onChange={(e) => setIsUrgent(e.target.checked)}
                    style={{ color: '#f5222d', fontWeight: 500 }}
                >
                    Đánh dấu là GẤP (Urgent) 🔥
                </Checkbox>
            </div>
        </Modal>
    );
};

export default RejectModal;
