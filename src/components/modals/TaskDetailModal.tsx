import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { Modal, Form, Input, Button, Upload, message, Tag, Row, Col, Divider, Tabs, Timeline, Image } from 'antd';
import {
    CloudUploadOutlined,
    UserOutlined,
    ClockCircleOutlined,
    FileOutlined,
    SendOutlined,
    PaperClipOutlined,
    DeleteOutlined,
    CheckOutlined,
    InboxOutlined,
    SaveOutlined,
    RollbackOutlined,
    FileImageOutlined,
    DownloadOutlined,
    EyeOutlined
} from '@ant-design/icons';
import { colors } from '../../theme/themeConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getOptimizedImageUrl } from '../../utils/image';
import { generateStoragePath } from '../../utils/order';
import {
    addOrderLog,
    updateOrder,
    uploadFileToStorage,
    getOrderLogs,
    getUsers
} from '../../services/firebase';
import type { Order, OrderLog, FileAttachment } from '../../types';
import SmartImage from '../common/SmartImage';

const { TextArea } = Input;
const { Dragger } = Upload;

interface TaskDetailModalProps {
    open: boolean;
    order: Order | null;
    onCancel: () => void;
    onUpdate: () => void;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ open, order, onCancel, onUpdate }) => {
    const { user, appUser } = useAuth();
    const { t } = useLanguage();
    const [form] = Form.useForm();

    const [logs, setLogs] = useState<OrderLog[]>([]);
    const [comment, setComment] = useState('');
    const [commentFiles, setCommentFiles] = useState<File[]>([]);
    const [commentUploading, setCommentUploading] = useState(false);

    // DS Work
    const [designFiles, setDesignFiles] = useState<FileAttachment[]>([]);
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);
    const [dsUploading, setDsUploading] = useState(false);

    // Users Map
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});

    // Reject/Fix State
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectLoading, setRejectLoading] = useState(false);

    // Urgent State
    const [isUrgent, setIsUrgent] = useState(false);

    useEffect(() => {
        const fetchUsersMap = async () => {
            try {
                const usersList = await getUsers();
                const map: Record<string, string> = {};
                usersList.forEach(u => {
                    map[u.uid] = u.displayName || u.email || 'User';
                });
                setUsersMap(map);
            } catch (e) {
                console.error("Failed to fetch users for modal", e);
            }
        };
        if (open) fetchUsersMap();
    }, [open]);

    const getUserName = (uid?: string | null) => {
        if (!uid) return 'Unknown';
        return usersMap[uid] || uid;
    };



    const isCS = appUser?.role === 'CS' || appUser?.role === 'ADMIN'; // Changed 'admin' to 'ADMIN' based on types/index.ts Role type
    const isDS = appUser?.role === 'DS' || appUser?.role === 'ADMIN';
    const isAdmin = appUser?.role === 'ADMIN';

    const canClaim = isDS && order?.status === 'new' && !order.designerId;
    const canDSWork = isDS && (order?.designerId === user?.uid || isAdmin) && (order?.status === 'doing' || order?.status === 'need_fix');
    const canReview = isCS && order?.status === 'in_review';

    useEffect(() => {
        if (open && order) {
            form.setFieldsValue({
                title: order.title,
                sku: order.sku,
                description: order.description,
                category: order.category,
                quantity: order.quantity,
                deadline: order.deadline ? dayjs((order.deadline as any).seconds ? (order.deadline as any).seconds * 1000 : order.deadline) : null
            });
            setDesignFiles(order.designFiles || []);
            setStagedFiles([]);
            setIsUrgent(order.isUrgent || false);
            fetchLogs();
        }
    }, [open, order]);

    const handleUrgentToggle = async (checked: boolean) => {
        if ((!isCS && !isAdmin) || !order) return;
        setIsUrgent(checked);
        try {
            await updateOrder(order.id, { isUrgent: checked });
            message.success(checked ? t('taskDetail.header.urgentOn') : t('taskDetail.header.urgentOff'));
            onUpdate();
        } catch (error) {
            message.error('Update failed');
            setIsUrgent(!checked); // Revert
        }
    };

    const fetchLogs = async () => {
        if (order) {
            const data = await getOrderLogs(order.id);
            setLogs(data);
        }
    };

    const handleUpdateInfo = async () => {
        if (!order) return;
        try {
            const values = await form.validateFields();
            // Handle deadline if needed, but for now just basic fields
            const updateData = { ...values };
            if (updateData.deadline) delete updateData.deadline; // Don't update deadline generically yet to avoid type issues

            await updateOrder(order.id, updateData);
            message.success(t('taskDetail.info.updateSuccess') || 'Updated successfully');
            onUpdate();
        } catch (error) {
            console.error(error);
            message.error('Update failed');
        }
    };

    const handleClaim = async () => {
        if (!order || !user) return;
        try {
            await updateOrder(order.id, {
                status: 'doing',
                designerId: user.uid
            }, true); // Use skipAutoLog
            await addOrderLog(order.id, {
                action: 'status_change',
                actorId: user.uid,
                actorName: user.displayName || user.email?.split('@')[0] || 'DS', // Fallback to email prefix if needed
                details: 'Claimed task'
            });
            message.success(t('taskDetail.actions.claimSuccess') || 'Claimed');
            onUpdate();
            onCancel();
        } catch (error) {
            message.error('Claim failed');
        }
    };

    const handleReject = () => {
        setRejectReason('');
        setRejectModalOpen(true);
    };

    const submitReject = async () => {
        if (!order || !user) return;
        setRejectLoading(true);
        try {
            // Append FIX reason to description
            const currentDesc = order.description || '';
            const newDesc = `${currentDesc}\n\nFIX: ${rejectReason}`;

            await updateOrder(order.id, {
                status: 'need_fix',
                description: newDesc
            }, true); // Use skipAutoLog

            // Log with reason
            await addOrderLog(order.id, {
                action: 'status_change',
                actorId: user.uid,
                actorName: user.displayName || user.email?.split('@')[0] || 'CS',
                details: 'Requested fix',
                content: `Reason: ${rejectReason}`
            });

            message.success('Requested fix');
            onUpdate();
            setRejectModalOpen(false);
            onCancel(); // Close main modal
        } catch (e) {
            console.error(e);
            message.error('Error submitting fix request');
        } finally {
            setRejectLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!order || !user) return;
        try {
            await updateOrder(order.id, { status: 'done' }, true); // Use skipAutoLog
            await addOrderLog(order.id, {
                action: 'status_change',
                actorId: user.uid,
                actorName: user.displayName || user.email?.split('@')[0] || 'CS',
                details: 'Approved design'
            });

            // Trigger cleanup (Fire and forget)
            fetch('/api/cleanup-storage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id })
            }).catch(e => console.error("Cleanup trigger failed", e));

            message.success('Approved');
            onUpdate();
            onCancel();
        } catch (e) { message.error('Error'); }
    };

    const handleFileSelect = ({ file, onSuccess }: any) => {
        setStagedFiles(prev => [...prev, file]);
        setTimeout(() => onSuccess("ok"), 0);
    };

    const handleDSSubmit = async () => {
        if (!order || !user) return;
        setDsUploading(true);
        try {
            let uploadedFiles: FileAttachment[] = [...designFiles];
            // Upload staged files
            for (const file of stagedFiles) {
                // Generate path consistent with storage structure
                const baseStoragePath = generateStoragePath(order as any);
                const fullStoragePath = `${baseStoragePath}/Designs/${file.name}`;

                // Remove leading slash for Firebase Storage
                const firebasePath = fullStoragePath.startsWith('/') ? fullStoragePath.substring(1) : fullStoragePath;

                const url = await uploadFileToStorage(file, firebasePath);

                uploadedFiles.push({
                    name: file.name,
                    link: url,
                    type: 'image'
                });
            }

            await updateOrder(order.id, {
                status: 'in_review', // Move to review
                designFiles: uploadedFiles
            }, true); // Use skipAutoLog

            await addOrderLog(order.id, {
                action: 'status_change',
                actorId: user.uid,
                actorName: user.displayName || user.email?.split('@')[0] || 'DS',
                details: 'Submitted designs for review'
            });

            message.success('Submitted');
            onUpdate();
            onCancel();
        } catch (e) {
            console.error(e);
            message.error('Submit failed');
        } finally {
            setDsUploading(false);
        }
    };

    const handleCommentFileUpload = async ({ file, onSuccess }: any) => {
        setCommentUploading(true);
        try {
            // Check if we upload immediately or wait? 
            // Existing logic likely waited or uploaded. Let's just stage them for simplicity or upload now.
            // The UI shows tags for `commentFiles`.
            setCommentFiles(p => [...p, file]);
            onSuccess("ok");
        } catch (e) { message.error('Error'); }
        finally { setCommentUploading(false); }
    };

    const handleSendComment = async () => {
        if (!order || !user || (!comment && commentFiles.length === 0)) return;
        setCommentUploading(true);
        try {
            const attachments: FileAttachment[] = [];
            for (const file of commentFiles) {
                const baseStoragePath = generateStoragePath(order as any);
                const fullStoragePath = `${baseStoragePath}/Comments/${file.name}`;
                const firebasePath = fullStoragePath.startsWith('/') ? fullStoragePath.substring(1) : fullStoragePath;

                const url = await uploadFileToStorage(file, firebasePath);
                attachments.push({ name: file.name, link: url, type: 'file' });
            }

            await addOrderLog(order.id, {
                action: 'comment',
                actorId: user.uid,
                actorName: user.displayName || user.email?.split('@')[0] || 'User',
                details: 'Commented',
                content: comment,
                attachments
            });
            setComment('');
            setCommentFiles([]);
            fetchLogs();
            message.success('Sent');
        } catch (e) { message.error('Failed to send'); }
        finally { setCommentUploading(false); }
    };


    const handleDownload = async (e: React.MouseEvent, url: string, filename: string) => {
        e.preventDefault();
        e.stopPropagation();



        // Handle Firebase/Other via Proxy API to avoid CORS and force download
        const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;

        // Open in new tab which will trigger the 'attachment' download
        window.open(proxyUrl, '_blank');
    };

    return (
        <Modal
            open={open}
            onCancel={onCancel}
            width={1200}
            footer={null}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontWeight: 800, fontSize: 18, color: colors.primary }}>#{order?.readableId}</span>
                    {(isCS || isAdmin) ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', marginRight: 32 }}>
                            <span style={{ fontSize: 14, color: isUrgent ? colors.urgentRed : '#bfbfbf', fontWeight: isUrgent ? 'bold' : 'normal' }}>
                                {isUrgent ? t('taskDetail.header.urgent') : t('taskDetail.header.normal')}
                            </span>
                            <div onClick={() => handleUrgentToggle(!isUrgent)} style={{ cursor: 'pointer' }}>
                                <Tag color={isUrgent ? 'red' : 'default'} style={{ margin: 0 }}>
                                    {isUrgent ? 'ON' : 'OFF'}
                                </Tag>
                            </div>
                        </div>
                    ) : (
                        isUrgent && <Tag color="red" style={{ marginLeft: 16 }}>{t('taskDetail.header.urgent')}</Tag>
                    )}
                </div>
            }
            centered
        >
            <Row gutter={24}>
                <Col span={9}>
                    {/* Mockup Display */}
                    <div style={{ marginBottom: 24, borderRadius: 12, overflow: 'hidden', border: '1px solid #f0f0f0', position: 'relative', minHeight: '400px', background: '#fafafa' }}>
                        {order?.mockupUrl ? (
                            <SmartImage
                                src={order.mockupUrl}
                                width="100%"
                                height={400}
                                style={{ objectFit: 'contain', display: 'block' }}
                                preview={{
                                    src: order.mockupUrl
                                }}
                                fit="inside"
                            />
                        ) : (
                            <div style={{ height: 400, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                                {t('taskDetail.mockup.noMockup')}
                            </div>
                        )}
                        <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            background: 'rgba(0,0,0,0.5)', color: '#fff',
                            padding: '4px 12px', fontSize: 12, fontWeight: 500
                        }}>
                            {t('taskDetail.mockup.title')}
                        </div>
                    </div>

                    {/* Customer Files List */}
                    <div style={{ background: '#fafafa', padding: 16, borderRadius: 12 }}>
                        <div style={{ fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CloudUploadOutlined style={{ color: colors.primary }} />
                            {t('taskDetail.customerFiles.title')}({order?.customerFiles?.length || 0})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                            {order?.customerFiles && order.customerFiles.length > 0 ? (
                                order.customerFiles.map((file, idx) => {
                                    const isImage = /\.(jpeg|jpg|png|gif|webp|svg)$/i.test(file.name);
                                    const fileUrl = file.link;

                                    return (
                                        <div key={idx} style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            background: '#fff', padding: 8, borderRadius: 8,
                                            border: '1px solid #f0f0f0'
                                        }}>
                                            <div style={{ width: 48, height: 48, flexShrink: 0, border: '1px solid #f0f0f0', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
                                                {isImage ? (
                                                    <Image
                                                        src={getOptimizedImageUrl(fileUrl, 100, 100, 'cover')} // Thumbnail optimized
                                                        alt={file.name}
                                                        width={48}
                                                        height={48}
                                                        style={{ objectFit: 'cover' }}
                                                        fallback="https://placehold.co/48x48?text=Err"
                                                        preview={{
                                                            src: fileUrl // Original for preview
                                                        }}
                                                    />
                                                ) : (
                                                    <FileImageOutlined style={{ fontSize: 24, color: '#8c8c8c' }} />
                                                )}
                                            </div>

                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.name}>
                                                    <span style={{ color: '#999', marginRight: 4, fontWeight: 700 }}>#{idx + 1}</span> {file.name}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    icon={<DownloadOutlined />}
                                                    onClick={(e) => handleDownload(e, file.link, file.name)}
                                                    title="Download"
                                                />
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    icon={<EyeOutlined />}
                                                    href={file.link}
                                                    target="_blank"
                                                    title="View"
                                                />
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ color: '#ccc', fontStyle: 'italic', fontSize: 12 }}>{t('taskDetail.customerFiles.noFiles')}</div>
                            )}
                        </div>
                    </div>
                </Col >

                {/* RIGHT COLUMN: DETAILS & ACTION */}
                < Col span={15} >
                    <Tabs
                        defaultActiveKey="1"
                        className="task-tabs"
                        items={[
                            {
                                key: '1',
                                label: <span><FileOutlined /> {t('taskDetail.tabs.details')}</span>,
                                children: (
                                    <div style={{ height: 600, overflowY: 'auto', paddingRight: 8 }} >
                                        <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            {(isAdmin || isDS) && (
                                                <Tag color="purple" style={{ margin: 0 }}>
                                                    {t('taskDetail.info.creator')}: <b>{getUserName(order?.createdBy)}</b>
                                                </Tag>
                                            )}
                                            {(isAdmin || isCS) && (
                                                <Tag color="cyan" style={{ margin: 0 }}>
                                                    {t('taskDetail.info.designer')}: <b>{getUserName(order?.designerId)}</b>
                                                </Tag>
                                            )}
                                        </div>
                                        <Form form={form} layout="vertical" disabled={!isCS}>
                                            {(isCS && order?.status === 'new') && (
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                                                    <Button
                                                        type="primary"
                                                        onClick={handleUpdateInfo}
                                                        icon={<SaveOutlined />}
                                                        style={{
                                                            background: colors.primary,
                                                            borderColor: colors.primary,
                                                            borderRadius: 20,
                                                            fontWeight: 600,
                                                            boxShadow: '0 2px 8px rgba(22, 119, 255, 0.3)'
                                                        }}
                                                    >
                                                        {t('taskDetail.info.update')}
                                                    </Button>
                                                </div>
                                            )}
                                            <Row gutter={16}>
                                                <Col span={24}>
                                                    <Form.Item name="title" label={t('taskDetail.form.title')}>
                                                        <Input style={{ fontWeight: 600 }} />
                                                    </Form.Item>
                                                </Col>
                                            </Row>
                                            <Row gutter={16}>
                                                <Col span={12}>
                                                    <Form.Item name="sku" label={t('taskDetail.form.sku')}>
                                                        <Input />
                                                    </Form.Item>
                                                </Col>
                                                {/* Removed Category, Quantity, Deadline */}
                                            </Row>
                                            <Form.Item name="description" label={t('taskDetail.form.desc')}>
                                                <TextArea rows={5} showCount maxLength={1000} style={{ resize: 'none' }} />
                                            </Form.Item>
                                        </Form>

                                        <Divider />

                                        {/* DS AREA */}
                                        < div style={{
                                            background: (canDSWork || designFiles.length > 0) ? '#f6ffed' : '#f5f5f5',
                                            border: (canDSWork || designFiles.length > 0) ? '1px solid #b7eb8f' : '1px solid #d9d9d9',
                                            borderRadius: 12,
                                            padding: 16
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                <div style={{ fontWeight: 700, color: (canDSWork || designFiles.length > 0) ? '#389e0d' : '#8c8c8c', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <InboxOutlined /> {t('taskDetail.designFiles.title')}
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    {canClaim && (
                                                        <Button
                                                            type="primary"
                                                            onClick={handleClaim}
                                                            style={{ background: colors.primary, borderColor: colors.primary, fontWeight: 600 }}
                                                            icon={<CloudUploadOutlined />}
                                                        >
                                                            {t('taskDetail.actions.claim')}
                                                        </Button>
                                                    )}
                                                    {canReview && (
                                                        <>
                                                            <Button
                                                                danger
                                                                onClick={handleReject}
                                                                icon={<RollbackOutlined />}
                                                            >
                                                                {t('taskDetail.actions.requestFix')}
                                                            </Button>
                                                            <Button
                                                                type="primary"
                                                                onClick={handleApprove}
                                                                style={{ background: colors.successGreen, borderColor: colors.successGreen, fontWeight: 600 }}
                                                                icon={<CheckOutlined />}
                                                            >
                                                                {t('taskDetail.actions.approve')}
                                                            </Button>
                                                        </>
                                                    )}
                                                    {canDSWork && (
                                                        <Button
                                                            type="primary"
                                                            onClick={handleDSSubmit}
                                                            loading={dsUploading}
                                                            style={{ background: colors.primary, borderColor: colors.primary, fontWeight: 600, boxShadow: '0 4px 14px rgba(22, 119, 255, 0.4)' }}
                                                            disabled={order?.status === 'need_fix' ? stagedFiles.length === 0 : (stagedFiles.length === 0 && designFiles.length === 0)}
                                                            icon={<SendOutlined />}
                                                        >
                                                            {t('taskDetail.actions.submit')}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            {canDSWork && (
                                                <Dragger
                                                    customRequest={handleFileSelect}
                                                    showUploadList={false}
                                                    multiple
                                                    style={{ background: '#fff' }}
                                                >
                                                    <p className="ant-upload-drag-icon">
                                                        <CloudUploadOutlined style={{ color: colors.primary }} />
                                                    </p>
                                                    <p className="ant-upload-text" style={{ fontSize: 13 }}>{t('taskDetail.designFiles.dragDrop')}</p>
                                                </Dragger>
                                            )}

                                            {/* Staged Files List */}
                                            {stagedFiles.length > 0 && (
                                                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#fa8c16' }}>File chờ upload ({stagedFiles.length}):</div>
                                                    {stagedFiles.map((file, idx) => {
                                                        const isImage = /\.(jpeg|jpg|png|gif|webp|svg)$/i.test(file.name);
                                                        const fileUrl = URL.createObjectURL(file);

                                                        return (
                                                            <div key={idx} style={{
                                                                display: 'flex', alignItems: 'center', gap: 12,
                                                                background: '#fffbe6', padding: 8, borderRadius: 8,
                                                                border: '1px solid #ffe58f'
                                                            }}>
                                                                <div style={{ width: 48, height: 48, flexShrink: 0, border: '1px solid #ffe58f', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                                                                    {isImage ? (
                                                                        <img
                                                                            src={fileUrl}
                                                                            alt={file.name}
                                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                        />
                                                                    ) : (
                                                                        <FileOutlined style={{ fontSize: 24, color: '#fa8c16' }} />
                                                                    )}
                                                                </div>

                                                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                                                    <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.name}>
                                                                        <span style={{ color: '#999', marginRight: 4, fontWeight: 700 }}>#{idx + 1}</span> {file.name}
                                                                    </div>
                                                                    <div style={{ fontSize: 11, color: '#999' }}>
                                                                        {(file.size / 1024).toFixed(1)} KB
                                                                    </div>
                                                                </div>

                                                                <Button
                                                                    type="text"
                                                                    danger
                                                                    size="small"
                                                                    icon={<DeleteOutlined />}
                                                                    onClick={() => setStagedFiles(p => p.filter((_, i) => i !== idx))}
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                    <Divider style={{ margin: '8px 0' }} />
                                                </div>
                                            )}

                                            {/* File List */}
                                            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {designFiles.length > 0 ? (
                                                    designFiles.map((file, idx) => {
                                                        const isImage = /\.(jpeg|jpg|png|gif|webp|svg)$/i.test(file.name);
                                                        const fileUrl = file.link;

                                                        return (
                                                            <div key={idx} style={{
                                                                display: 'flex', alignItems: 'center', gap: 12,
                                                                background: '#fff', padding: 8, borderRadius: 8,
                                                                border: '1px solid #f0f0f0'
                                                            }}>
                                                                <div style={{ width: 48, height: 48, flexShrink: 0, border: '1px solid #f0f0f0', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
                                                                    {isImage ? (
                                                                        <Image
                                                                            src={getOptimizedImageUrl(fileUrl, 100, 100, 'cover')} // Thumbnail optimized
                                                                            alt={file.name}
                                                                            width={48}
                                                                            height={48}
                                                                            style={{ objectFit: 'cover' }}
                                                                            fallback="https://placehold.co/48x48?text=Err"
                                                                            preview={{
                                                                                src: fileUrl // Original for preview
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <FileOutlined style={{ fontSize: 24, color: '#1677FF' }} />
                                                                    )}
                                                                </div>

                                                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                                                    <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.name}>
                                                                        <span style={{ color: '#999', marginRight: 4, fontWeight: 700 }}>#{idx + 1}</span> {file.name}
                                                                    </div>
                                                                </div>

                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                    <Button
                                                                        type="text"
                                                                        size="small"
                                                                        icon={<DownloadOutlined />}
                                                                        onClick={(e) => handleDownload(e, file.link, file.name)}
                                                                        title="Download"
                                                                    />
                                                                    <Button
                                                                        type="text"
                                                                        size="small"
                                                                        icon={<EyeOutlined />}
                                                                        href={file.link}
                                                                        target="_blank"
                                                                        title="View"
                                                                    />

                                                                    {canDSWork && (
                                                                        <Button
                                                                            type="text"
                                                                            danger
                                                                            size="small"
                                                                            icon={<DeleteOutlined />}
                                                                            onClick={() => setDesignFiles(p => p.filter((_, i) => i !== idx))}
                                                                        />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    !canDSWork && <div style={{ color: '#ccc', textAlign: 'center', fontSize: 12 }}>Chưa có file. </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: '2',
                                label: <span><ClockCircleOutlined /> {t('taskDetail.tabs.activities')} ({logs.length})</span>,
                                children: (
                                    <div style={{ height: 600, display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 12, paddingBottom: 16 }}>
                                            {logs.length > 0 ? (
                                                <Timeline
                                                    mode="left"
                                                    style={{ marginTop: 16 }}
                                                    items={logs.map(log => ({
                                                        key: log.id,
                                                        color: log.action === 'comment' ? colors.primary : 'gray',
                                                        dot: log.action === 'comment' ? <UserOutlined style={{ fontSize: 14 }} /> : <ClockCircleOutlined style={{ fontSize: 14 }} />,
                                                        children: (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <span style={{ fontWeight: 600, fontSize: 13 }}>{log.actorName}</span>
                                                                    <span style={{ fontSize: 11, color: '#999' }}>
                                                                        {log.createdAt?.seconds ? dayjs(log.createdAt.seconds * 1000).format('DD/MM HH:mm') : 'Just now'}
                                                                    </span>
                                                                </div>
                                                                {(log.content || (log.attachments && log.attachments.length > 0)) && (
                                                                    <div style={{
                                                                        color: log.action === 'comment' ? '#333' : '#666',
                                                                        background: log.action === 'comment' ? '#E6F7FF' : 'transparent',
                                                                        padding: log.action === 'comment' ? '8px 12px' : 0,
                                                                        borderRadius: 8,
                                                                        border: log.action === 'comment' ? '1px solid #91D5FF' : 'none',
                                                                        fontSize: 13
                                                                    }}>
                                                                        {log.content && <div>{log.content}</div>}
                                                                        {log.attachments && log.attachments.length > 0 && (
                                                                            <div style={{ marginTop: log.content ? 8 : 0, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                                                {log.attachments.map((att: any, idx: number) => {
                                                                                    const isImg = /\.(jpeg|jpg|png|gif|webp)$/i.test(att.name);
                                                                                    return isImg ? (
                                                                                        <Image key={idx} src={att.link} width={60} height={60} style={{ objectFit: 'cover', borderRadius: 4, border: '1px solid #eee' }} />
                                                                                    ) : (
                                                                                        <a key={idx} href={att.link} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', padding: '2px 8px', borderRadius: 4, border: '1px solid #eee', fontSize: 12 }}>
                                                                                            <PaperClipOutlined /> {att.name}
                                                                                        </a>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    }))}
                                                />
                                            ) : (
                                                <div style={{ color: '#ccc', textAlign: 'center', marginTop: 40 }}>{t('taskDetail.activities.empty')}</div>
                                            )}
                                        </div>
                                        <div style={{ paddingTop: 12, borderTop: '1px solid #eee' }}>
                                            {commentFiles.length > 0 && (
                                                <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                    {commentFiles.map((f, i) => (
                                                        <Tag key={i} closable onClose={() => setCommentFiles(p => p.filter((_, idx) => idx !== i))} color="blue">
                                                            <PaperClipOutlined /> {f.name}
                                                        </Tag>
                                                    ))}
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <Upload showUploadList={false} customRequest={handleCommentFileUpload} disabled={commentUploading}>
                                                    <Button icon={<PaperClipOutlined />} loading={commentUploading} />
                                                </Upload>
                                                <Input
                                                    placeholder={t('taskDetail.activities.placeholder')}
                                                    value={comment}
                                                    onChange={e => setComment(e.target.value)}
                                                    onPressEnter={handleSendComment}
                                                />
                                                <Button type="primary" icon={<SendOutlined />} onClick={handleSendComment} loading={commentUploading} style={{ background: colors.primary, borderColor: colors.primary }}>
                                                    {t('taskDetail.activities.send')}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            }
                        ]}
                    />
                </Col >
            </Row >
            {/* Reject Reason Modal */}
            <Modal
                title="Yêu cầu sửa (Request Fix)"
                open={rejectModalOpen}
                onCancel={() => setRejectModalOpen(false)}
                onOk={submitReject}
                confirmLoading={rejectLoading}
                okText="Gửi yêu cầu"
                cancelText="Hủy"
            >
                <TextArea
                    rows={4}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Nhập lý do yêu cầu sửa"
                />
            </Modal>
        </Modal >
    );
};

export default TaskDetailModal;
