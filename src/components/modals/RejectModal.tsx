import React, { useState } from 'react';
import { Modal, Input, Checkbox, Button, message } from 'antd';
import type { Order } from '../../types';
import { updateOrder } from '../../services/firebase';

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

    const handleReject = async () => {
        if (!reason.trim()) {
            message.error('Vui lòng nhập lý do từ chối!');
            return;
        }
        if (!order) return;

        setLoading(true);
        try {
            await updateOrder(order.id, {
                status: 'need_fix',
                isUrgent: isUrgent, // Update Urgent flag
                // Potentially append reason to logs or description
                description: order.description + `\n\n[REJECTED]: ${reason}`
            });
            message.success('Đã trả đơn về Need Fix!');
            onSuccess();
            onCancel();
            setReason('');
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
