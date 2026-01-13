import React, { useState } from 'react';
import { Card, Progress, Button, List, Typography, Badge } from 'antd';
import { CloudUploadOutlined, MinusOutlined, CloseOutlined, ReloadOutlined, DeleteOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useUpload } from '../../contexts/UploadContext';
import { colors } from '../../theme/themeConfig';

const { Text } = Typography;

const UploadWidget: React.FC = () => {
    const { queue, retry, cancel, clearCompleted } = useUpload();
    const [isExpanded, setIsExpanded] = useState(true);

    if (queue.length === 0) return null;

    const pendingCount = queue.filter(i => i.status === 'pending' || i.status === 'uploading' || i.status === 'retrying').length;
    const errorCount = queue.filter(i => i.status === 'error').length;

    // Auto-minimize if all done? Maybe.

    // Styles
    const widgetStyle: React.CSSProperties = {
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: isExpanded ? 320 : 'auto',
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
        transition: 'all 0.3s ease'
    };

    if (!isExpanded) {
        return (
            <div style={widgetStyle} onClick={() => setIsExpanded(true)}>
                <Badge count={errorCount} offset={[-5, 5]}>
                    <Button
                        type="primary"
                        shape="round"
                        size="large"
                        icon={pendingCount > 0 ? <LoadingOutlined /> : <CheckCircleOutlined />}
                        style={{ background: colors.primaryPink, borderColor: colors.primaryPink }}
                    >
                        {pendingCount > 0 ? `Uploading (${pendingCount})` : 'Upload Complete'}
                    </Button>
                </Badge>
            </div>
        );
    }

    return (
        <Card
            style={widgetStyle}
            bodyStyle={{ padding: 0 }}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                    {pendingCount > 0 ? <LoadingOutlined spin /> : <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    <span>{pendingCount > 0 ? `Uploading ${pendingCount} files...` : 'Uploads Completed'}</span>
                </div>
            }
            extra={
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button type="text" size="small" icon={<MinusOutlined />} onClick={() => setIsExpanded(false)} />
                    <Button type="text" size="small" icon={<CloseOutlined />} onClick={clearCompleted} disabled={pendingCount > 0} />
                </div>
            }
        >
            <div style={{ maxHeight: 300, overflowY: 'auto', background: '#fafafa' }}>
                <List
                    size="small"
                    dataSource={[...queue].reverse()} // Show newest first
                    renderItem={item => (
                        <List.Item
                            actions={[
                                item.status === 'error' && <Button key="retry" size="small" type="link" icon={<ReloadOutlined />} onClick={() => retry(item.id)} />,
                                (item.status === 'pending' || item.status === 'error') && <Button key="cancel" size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => cancel(item.id)} />
                            ]}
                            style={{ padding: '8px 12px', background: '#fff', borderBottom: '1px solid #f0f0f0' }}
                        >
                            <List.Item.Meta
                                avatar={
                                    item.status === 'success' ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} /> :
                                        item.status === 'error' ? <CloseOutlined style={{ color: '#ff4d4f', fontSize: 20 }} /> :
                                            <CloudUploadOutlined style={{ color: colors.primaryPink, fontSize: 20 }} />
                                }
                                title={
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text ellipsis style={{ maxWidth: 160, fontSize: 12 }}>{item.file.name}</Text>
                                        <Text type="secondary" style={{ fontSize: 10 }}>{item.status}</Text>
                                    </div>
                                }
                                description={
                                    item.status === 'error' ?
                                        <Text type="danger" style={{ fontSize: 10 }}>{item.error}</Text> :
                                        <Progress percent={item.progress} size="small" status={item.status === 'success' ? 'success' : 'active'} showInfo={false} strokeColor={colors.primaryPink} />
                                }
                            />
                        </List.Item>
                    )}
                />
            </div>
            {/* Footer summary or clear button */}
            {queue.length > 0 && pendingCount === 0 && (
                <div style={{ padding: 8, textAlign: 'center' }}>
                    <Button size="small" onClick={clearCompleted}>Clear All</Button>
                </div>
            )}
        </Card>
    );
};

export default UploadWidget;
