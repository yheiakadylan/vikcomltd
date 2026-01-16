import React, { useState } from 'react';
import { Card, Progress, Button, List, Typography, Badge } from 'antd';
import { CloudUploadOutlined, MinusOutlined, CloseOutlined, ReloadOutlined, DeleteOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useUpload } from '../../contexts/UploadContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { translations } from '../../utils/translations';
import { colors } from '../../theme/themeConfig';

const { Text } = Typography;

const UploadWidget: React.FC = () => {
    const { queue, retry, cancel, clearCompleted } = useUpload();
    const { language } = useLanguage();
    const t = translations[language].widget;
    const [isExpanded, setIsExpanded] = useState(true);

    if (queue.length === 0) return null;

    const pendingCount = queue.filter(i => i.status === 'pending' || i.status === 'uploading' || i.status === 'compressing').length;
    const errorCount = queue.filter(i => i.status === 'error').length;

    // Styles
    const widgetStyle: React.CSSProperties = {
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: isExpanded ? 420 : 'auto', // Increased width
        zIndex: 1000,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)', // Softer shadow
        borderRadius: 12, // Rounded corners
        overflow: 'hidden',
        background: '#fff',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        border: '1px solid rgba(0,0,0,0.06)'
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
                        style={{
                            background: pendingCount > 0 ? colors.primary : '#52c41a',
                            borderColor: 'transparent',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            height: 48,
                            paddingLeft: 24,
                            paddingRight: 24
                        }}
                    >
                        {pendingCount > 0 ? `${t.minimized.uploading} (${pendingCount})` : t.minimized.completed}
                    </Button>
                </Badge>
            </div>
        );
    }

    return (
        <Card
            style={widgetStyle}
            bodyStyle={{ padding: 0 }}
            headStyle={{ borderBottom: '1px solid #f0f0f0', padding: '0 16px', height: 56 }}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 16, fontWeight: 600 }}>
                    {pendingCount > 0 ?
                        <div style={{ background: '#E6F7FF', padding: 8, borderRadius: '50%', display: 'flex' }}>
                            <LoadingOutlined spin style={{ color: colors.primary }} />
                        </div> :
                        <div style={{ background: '#f6ffed', padding: 8, borderRadius: '50%', display: 'flex' }}>
                            <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        </div>
                    }
                    <span>{pendingCount > 0 ? `${t.uploading} ${pendingCount} ${t.files}...` : t.completed}</span>
                </div>
            }
            extra={
                <div style={{ display: 'flex', gap: 4 }}>
                    <Button type="text" shape="circle" icon={<MinusOutlined />} onClick={() => setIsExpanded(false)} />
                    <Button type="text" shape="circle" icon={<CloseOutlined />} onClick={clearCompleted} disabled={pendingCount > 0} />
                </div>
            }
        >
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                <List
                    size="small"
                    dataSource={[...queue].reverse()}
                    renderItem={item => (
                        <List.Item
                            actions={[
                                item.status === 'error' && <Button key="retry" size="small" type="link" icon={<ReloadOutlined />} onClick={() => retry(item.id)} />,
                                (item.status === 'pending' || item.status === 'error') && <Button key="cancel" size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => cancel(item.id)} />
                            ]}
                            style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid #f9f9f9',
                                transition: 'background 0.2s',
                                cursor: 'default'
                            }}
                        >
                            <List.Item.Meta
                                avatar={
                                    <div style={{ marginTop: 4 }}>
                                        {item.status === 'success' ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} /> :
                                            item.status === 'error' ? <CloseOutlined style={{ color: '#ff4d4f', fontSize: 24 }} /> :
                                                <CloudUploadOutlined style={{ color: colors.primary, fontSize: 24 }} />
                                        }
                                    </div>
                                }
                                title={
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <Text ellipsis={{ tooltip: item.file.name }} style={{ maxWidth: 220, fontSize: 14, fontWeight: 500 }}>
                                            {item.file.name}
                                        </Text>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            {item.status === 'success' ? '100%' : item.status === 'error' ? 'Failed' : `${Math.round(item.progress)}%`}
                                        </Text>
                                    </div>
                                }
                                description={
                                    item.status === 'error' ?
                                        <Text type="danger" style={{ fontSize: 12 }}>{item.error}</Text> :
                                        <Progress
                                            percent={item.progress}
                                            size="small"
                                            status={item.status === 'success' ? 'success' : 'active'}
                                            showInfo={false}
                                            strokeColor={colors.primary}
                                            trailColor="#f5f5f5"
                                        />
                                }
                            />
                        </List.Item>
                    )}
                />
            </div>
            {/* Footer */}
            {queue.length > 0 && pendingCount === 0 && (
                <div style={{ padding: '12px 16px', background: '#fafafa', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end' }}>
                    <Button onClick={clearCompleted} style={{ borderRadius: 6 }}>{t.clear}</Button>
                </div>
            )}
        </Card>
    );
};

export default UploadWidget;
