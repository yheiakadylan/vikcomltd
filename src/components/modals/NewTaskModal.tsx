import React, { useState, useEffect } from 'react';
import { useDebounce } from '../../utils/useDebounce';
import { Modal, Form, Input, Button, Switch, Row, Col, message, Tooltip, Table, Tag, Avatar } from 'antd';
import { UploadOutlined, FireOutlined, DeleteOutlined, EyeOutlined, CloudUploadOutlined, PictureOutlined, SyncOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { colors } from '../../theme/themeConfig';
import type { Order } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { doc, setDoc, collection } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useUpload } from '../../contexts/UploadContext';
import { useLanguage } from '../../contexts/LanguageContext';
import dayjs from 'dayjs';
import ImagePreview from '../common/ImagePreview';

const { TextArea } = Input;

interface NewTaskModalProps {
    open: boolean;
    onCancel: () => void;
    onSuccess: () => void;
}

interface CustomFile {
    uid: string;
    file: File;
    name: string; // Editable name
    preview: string;
    size: number;
}

interface LarkItem {
    name: string;
    variant: string;
    quantity: number;
    price: number;
    transactionId: string;
    image: string;
}

interface LarkOrder {
    firstName: string;
    lastName: string;
    items: LarkItem[];
}

const NewTaskModal: React.FC<NewTaskModalProps> = ({ open, onCancel, onSuccess }) => {
    const [form] = Form.useForm();
    const { appUser: user } = useAuth();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [isUrgent, setIsUrgent] = useState(false);

    // Auto-Fill States
    const [itemsModalOpen, setItemsModalOpen] = useState(false);
    const [fetchedOrder, setFetchedOrder] = useState<LarkOrder | null>(null);
    const [fetching, setFetching] = useState(false);
    const [autoFillVisible, setAutoFillVisible] = useState(false); // To show small popup for single item

    const [orderIdInput, setOrderIdInput] = useState('');
    const debouncedOrderId = useDebounce(orderIdInput, 800);

    // File States
    const [mockupFile, setMockupFile] = useState<CustomFile | null>(null);
    const [customerFiles, setCustomerFiles] = useState<CustomFile[]>([]);

    // Preview Modal State
    const [previewImage, setPreviewImage] = useState<string>('');
    const [previewVisible, setPreviewVisible] = useState(false);

    // Reset on open
    useEffect(() => {
        if (open) {
            form.resetFields();
            setMockupFile(null);
            setCustomerFiles([]);
            setIsUrgent(false);
            setFetchedOrder(null);
            setOrderIdInput('');
            setAutoFillVisible(false);
        }
    }, [open, form]);

    // Fetch Order Data Effect
    useEffect(() => {
        // Sanitize check: Ensure numeric/clean ID and sufficient length
        const cleanId = debouncedOrderId.trim();
        if (!cleanId || cleanId.length < 5) return;

        const fetchOrder = async () => {
            setFetching(true);
            message.loading({ content: 'Đang tìm thông tin đơn hàng...', key: 'fetchOrder', duration: 0 }); // Indefinite loading

            try {
                // Encode the ID to prevent URL injection
                const encodedId = encodeURIComponent(cleanId);
                const res = await fetch(`https://dashboardvikcom.vercel.app/api/lark-events?action=get-order-detail&secret=test1234&orderId=${encodedId}`);

                if (res.ok) {
                    const data: LarkOrder = await res.json();
                    if (data && data.items && data.items.length > 0) {
                        setFetchedOrder(data);
                        message.success({ content: t('autoFill.found'), key: 'fetchOrder' });

                        if (data.items.length === 1) {
                            setAutoFillVisible(true);
                        } else {
                            setItemsModalOpen(true);
                        }
                    } else {
                        setFetchedOrder(null);
                        message.info({ content: 'Không tìm thấy đơn hàng', key: 'fetchOrder' });
                    }
                } else {
                    message.error({ content: 'Lỗi kết nối server', key: 'fetchOrder' });
                }
            } catch (error) {
                console.error("Fetch order error", error);
                message.destroy('fetchOrder'); // Silent fail or cleanup
            } finally {
                setFetching(false);
            }
        };

        fetchOrder();
    }, [debouncedOrderId, t]);

    const fillFormData = async (item: LarkItem) => {
        setFetching(true);
        try {
            form.setFieldsValue({
                title: item.name,
                description: item.variant
            });

            if (item.image) {
                // Try to download image using CORS Proxy
                try {
                    console.log('Fetching image via proxy:', item.image);
                    const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(item.image)}&output=jpg`;
                    const response = await fetch(proxyUrl);

                    if (!response.ok) throw new Error('Proxy fetch failed');

                    const blob = await response.blob();
                    const fileName = `mockup_${Date.now()}.jpg`;
                    const file = new File([blob], fileName, { type: 'image/jpeg' });

                    setMockupFile({
                        uid: 'mockup-auto-' + Date.now(),
                        file,
                        name: fileName,
                        preview: URL.createObjectURL(file),
                        size: file.size
                    });
                    message.success(t('autoFill.fillSuccess'));
                } catch (imgErr) {
                    console.error("Could not fetch image for auto-fill", imgErr);
                    // Fallback: Just warn, data is already filled
                    message.warning(t('autoFill.imageError'));
                }
            } else {
                message.success(t('autoFill.fillSuccess'));
            }

            setItemsModalOpen(false);
            setAutoFillVisible(false);
        } catch (err) {
            console.error(err);
            message.error(t('autoFill.fetchError'));
        } finally {
            setFetching(false);
        }
    };

    const handleOrderIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Simple sanitization: remove non-printable characters or excessive length if needed
        // For now, just direct input
        setOrderIdInput(e.target.value);
        if (autoFillVisible) setAutoFillVisible(false);
    };

    const { enqueue, registerCompletionAction } = useUpload();

    const handlePreview = (url: string) => {
        setPreviewImage(url);
        setPreviewVisible(true);
    };

    const handleMockupSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const objectUrl = URL.createObjectURL(file);
            setMockupFile({
                uid: 'mockup-' + Date.now(),
                file,
                name: file.name,
                preview: objectUrl,
                size: file.size
            });
        }
        e.target.value = '';
    };

    const handleCustomerFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).map((file, index) => {
                const lastDot = file.name.lastIndexOf('.');
                const nameWithoutExt = lastDot !== -1 ? file.name.substring(0, lastDot) : file.name;
                return {
                    uid: `cust-${Date.now()}-${index}`,
                    file,
                    name: nameWithoutExt,
                    preview: URL.createObjectURL(file),
                    size: file.size
                };
            });
            setCustomerFiles(prev => [...prev, ...newFiles]);
        }
        e.target.value = '';
    };

    const handleRemoveCustomerFile = (uid: string) => {
        setCustomerFiles(prev => prev.filter(f => f.uid !== uid));
    };

    const handleRenameCustomerFile = (uid: string, newName: string) => {
        setCustomerFiles(prev => prev.map(f => f.uid === uid ? { ...f, name: newName } : f));
    };

    const onFinish = async (values: any) => {
        if (!user) return;

        if (!mockupFile) {
            message.error('Vui lòng tải lên ảnh Mockup (Bắt buộc)!');
            return;
        }

        setLoading(true);
        try {
            const readableId = values.readableId;
            const year = dayjs().format('YYYY');
            const month = dayjs().format('MM');
            const safeTitle = (values.title || '')
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/đ/g, "d").replace(/Đ/g, "D")
                .replace(/[^a-zA-Z0-9]/g, "_")
                .substring(0, 50);

            const skuPart = values.sku ? `${values.sku}_` : '';
            const dropboxPath = `/PINK_POD_SYSTEM/${year}/${month}/${readableId}_${skuPart}${safeTitle}`;

            const newOrderRef = doc(collection(db, "tasks"));
            const orderId = newOrderRef.id;

            // 1. Create Order FIRST
            const orderData: Partial<Order> = {
                id: orderId,
                readableId: readableId,
                title: values.title || '',
                sku: values.sku || '',
                description: values.description || '',
                status: 'new',
                isUrgent: isUrgent,
                createdBy: user.uid || '',
                dropboxPath: dropboxPath,
                mockupUrl: '',
                customerFiles: [],
                sampleFiles: [],
                created_at: new Date(),
                updatedAt: new Date(),
            };

            await setDoc(newOrderRef, orderData);

            // Register completion action BEFORE enqueuing to be safe
            registerCompletionAction(orderId, 'notify_creation');

            // 2. Enqueue Mockup
            const originalMockupName = mockupFile.file.name;
            const lastDot = originalMockupName.lastIndexOf('.');
            const ext = lastDot !== -1 ? originalMockupName.substring(lastDot) : '';
            const finalMockupName = `mockup${ext}`;
            const renamedMockupFile = new File([mockupFile.file], finalMockupName, { type: mockupFile.file.type });

            enqueue([renamedMockupFile], orderId, 'mockupUrl', `${dropboxPath}/Mockup`, readableId);

            // 3. Enqueue Customer Files
            if (customerFiles.length > 0) {
                const filesToUpload = customerFiles.map(cFile => {
                    const originalName = cFile.file.name;
                    const lastDot = originalName.lastIndexOf('.');
                    const ext = lastDot !== -1 ? originalName.substring(lastDot) : '';
                    const finalName = cFile.name + ext; // User edited name + ext

                    return new File([cFile.file], finalName, { type: cFile.file.type });
                });

                enqueue(filesToUpload, orderId, 'customerFiles', `${dropboxPath}/Customer`, readableId);
            }

            message.success('Đã tạo task! File đang được upload nền...');
            onSuccess();
        } catch (error) {
            console.error(error);
            message.error('Có lỗi xảy ra!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={<span style={{ color: colors.primaryPink, fontSize: 20, fontWeight: 700 }}>{t('newTask.title')}</span>}
            open={open}
            onCancel={onCancel}
            footer={null}
            width={800}
            style={{ top: 20 }}
            maskClosable={false}
            className="pinky-modal"
        >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <span style={{ marginRight: 8, fontWeight: 500, color: isUrgent ? colors.urgentRed : '#8c8c8c' }}>{t('newTask.urgentQuestion')}</span>
                <Switch
                    checked={isUrgent}
                    onChange={setIsUrgent}
                    checkedChildren={<FireOutlined />}
                    unCheckedChildren={<FireOutlined />}
                    style={{ background: isUrgent ? colors.urgentRed : undefined }}
                />
            </div>

            <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
            >
                <Row gutter={24}>
                    <Col span={10}>
                        {/* MOCKUP IMAGE (Required) */}
                        <Form.Item label={<span style={{ fontWeight: 600 }}>{t('newTask.form.mockup')}</span>}>
                            <div className="mockup-uploader" style={{
                                width: '100%',
                                aspectRatio: '1/1',
                                border: `2px dashed ${mockupFile ? colors.primaryPink : '#d9d9d9'}`,
                                borderRadius: 12,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                background: mockupFile ? '#fff0f6' : '#fafafa',
                                cursor: 'pointer',
                                position: 'relative',
                                overflow: 'hidden',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                            }}
                                onClick={() => !mockupFile && document.getElementById('mockup-input')?.click()}
                                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = colors.primaryPink; e.currentTarget.style.background = '#fff0f6'; }}
                                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = mockupFile ? colors.primaryPink : '#d9d9d9'; e.currentTarget.style.background = mockupFile ? '#fff0f6' : '#fafafa'; }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.currentTarget.style.borderColor = mockupFile ? colors.primaryPink : '#d9d9d9';
                                    e.currentTarget.style.background = mockupFile ? '#fff0f6' : '#fafafa';
                                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                        const file = e.dataTransfer.files[0];
                                        setMockupFile({
                                            uid: 'mockup-' + Date.now(),
                                            file,
                                            name: file.name,
                                            preview: URL.createObjectURL(file),
                                            size: file.size
                                        });
                                    }
                                }}
                            >
                                {mockupFile ? (
                                    <>
                                        <div style={{ width: '100%', height: '100%', padding: 8 }}>
                                            <img
                                                src={mockupFile.preview}
                                                alt="Mockup"
                                                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8 }}
                                            />
                                        </div>
                                        <div style={{
                                            position: 'absolute',
                                            top: 0, left: 0, right: 0, bottom: 0,
                                            background: 'rgba(0,0,0,0.6)',
                                            backdropFilter: 'blur(2px)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            gap: 12,
                                            opacity: 0,
                                            transition: 'opacity 0.2s',
                                            borderRadius: 12
                                        }}
                                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                                        >
                                            <Button type="primary" shape="round" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); handlePreview(mockupFile.preview); }}>Xem</Button>
                                            <Button shape="round" icon={<UploadOutlined />} onClick={(e) => { e.stopPropagation(); document.getElementById('mockup-input')?.click(); }}>Thay đổi</Button>
                                            <Button danger shape="round" icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); setMockupFile(null); }}>Xóa</Button>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ textAlign: 'center', color: '#8c8c8c', padding: 20 }}>
                                        <div style={{
                                            width: 64, height: 64, background: '#fff0f6', borderRadius: '50%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                                            color: colors.primaryPink
                                        }}>
                                            <PictureOutlined style={{ fontSize: 32 }} />
                                        </div>
                                        <div style={{ fontSize: 16, fontWeight: 500, color: '#262626' }}>Tải ảnh Mockup</div>
                                        <div style={{ fontSize: 13, marginTop: 4 }}>Kéo thả hoặc Click để chọn (Chưa upload)</div>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    id="mockup-input"
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                    onChange={handleMockupSelect}
                                />
                            </div>
                        </Form.Item>
                    </Col>
                    <Col span={14}>
                        <Form.Item name="readableId" label={t('newTask.form.orderId')} rules={[{ required: true, message: 'Vui lòng nhập Order ID' }]}>
                            <div style={{ position: 'relative' }}>
                                <Input
                                    placeholder={t('newTask.form.orderId')}
                                    size="large"
                                    style={{ borderRadius: 8 }}
                                    value={orderIdInput}
                                    onChange={handleOrderIdChange}
                                    suffix={
                                        <div style={{ width: 20, display: 'flex', justifyContent: 'center' }}>
                                            {fetching && <SyncOutlined spin style={{ color: colors.primaryPink }} />}
                                            {!fetching && fetchedOrder && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                                        </div>
                                    }
                                />
                                {autoFillVisible && fetchedOrder?.items?.length === 1 && (
                                    <div style={{
                                        position: 'absolute', top: '100%', left: 0, zIndex: 10,
                                        marginTop: 8, background: '#fff',
                                        padding: '8px 12px', borderRadius: 8,
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                        border: '1px solid #f0f0f0',
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        width: '100%'
                                    }}>
                                        <div style={{ flex: 1, fontSize: 13 }}>
                                            <span style={{ fontWeight: 600 }}>{fetchedOrder.firstName} {fetchedOrder.lastName}</span>:
                                            <span style={{ color: '#8c8c8c', marginLeft: 4 }}>{fetchedOrder.items[0].name.substring(0, 30)}...</span>
                                        </div>
                                        <Button
                                            type="primary"
                                            size="small"
                                            onClick={() => fillFormData(fetchedOrder.items[0])}
                                            loading={fetching}
                                            style={{ background: colors.primaryPink, borderColor: colors.primaryPink }}
                                        >
                                            Fill Data
                                        </Button>
                                    </div>
                                )}
                                {fetchedOrder && fetchedOrder.items.length > 1 && (
                                    <div style={{ marginTop: 4, textAlign: 'right' }}>
                                        <Button type="link" size="small" onClick={() => setItemsModalOpen(true)}>
                                            {t('autoFill.found')} ({fetchedOrder.items.length} items) - Click to Select
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </Form.Item>

                        <Form.Item name="title" label={t('newTask.form.taskId')}>
                            <Input placeholder={t('newTask.form.taskId')} style={{ borderRadius: 8 }} />
                        </Form.Item>

                        <Form.Item name="sku" label={t('newTask.form.sku')}>
                            <Input placeholder={t('newTask.form.sku')} style={{ borderRadius: 8 }} />
                        </Form.Item>

                        <Form.Item name="description" label={t('newTask.form.desc')}>
                            <TextArea rows={4} placeholder={t('newTask.form.desc')} style={{ borderRadius: 8 }} />
                        </Form.Item>
                    </Col>
                </Row>

                <div style={{ margin: '24px 0', height: 1, background: '#f0f0f0' }} />

                {/* CUSTOMER FILES (Optional) */}
                <Form.Item label={<span style={{ fontWeight: 600 }}>{t('newTask.form.customerFiles')}</span>}>
                    <div
                        style={{
                            border: `2px dashed ${customerFiles.length > 0 ? colors.primaryPink : '#d9d9d9'}`,
                            padding: '32px 24px',
                            borderRadius: 12,
                            textAlign: 'center',
                            background: '#fafafa',
                            marginBottom: 24,
                            cursor: 'pointer',
                            transition: 'all 0.3s'
                        }}
                        onClick={() => document.getElementById('customer-input')?.click()}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.primaryPink; e.currentTarget.style.background = '#fff0f6'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = customerFiles.length > 0 ? colors.primaryPink : '#d9d9d9'; e.currentTarget.style.background = '#fafafa'; }}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = colors.primaryPink; e.currentTarget.style.background = '#fff0f6'; }}
                        onDragLeave={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#d9d9d9'; e.currentTarget.style.background = '#fafafa'; }}
                        onDrop={(e) => {
                            e.preventDefault();
                            if (e.dataTransfer.files) {
                                const newFiles = Array.from(e.dataTransfer.files).map((file, index) => {
                                    const lastDot = file.name.lastIndexOf('.');
                                    const nameWithoutExt = lastDot !== -1 ? file.name.substring(0, lastDot) : file.name;
                                    return {
                                        uid: `cust-drop-${Date.now()}-${index}`,
                                        file,
                                        name: nameWithoutExt,
                                        preview: URL.createObjectURL(file),
                                        size: file.size
                                    };
                                });
                                setCustomerFiles(prev => [...prev, ...newFiles]);
                            }
                        }}
                    >
                        <CloudUploadOutlined style={{ fontSize: 48, color: colors.primaryPink, marginBottom: 16 }} />
                        <div style={{ fontSize: 16, fontWeight: 500 }}>{t('newTask.form.clickToUpload')}</div>
                        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{t('newTask.form.waitingUpload')}</div>
                        <input
                            type="file"
                            id="customer-input"
                            style={{ display: 'none' }}
                            multiple
                            accept="image/*"
                            onChange={handleCustomerFilesSelect}
                        />
                    </div>

                    {/* Custom File List */}
                    {customerFiles.length > 0 && (
                        <>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#fa8c16', marginBottom: 12 }}>
                                {t('newTask.form.staged')} ({customerFiles.length})
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                gap: 16
                            }}>
                                {customerFiles.map((file, index) => (
                                    <div key={file.uid} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: 12,
                                        background: '#fff',
                                        border: '1px solid #ffadd2',
                                        borderRadius: 12,
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                    }}>
                                        <div
                                            style={{
                                                width: 48, height: 48, flexShrink: 0,
                                                cursor: 'pointer', overflow: 'hidden', borderRadius: 8,
                                                border: '1px solid #f0f0f0'
                                            }}
                                            onClick={() => handlePreview(file.preview)}
                                        >
                                            <img src={file.preview} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>

                                        <div style={{ flex: 1, marginLeft: 12, marginRight: 12, overflow: 'hidden' }}>
                                            <Input
                                                value={file.name}
                                                onChange={(e) => handleRenameCustomerFile(file.uid, e.target.value)}
                                                variant="borderless"
                                                style={{ padding: 0, fontWeight: 500, width: '100%' }}
                                                suffix={<span style={{ color: '#8c8c8c' }}>{(() => {
                                                    const originalName = file.file.name;
                                                    const lastDot = originalName.lastIndexOf('.');
                                                    return lastDot !== -1 ? originalName.substring(lastDot) : '';
                                                })()}</span>}
                                                prefix={<span style={{ color: '#999', marginRight: 4, fontWeight: 700 }}>#{index + 1}</span>}
                                            />
                                            <div style={{ fontSize: 11, color: '#8c8c8c' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                                        </div>

                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <Tooltip title="Xem">
                                                <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handlePreview(file.preview)} />
                                            </Tooltip>
                                            <Tooltip title="Xóa">
                                                <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemoveCustomerFile(file.uid)} />
                                            </Tooltip>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </Form.Item>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 32, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                    <Button onClick={onCancel} size="large" style={{ borderRadius: 8 }}>{t('common.cancel')}</Button>
                    <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        loading={loading}
                        style={{
                            background: colors.primaryPink,
                            borderColor: colors.primaryPink,
                            borderRadius: 8,
                            paddingLeft: 32,
                            paddingRight: 32,
                            fontWeight: 600,
                            boxShadow: '0 2px 0 rgba(235, 47, 150, 0.2)'
                        }}
                    >
                        {t('newTask.form.submit')}
                    </Button>
                </div>
            </Form>
            <ImagePreview
                src={previewImage}
                visible={previewVisible}
                onClose={() => setPreviewVisible(false)}
            />

            <Modal
                title={t('autoFill.selectItem')}
                open={itemsModalOpen}
                onCancel={() => setItemsModalOpen(false)}
                footer={null}
                width={700}
            >
                {fetchedOrder && (
                    <Table
                        dataSource={fetchedOrder.items}
                        rowKey="transactionId"
                        pagination={false}
                        columns={[
                            {
                                title: 'Image',
                                dataIndex: 'image',
                                width: 80,
                                render: (src) => <Avatar src={src} shape="square" size={64} />
                            },
                            {
                                title: 'Item Details',
                                dataIndex: 'name',
                                render: (text, record) => (
                                    <div>
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{text}</div>
                                        <div style={{ fontSize: 12, color: '#666', whiteSpace: 'pre-wrap' }}>{record.variant}</div>
                                        <Tag color="blue" style={{ marginTop: 4 }}>Qty: {record.quantity}</Tag>
                                        <Tag color="green">Transaction: {record.transactionId}</Tag>
                                    </div>
                                )
                            },
                            {
                                title: 'Action',
                                width: 100,
                                render: (_, record) => (
                                    <Button
                                        type="primary"
                                        size="small"
                                        onClick={() => fillFormData(record)}
                                        loading={fetching}
                                    >
                                        Select
                                    </Button>
                                )
                            }
                        ]}
                    />
                )}
            </Modal>
        </Modal >
    );
};

export default NewTaskModal;
