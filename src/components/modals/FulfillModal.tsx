import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message, List, Image, Alert } from 'antd';
import { SendOutlined, FileImageOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { Order, FileAttachment } from '../../types';
import { getOptimizedImageUrl } from '../../utils/image';

interface FulfillModalProps {
    open: boolean;
    order: Order | null;
    onCancel: () => void;
    onSuccess: () => void;
}

/**
 * Fulfill Modal - Allows user to select design files and confirm order ID before fulfilling to Merchize
 */
const FulfillModal: React.FC<FulfillModalProps> = ({ open, order, onCancel, onSuccess }) => {
    const [form] = Form.useForm();
    const [selectedFile, setSelectedFile] = useState<FileAttachment | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open && order) {
            // Pre-fill form with order data
            form.setFieldsValue({
                orderId: order.readableId,
                title: order.title,
                sku: order.sku || ''
            });

            // Auto-select first design file if available
            if (order.designFiles && order.designFiles.length > 0) {
                setSelectedFile(order.designFiles[0]);
            }
        }
    }, [open, order, form]);

    const handleFulfill = async () => {
        try {
            setSubmitting(true);

            // Validate form
            const values = await form.validateFields();

            if (!selectedFile) {
                message.error('Vui lòng chọn design file để fulfill');
                return;
            }

            // Check if extension is installed
            // Check BOTH window AND localStorage (in case window object was reset by React/navigation)
            console.log('[Fulfill] Starting extension check...');
            console.log('[Fulfill] window.podExtensionInstalled =', (window as any).podExtensionInstalled);
            console.log('[Fulfill] localStorage.podExtensionInstalled =', localStorage.getItem('podExtensionInstalled'));

            const checkExtension = async (retries = 3, delay = 300): Promise<boolean> => {
                for (let i = 0; i < retries; i++) {
                    // Check BOTH window and localStorage
                    const windowFlag = (window as any).podExtensionInstalled;
                    const storageFlag = localStorage.getItem('podExtensionInstalled') === 'true';
                    const isInstalled = windowFlag === true || storageFlag === true;

                    console.log(`[Fulfill] Check attempt ${i + 1}/${retries}`);
                    console.log(`  window flag = ${windowFlag}`);
                    console.log(`  storage flag = ${storageFlag}`);
                    console.log(`  result = ${isInstalled}`);

                    if (isInstalled) {
                        console.log('[Fulfill] ✅ Extension detected!');
                        // If found in localStorage but not window, restore window flag
                        if (!windowFlag && storageFlag) {
                            console.log('[Fulfill] Restoring window flag from localStorage');
                            (window as any).podExtensionInstalled = true;
                        }
                        return true;
                    }

                    if (i < retries - 1) {
                        console.log(`[Fulfill] Waiting ${delay}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
                console.log('[Fulfill] ❌ Extension not detected after all retries');
                return false;
            };

            const extensionInstalled = await checkExtension();
            console.log('[Fulfill] Final result: extensionInstalled =', extensionInstalled);

            if (!extensionInstalled) {
                console.log('[Fulfill] Redirecting to /extension...');
                message.warning(
                    'Vui lòng cài đặt POD Merchize Fulfillment Extension để sử dụng tính năng này.'
                );
                window.open('/extension', '_blank');
                return;
            }

            console.log('[Fulfill] Proceeding with fulfill request...');

            // Prepare fulfillment data
            const fulfillmentData = {
                id: order!.id,
                readableId: values.orderId, // Use the editable order ID
                sku: values.sku || '',
                title: values.title || '',
                designFiles: [selectedFile] // Only send selected file
            };

            // Send fulfill request via custom event
            try {
                const response = await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Extension không phản hồi sau 5 giây'));
                    }, 5000);

                    // Listen for response
                    const handleResponse = (event: Event) => {
                        clearTimeout(timeout);
                        window.removeEventListener('POD_FULFILL_RESPONSE', handleResponse);

                        const customEvent = event as CustomEvent;
                        if (customEvent.detail.success) {
                            resolve(customEvent.detail.response);
                        } else {
                            reject(new Error(customEvent.detail.error || 'Extension error'));
                        }
                    };

                    window.addEventListener('POD_FULFILL_RESPONSE', handleResponse);

                    // Dispatch fulfill request
                    window.dispatchEvent(new CustomEvent('POD_FULFILL_REQUEST', {
                        detail: { orderData: fulfillmentData }
                    }));
                });

                if ((response as any)?.success !== false) {
                    message.success('Đang mở Merchize để fulfill đơn hàng...');
                    onSuccess();
                } else {
                    throw new Error((response as any)?.error || 'Extension error');
                }

            } catch (extError: any) {
                // Extension not installed or not responding
                console.error('Extension communication error:', extError);
                message.error({
                    content: (
                        <div>
                            <div>Không thể kết nối với Extension.</div>
                            <div style={{ fontSize: 12, marginTop: 4 }}>
                                Vui lòng đảm bảo extension đã được cài đặt và enabled.
                            </div>
                        </div>
                    ),
                    duration: 5
                });

                // Offer to open extension page
                setTimeout(() => {
                    if (window.confirm('Bạn có muốn mở trang cài đặt extension không?')) {
                        window.open('/extension', '_blank');
                    }
                }, 1000);
            }

        } catch (error: any) {
            console.error('Fulfill error:', error);

            if (error.errorFields) {
                message.error('Vui lòng nhập đầy đủ thông tin');
            } else {
                message.error('Lỗi khi fulfill đơn hàng: ' + (error.message || 'Unknown error'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setSelectedFile(null);
        onCancel();
    };

    return (
        <Modal
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <SendOutlined style={{ fontSize: 20, color: '#667eea' }} />
                    <span style={{ fontWeight: 700, fontSize: 18 }}>Fulfill to Merchize</span>
                </div>
            }
            open={open}
            onCancel={handleCancel}
            width={700}
            footer={[
                <Button key="cancel" onClick={handleCancel}>
                    Hủy
                </Button>,
                <Button
                    key="fulfill"
                    type="primary"
                    onClick={handleFulfill}
                    loading={submitting}
                    disabled={!selectedFile}
                    icon={<SendOutlined />}
                    style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderColor: '#667eea'
                    }}
                >
                    Fulfill Ngay
                </Button>
            ]}
        >
            <Alert
                message="Extension sẽ tự động mở Merchize và fulfill đơn hàng"
                description={
                    <div>
                        <div>• Tìm đơn hàng theo Order ID (External Number)</div>
                        <div>• Upload design file đã chọn</div>
                        <div>• Bạn có thể sửa Order ID nếu cần</div>
                    </div>
                }
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
            />

            <Form form={form} layout="vertical">
                <Form.Item
                    name="orderId"
                    label={<span style={{ fontWeight: 600 }}>Order ID (External Number trên Merchize)</span>}
                    rules={[{ required: true, message: 'Vui lòng nhập Order ID' }]}
                    tooltip="ID này sẽ được dùng để tìm kiếm trên Merchize. Bạn có thể sửa nếu cần."
                >
                    <Input
                        placeholder="Nhập Order ID"
                        style={{ fontSize: 16, fontWeight: 600 }}
                    />
                </Form.Item>

                <Form.Item
                    name="title"
                    label={<span style={{ fontWeight: 600 }}>Tên đơn hàng</span>}
                >
                    <Input disabled />
                </Form.Item>

                <Form.Item
                    name="sku"
                    label={<span style={{ fontWeight: 600 }}>SKU</span>}
                >
                    <Input placeholder="SKU (tùy chọn)" />
                </Form.Item>

                <Form.Item
                    label={<span style={{ fontWeight: 600 }}>Chọn Design File</span>}
                    required
                >
                    <div style={{
                        background: '#f5f7fa',
                        borderRadius: 8,
                        padding: 16,
                        border: selectedFile ? '2px solid #667eea' : '1px solid #e0e0e0'
                    }}>
                        {order?.designFiles && order.designFiles.length > 0 ? (
                            <List
                                dataSource={order.designFiles}
                                renderItem={(file, index) => {
                                    const isSelected = selectedFile?.link === file.link;
                                    const isImage = /\.(jpeg|jpg|png|gif|webp|svg)$/i.test(file.name);

                                    return (
                                        <div
                                            key={index}
                                            onClick={() => setSelectedFile(file)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 12,
                                                padding: 12,
                                                background: isSelected ? '#e6f0ff' : '#fff',
                                                border: isSelected ? '2px solid #667eea' : '1px solid #e0e0e0',
                                                borderRadius: 8,
                                                marginBottom: 8,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {/* Checkbox */}
                                            <div style={{
                                                width: 24,
                                                height: 24,
                                                borderRadius: '50%',
                                                border: isSelected ? '2px solid #667eea' : '2px solid #d0d0d0',
                                                background: isSelected ? '#667eea' : 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                {isSelected && <CheckCircleOutlined style={{ color: 'white', fontSize: 14 }} />}
                                            </div>

                                            {/* Thumbnail */}
                                            <div style={{
                                                width: 60,
                                                height: 60,
                                                borderRadius: 6,
                                                overflow: 'hidden',
                                                border: '1px solid #e0e0e0',
                                                flexShrink: 0,
                                                background: '#fafafa'
                                            }}>
                                                {isImage ? (
                                                    <Image
                                                        src={getOptimizedImageUrl(file.link, 120, 120, 'cover')}
                                                        alt={file.name}
                                                        width={60}
                                                        height={60}
                                                        style={{ objectFit: 'cover' }}
                                                        preview={false}
                                                    />
                                                ) : (
                                                    <div style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        <FileImageOutlined style={{ fontSize: 28, color: '#999' }} />
                                                    </div>
                                                )}
                                            </div>

                                            {/* File Info */}
                                            <div style={{ flex: 1 }}>
                                                <div style={{
                                                    fontWeight: isSelected ? 600 : 500,
                                                    color: isSelected ? '#667eea' : '#333',
                                                    fontSize: 14,
                                                    marginBottom: 4
                                                }}>
                                                    {file.name}
                                                </div>
                                                <div style={{ fontSize: 12, color: '#999' }}>
                                                    {isSelected && '✓ Đã chọn'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }}
                            />
                        ) : (
                            <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                                Không có design file
                            </div>
                        )}
                    </div>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default FulfillModal;
