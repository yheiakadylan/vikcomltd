import React, { useState } from 'react';
import { Modal, Button, message, Typography } from 'antd';
import type { Order } from '../../types';

import { updateOrder } from '../../services/firebase';

const { Text } = Typography;

interface GiveBackModalProps {
    order: Order | null;
    open: boolean;
    onCancel: () => void;
    onSuccess: () => void;
}

const GiveBackModal: React.FC<GiveBackModalProps> = ({ order, open, onCancel, onSuccess }) => {
    const [loading, setLoading] = useState(false);

    const handleGiveBack = async () => {
        if (!order) return;
        setLoading(true);
        try {
            await updateOrder(order.id, {
                status: 'new',
                designerId: null,
                updatedAt: new Date()
            });
            message.success("Đã trả lại task!");
            onSuccess();
            onCancel();
        } catch (e) {
            console.error(e);
            message.error("Lỗi khi trả task");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Trả lại task (Give Back)"
            open={open}
            onCancel={onCancel}
            footer={[
                <Button key="cancel" onClick={onCancel}>Hủy</Button>,
                <Button key="submit" type="primary" danger ghost loading={loading} onClick={handleGiveBack}>
                    Xác nhận Trả
                </Button>
            ]}
        >
            <Text>Bạn có chắc chắn muốn trả lại task <Text strong>#{order?.readableId}</Text>?</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>Task sẽ quay lại trạng thái "New" để Designer khác có thể nhận.</Text>
        </Modal>
    );
};

export default GiveBackModal;
