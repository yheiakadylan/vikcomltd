import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { Modal, Form, Input, Button, Upload, message, Tag, Row, Col, Image, Divider, Tooltip, Spin, Tabs, Timeline } from 'antd';
import { InboxOutlined, CloudUploadOutlined, FileOutlined, FileImageOutlined, DeleteOutlined, UserOutlined, ClockCircleOutlined, SendOutlined, PaperClipOutlined } from '@ant-design/icons';
import type { Order, FileAttachment, User } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { updateOrder, getUsers, subscribeToLogs, addOrderLog } from '../../services/firebase';
import { uploadFileToDropbox } from '../../services/dropbox';
import { colors } from '../../theme/themeConfig';

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
    const [users, setUsers] = useState<User[]>([]);
    const [form] = Form.useForm();
    const [isUrgent, setIsUrgent] = useState(false);
    const [designFiles, setDesignFiles] = useState<FileAttachment[]>([]);
    const [uploading, setUploading] = useState(false);

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
            await updateOrder(order.id, { status: 'doing', designerId: appUser.uid, updatedAt: new Date() });
            message.success('Đã nhận task!');
            onUpdate();
            onCancel();
        } catch (e) { message.error('Lỗi nhận task'); }
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
            const folderName = order?.dropboxPath
                ? `${order.dropboxPath}/DesignFiles/${file.name}`
                : `/PINK_POD_SYSTEM/Unsorted/${order?.readableId}/DesignFiles/${file.name}`;

            const result = await uploadFileToDropbox(file, folderName);

            // Access via result.url provided by our service logic (raw=1)
            const linkUrl = (result as any).url || (result as any).preview_url || '#';
            const fileName = (result as any).name || file.name;

            const newFile = { name: fileName, link: linkUrl };

            setDesignFiles(prev => [...prev, newFile]);

            setUploading(false);
            onSuccess("Ok");
            message.success(`Đã upload ${file.name}`);
        } catch (err) {
            setUploading(false);
            onError(err);
            message.error('Lỗi upload. Hãy kiểm tra kết nối Dropbox.');
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
                    <span style={{ color: '#8c8c8c', fontWeight: 400 }}>#{order?.readableId}</span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: colors.primaryPink }}>{order?.title}</span>
                    {(isCS || isAdmin) ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', marginRight: 32 }}>
                            <span style={{ fontSize: 14, color: isUrgent ? colors.urgentRed : '#bfbfbf', fontWeight: isUrgent ? 'bold' : 'normal' }}>
                                {isUrgent ? 'URGENT 🔥' : 'Normal'}
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
                        isUrgent && <Tag color="red" style={{ marginLeft: 16 }}>URGENT 🔥</Tag>
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
                                No Mockup
                            </div>
                        )}
                        <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            background: 'rgba(0,0,0,0.5)', color: '#fff',
                            padding: '4px 12px', fontSize: 12, fontWeight: 500
                        }}>
                            MOCKUP
                        </div>
                    </div>

                    {/* Customer Files List */}
                    <div style={{ background: '#fafafa', padding: 16, borderRadius: 12 }}>
                        <div style={{ fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CloudUploadOutlined style={{ color: colors.primaryPink }} />
                            File khách gửi ({order?.customerFiles?.length || 0})
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
                                                    {file.name}
                                                </div>
                                                <a href={file.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: colors.primaryPink }}>
                                                    Download / View
                                                </a>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ color: '#ccc', fontStyle: 'italic', fontSize: 12 }}>Không có file đính kèm</div>
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
                                label: <span><FileOutlined /> Chi tiết Task</span>,
                                children: (
                                    <>
                                        <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            {(isAdmin || isDS) && (
                                                <Tag color="purple" style={{ margin: 0 }}>
                                                    Creator: <b>{getUserName(order?.createdBy)}</b>
                                                </Tag>
                                            )}
                                            {(isAdmin || isCS) && (
                                                <Tag color="cyan" style={{ margin: 0 }}>
                                                    Designer: <b>{getUserName(order?.designerId)}</b>
                                                </Tag>
                                            )}
                                        </div>
                                        <Form form={form} layout="vertical" disabled={!isCS}>
                                            <Row gutter={16}>
                                                <Col span={24}>
                                                    <Form.Item name="title" label="Title">
                                                        <Input style={{ fontWeight: 600 }} />
                                                    </Form.Item>
                                                </Col>
                                            </Row>
                                            <Row gutter={16}>
                                                <Col span={12}>
                                                    <Form.Item name="sku" label="SKU">
                                                        <Input />
                                                    </Form.Item>
                                                </Col>
                                                {/* Removed Category, Quantity, Deadline */}
                                            </Row>
                                            <Form.Item name="description" label="Description">
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
                                                    <InboxOutlined /> DESIGN FILES
                                                </div>
                                                {canClaim && (
                                                    <Button type="primary" onClick={handleClaim} style={{ background: '#722ed1', borderColor: '#722ed1' }}>
                                                        CLAIM
                                                    </Button>
                                                )}
                                                {canReview && (
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <Button danger onClick={handleReject}>Reject</Button>
                                                        <Button type="primary" onClick={handleApprove} style={{ background: '#52c41a', borderColor: '#52c41a' }}>Done</Button>
                                                    </div>
                                                )}
                                                {canDSWork && (
                                                    <Button
                                                        type="primary"
                                                        onClick={handleDSSubmit}
                                                        style={{ background: colors.primaryPink, borderColor: colors.primaryPink, fontWeight: 600 }}
                                                        disabled={designFiles.length === 0}
                                                        icon={<CloudUploadOutlined />}
                                                    >
                                                        Nộp bài
                                                    </Button>
                                                )}
                                            </div>

                                            {canDSWork && (
                                                <Dragger
                                                    customRequest={customUploadRequest}
                                                    showUploadList={false}
                                                    multiple
                                                    style={{ background: '#fff' }}
                                                >
                                                    <p className="ant-upload-drag-icon">
                                                        <CloudUploadOutlined style={{ color: colors.primaryPink }} />
                                                    </p>
                                                    <p className="ant-upload-text" style={{ fontSize: 13 }}>Kéo thả hoặc click để upload file Final</p>
                                                </Dragger>
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
                                                                        {file.name}
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
                                                    !canDSWork && <div style={{ color: '#ccc', textAlign: 'center', fontSize: 12 }}>Chưa có bài nộp</div>
                                                )}
                                            </div>
                                            {uploading && <div style={{ color: colors.primaryPink, fontSize: 12, marginTop: 8, textAlign: 'center' }}><Spin size="small" /> Đang upload...</div>}
                                        </div>
                                    </>
                                )
                            },
                            {
                                key: '2',
                                label: <span><ClockCircleOutlined /> Hoạt động ({logs.length})</span>,
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
                                                <div style={{ color: '#ccc', textAlign: 'center', marginTop: 40 }}>Chưa có hoạt động nào</div>
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
                                                    placeholder="Nhập trao đổi..."
                                                    value={comment}
                                                    onChange={e => setComment(e.target.value)}
                                                    onPressEnter={handleSendComment}
                                                />
                                                <Button type="primary" icon={<SendOutlined />} onClick={handleSendComment} loading={commentUploading} style={{ background: colors.primaryPink, borderColor: colors.primaryPink }}>
                                                    Gửi
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
        </Modal>
    );
};

export default TaskDetailModal;
