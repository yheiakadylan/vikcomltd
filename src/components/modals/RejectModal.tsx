import React, { useState } from 'react';
import { Modal, Input, Checkbox, Button, message } from 'antd';
import { colors } from '../../theme/themeConfig';
import type { Order } from '../../types';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';

const { TextArea } = Input;

interface RejectModalProps {
    order: Order | null;
    open: boolean;
    onCancel: () => void;
    onSuccess: () => void;
}

const RejectModal: React.FC<RejectModalProps> = ({ order, open, onCancel, onSuccess }) => {
    const [reason, setReason] = useState('');
    const [isUrgent, setIsUrgent] = useState(true);
    const [loading, setLoading] = useState(false);

    const handleReject = async () => {
        if (!order) return;
        if (!reason.trim()) {
            message.error("Vui lòng nhập lý do từ chối!");
            return;
        }

        setLoading(true);
        try {
            await updateDoc(doc(db, "orders", order.id), {
                status: 'need_fix',
                isUrgent: isUrgent,
                // Append log logic could go here
                description: order.description + `\n\n[REJECTED]: ${reason}` // Simple append for now
            });
            message.success("Đã từ chối task!");
            setReason('');
            onSuccess();
        } catch (e) {
            console.error(e);
            message.error("Lỗi khi từ chối task");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={<span style={{ color: colors.urgentRed }}>Từ chối thiết kế (Reject)</span>}
            open={open}
            onCancel={onCancel}
            footer={[
                <Button key="cancel" onClick={onCancel}>Hủy</Button>,
                <Button key="submit" type="primary" danger loading={loading} onClick={handleReject}>
                    Xác nhận Từ chối
                </Button>
            ]}
        >
            <p>Vui lòng nhập lý do để Designer chỉnh sửa:</p>
            <TextArea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ví dụ: Font chữ chưa đúng, màu hơi nhạt..."
                style={{ marginBottom: 16 }}
            />
            <Checkbox
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
                style={{ color: colors.urgentRed, fontWeight: 500 }}
            >
                Đánh dấu URGENT (Ưu tiên sửa gấp)
            </Checkbox>
        </Modal>
    );
};

export default RejectModal;
