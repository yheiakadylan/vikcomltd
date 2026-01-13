import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { Modal, Form, Input, Button, Upload, message, Tag, Row, Col, Image, Divider, Tabs, Timeline } from 'antd';
import { InboxOutlined, CloudUploadOutlined, FileOutlined, FileImageOutlined, DeleteOutlined, UserOutlined, ClockCircleOutlined, SendOutlined, PaperClipOutlined, SaveOutlined, RollbackOutlined, CheckOutlined } from '@ant-design/icons';
import type { Order, FileAttachment, User } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { updateOrder, getUsers, subscribeToLogs, addOrderLog, claimOrder } from '../../services/firebase';
import { uploadFileToDropbox } from '../../services/dropbox';
import { colors } from '../../theme/themeConfig';
import { useUpload } from '../../contexts/UploadContext';
import { useLanguage } from '../../contexts/LanguageContext';

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
    const { t } = useLanguage();
    const [users, setUsers] = useState<User[]>([]);
    const [form] = Form.useForm();
    const [isUrgent, setIsUrgent] = useState(false);
    const [designFiles, setDesignFiles] = useState<FileAttachment[]>([]);

    const [logs, setLogs] = useState<any[]>([]);
    const [comment, setComment] = useState('');

    useEffect(() => {
        if (open) {
            getUsers().then(setUsers).catch(console.error);
        }
    }, [open]);

    useEffect(() => {
        if (order?.id) {
            const unsub = subscribeToLogs(order.id, (data) => setLogs(data));
            return () => unsub();
        } else {
            setLogs([]);
        }
    }, [order?.id]);

    const getUserName = (uid?: string | null) => {
        if (!uid) return 'Unassigned';
        const u = users.find(user => user.uid === uid);
        return u ? u.displayName : 'Unknown';
    };

    const formatDropboxUrl = (url?: string) => {
        if (!url) return '';
        // Fix double question marks if present (repair existing bad data)
        if (url.includes('?') && url.lastIndexOf('?') > url.indexOf('?')) {
            return url.replace(/\?raw=1$/, '&raw=1');
        }
        if (url.includes('raw=1')) return url;
        if (url.includes('dropbox.com')) {
            const clean = url.replace('?dl=0', '').replace('&dl=0', '');
            return clean + (clean.includes('?') ? '&' : '?') + 'raw=1';
        }
        return url;
    };

    // Check Role
    const isCS = appUser?.role === 'CS' || appUser?.role === 'ADMIN';
    const isDS = appUser?.role === 'DS';
    const isAdmin = appUser?.role === 'ADMIN';

    // Roles & Permissions
    const canDSWork = isAdmin || (isDS && (order?.status === 'doing' || order?.status === 'need_fix') && order?.designerId === appUser?.uid);
    const canClaim = (isDS || isAdmin) && order?.status === 'new';
    const canReview = (isCS || isAdmin) && order?.status === 'in_review';

    // Handlers
    const handleClaim = async () => {
        if (!order || !appUser) return;
        try {
            await claimOrder(order.id, appUser.uid);
            message.success('Đã nhận task thành công!');
            onUpdate();
            onCancel();
        } catch (e: any) {
            console.error(e);
            message.error(e.message || 'Lỗi nhận task. Có thể người khác đã nhận rồi.');
        }
    };

    const handleApprove = async () => {
        if (!order) return;
        try {
            await updateOrder(order.id, { status: 'done', updatedAt: new Date() });
            message.success('Đã duyệt task!');
            onUpdate();
            onCancel(); // Close modal on done
        } catch (e) { message.error('Lỗi duyệt task'); }
    };

    const handleReject = async () => {
        if (!order) return;
        try {
            await updateOrder(order.id, { status: 'need_fix', updatedAt: new Date() });
            message.warning('Đã từ chối task (Need Fix)');
            onUpdate();
        } catch (e) { message.error('Lỗi từ chối task'); }
    };

    useEffect(() => {
        if (order) {
            form.setFieldsValue({
                title: order.title,
                sku: order.sku,
                description: order.description,
            });
            setIsUrgent(order.isUrgent);
            setDesignFiles(order.designFiles || []);
        }
    }, [order, form]);

    const handleUrgentToggle = async (checked: boolean) => {
        if ((!isCS && !isAdmin) || !order) return;
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

    const [stagedFiles, setStagedFiles] = useState<File[]>([]);
    const { enqueue, registerCompletionAction } = useUpload();

    const handleFileSelect = ({ file, onSuccess }: any) => {
        // This is a workaround because beforeUpload returning false in Dragger sometimes doesn't play nice with custom UI
        // But actually, we can just use customRequest to capture the file
        setStagedFiles(prev => [...prev, file]);
        setTimeout(() => onSuccess("ok"), 0);
    };

    const handleDSSubmit = async () => {
        if (!order) return;

        // 1. Enqueue Staged Files
        if (stagedFiles.length > 0) {
            enqueue(stagedFiles, order.id, 'designFiles', order.dropboxPath ? `${order.dropboxPath}/DesignFiles` : `/PINK_POD_SYSTEM/Unsorted/${order.readableId}/DesignFiles`, String(order.readableId));

            // Register Auto Submit
            registerCompletionAction(order.id, 'auto_submit');

            message.success('Đã nộp bài! Hệ thống đang upload...');
            onCancel();
            return;
        }

        // 2. If no new files, but maybe just changing status (e.g. if files were uploaded previously or manually)
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

    const handleUpdateInfo = async () => {
        if (!order) return;
        try {
            const values = await form.validateFields();
            await updateOrder(order.id, {
                ...values,
                updatedAt: new Date(),
            });
            message.success('Cập nhật thông tin thành công!');
            onUpdate();
        } catch (error) {
            message.error('Lỗi cập nhật thông tin');
        }
    };





    const [commentFiles, setCommentFiles] = useState<File[]>([]); // Store raw files
    const [commentUploading, setCommentUploading] = useState(false);

    const handleCommentFileUpload = (options: any) => {
        const { file, onSuccess } = options;
        // Just add to state, do not upload yet
        setCommentFiles(prev => [...prev, file]);
        setTimeout(() => onSuccess("Ok"), 0);
    };

    const handleSendComment = async () => {
        if ((!comment.trim() && commentFiles.length === 0) || !order || !appUser) return;
        setCommentUploading(true);
        try {
            const uploadedAttachments: FileAttachment[] = [];

            // Upload files now
            if (commentFiles.length > 0) {
                for (const file of commentFiles) {
                    try {
                        // "lưu trong task đó với folder riêng là log" -> /Logs/
                        const folderName = order.dropboxPath
                            ? `${order.dropboxPath}/Logs/${dayjs().format('YYYYMMDD_HHmmss')}_${file.name}`
                            : `/PINK_POD_SYSTEM/Unsorted/${order.readableId}/Logs/${file.name}`;

                        const result = await uploadFileToDropbox(file, folderName);
                        // @ts-ignore
                        const linkUrl = result.url || result.preview_url || '#';
                        // @ts-ignore
                        const fileName = result.name || file.name;

                        uploadedAttachments.push({ name: fileName, link: linkUrl });
                    } catch (err: any) {
                        console.error("Failed to upload: ", file.name, err);
                        message.warning(`Không upload được file ${file.name}: ${err.message}`);
                    }
                }
            }

            await addOrderLog(order.id, {
                action: 'comment',
                content: comment,
                attachments: uploadedAttachments,
                actorId: appUser.uid,
                actorName: appUser.displayName || 'Unknown'
            });

            setComment('');
            setCommentFiles([]);
        } catch (e) {
            console.error(e);
            message.error('Lỗi gửi bình luận');
        } finally {
            setCommentUploading(false);
        }
    };

    return (
        <Modal
            open={open}
            onCancel={onCancel}
            width={1000}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontWeight: 800, fontSize: 18, color: colors.primaryPink }}>#{order?.readableId}</span>
                    {(isCS || isAdmin) ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', marginRight: 32 }}>
                            <span style={{ fontSize: 14, color: isUrgent ? colors.urgentRed : '#bfbfbf', fontWeight: isUrgent ? 'bold' : 'normal' }}>
                                {isUrgent ? t('taskDetail.header.urgent') : t('taskDetail.header.normal')}
                            </span>
                            <Form.Item name="isUrgent" valuePropName="checked" noStyle>
                                <div onClick={() => handleUrgentToggle(!isUrgent)} style={{ cursor: 'pointer' }}>
                                    <Tag color={isUrgent ? 'red' : 'default'} style={{ margin: 0 }}>
                                        {isUrgent ? 'ON' : 'OFF'}
                                    </Tag>
                                </div>
                            </Form.Item>
                        </div>
                    ) : (
                        isUrgent && <Tag color="red" style={{ marginLeft: 16 }}>{t('taskDetail.header.urgent')}</Tag>
                    )}
                </div>
            }
            footer={null}
            className={`pinky-modal ${isUrgent ? 'urgent-modal-border' : ''}`}
            style={{ top: 20 }}
        >
            <Row gutter={24}>
                {/* LEFT COLUMN: MOCKUP & FILES */}
                <Col span={9}>
                    {/* Mockup Display */}
                    <div style={{ marginBottom: 24, borderRadius: 12, overflow: 'hidden', border: '1px solid #f0f0f0', position: 'relative' }}>
                        {order?.mockupUrl ? (
                            <Image
                                src={formatDropboxUrl(order.mockupUrl)}
                                alt="Mockup"
                                style={{ width: '100%', objectFit: 'contain', display: 'block' }}
                            />
                        ) : (
                            <div style={{ height: 200, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
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
                            <CloudUploadOutlined style={{ color: colors.primaryPink }} />
                            {t('taskDetail.customerFiles.title')}({order?.customerFiles?.length || 0})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                            {order?.customerFiles && order.customerFiles.length > 0 ? (
                                order.customerFiles.map((file, idx) => {
                                    const isImage = /\.(jpeg|jpg|png|gif|webp|svg)$/i.test(file.name);
                                    const fileUrl = formatDropboxUrl(file.link);

                                    return (
                                        <div key={idx} style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            background: '#fff', padding: 8, borderRadius: 8,
                                            border: '1px solid #f0f0f0'
                                        }}>
                                            <div style={{ width: 48, height: 48, flexShrink: 0, border: '1px solid #f0f0f0', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
                                                {isImage ? (
                                                    <Image
                                                        src={fileUrl}
                                                        alt={file.name}
                                                        width={48}
                                                        height={48}
                                                        style={{ objectFit: 'cover' }}
                                                        fallback="https://placehold.co/48x48?text=Err"
                                                    />
                                                ) : (
                                                    <FileImageOutlined style={{ fontSize: 24, color: '#8c8c8c' }} />
                                                )}
                                            </div>

                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.name}>
                                                    <span style={{ color: '#999', marginRight: 4, fontWeight: 700 }}>#{idx + 1}</span> {file.name}
                                                </div>
                                                <a href={file.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: colors.primaryPink }}>
                                                    {t('taskDetail.customerFiles.downloadView')}
                                                </a>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ color: '#ccc', fontStyle: 'italic', fontSize: 12 }}>{t('taskDetail.customerFiles.noFiles')}</div>
                            )}
                        </div>
                    </div>
                </Col>

                {/* RIGHT COLUMN: DETAILS & ACTION */}
                <Col span={15}>
                    <Tabs
                        defaultActiveKey="1"
                        className="task-tabs"
                        items={[
                            {
                                key: '1',
                                label: <span><FileOutlined /> {t('taskDetail.tabs.details')}</span>,
                                children: (
                                    <>
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
                                                            background: colors.primaryPink,
                                                            borderColor: colors.primaryPink,
                                                            borderRadius: 20,
                                                            fontWeight: 600,
                                                            boxShadow: '0 2px 8px rgba(235, 47, 150, 0.3)'
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
                                        <div style={{
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
                                                            style={{ background: colors.primaryPink, borderColor: colors.primaryPink, fontWeight: 600 }}
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
                                                            style={{ background: colors.primaryPink, borderColor: colors.primaryPink, fontWeight: 600, boxShadow: '0 4px 14px rgba(235, 47, 150, 0.4)' }}
                                                            disabled={stagedFiles.length === 0 && designFiles.length === 0}
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
                                                        <CloudUploadOutlined style={{ color: colors.primaryPink }} />
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
                                                        const fileUrl = formatDropboxUrl(file.link);

                                                        return (
                                                            <div key={idx} style={{
                                                                display: 'flex', alignItems: 'center', gap: 12,
                                                                background: '#fff', padding: 8, borderRadius: 8,
                                                                border: '1px solid #f0f0f0'
                                                            }}>
                                                                <div style={{ width: 48, height: 48, flexShrink: 0, border: '1px solid #f0f0f0', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
                                                                    {isImage ? (
                                                                        <Image
                                                                            src={fileUrl}
                                                                            alt={file.name}
                                                                            width={48}
                                                                            height={48}
                                                                            style={{ objectFit: 'cover' }}
                                                                            fallback="https://placehold.co/48x48?text=Err"
                                                                        />
                                                                    ) : (
                                                                        <FileOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                                                                    )}
                                                                </div>

                                                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                                                    <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.name}>
                                                                        <span style={{ color: '#999', marginRight: 4, fontWeight: 700 }}>#{idx + 1}</span> {file.name}

                                                                    </div>
                                                                    <a href={file.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: colors.primaryPink }}>
                                                                        Download / View
                                                                    </a>
                                                                </div>

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
                                                        );
                                                    })
                                                ) : (
                                                    !canDSWork && <div style={{ color: '#ccc', textAlign: 'center', fontSize: 12 }}>Chưa có file. </div>
                                                )}
                                            </div>

                                        </div>
                                    </>
                                )
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
                                                        color: log.action === 'comment' ? colors.primaryPink : 'gray',
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
                                                                        background: log.action === 'comment' ? '#fff0f6' : 'transparent',
                                                                        padding: log.action === 'comment' ? '8px 12px' : 0,
                                                                        borderRadius: 8,
                                                                        border: log.action === 'comment' ? '1px solid #ffadd2' : 'none',
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
                                                <Button type="primary" icon={<SendOutlined />} onClick={handleSendComment} loading={commentUploading} style={{ background: colors.primaryPink, borderColor: colors.primaryPink }}>
                                                    {t('taskDetail.activities.send')}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            }
                        ]}
                    />
                </Col>
            </Row>
        </Modal >
    );
};

export default TaskDetailModal;
