import React from 'react';
import { Card, Button, Steps, Typography, Alert, Space, Divider } from 'antd';
import { DownloadOutlined, CheckCircleOutlined, SettingOutlined, RocketOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

/**
 * Extension Download & Setup Page
 * Provides download link and installation instructions for Merchize Extension
 */
const ExtensionDownload: React.FC = () => {

    const handleDownload = () => {
        // Create anchor element for download
        const link = document.createElement('a');
        link.href = '/merchize-extension.zip';
        link.download = 'merchize-extension.zip';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '40px 20px'
        }}>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 40, color: 'white' }}>
                    <Title level={1} style={{ color: 'white', marginBottom: 16 }}>
                        <RocketOutlined /> POD Merchize Fulfillment Extension
                    </Title>
                    <Paragraph style={{ fontSize: 18, color: 'rgba(255,255,255,0.9)' }}>
                        Tự động hóa quy trình fulfill đơn hàng từ POD Workflow sang Merchize
                    </Paragraph>
                </div>

                {/* Download Card */}
                <Card style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <DownloadOutlined style={{ fontSize: 64, color: '#667eea', marginBottom: 24 }} />
                        <Title level={2}>Tải Extension</Title>
                        <Paragraph style={{ fontSize: 16, color: '#666', marginBottom: 32 }}>
                            Click nút bên dưới để tải xuống extension mới nhất
                        </Paragraph>
                        <Button
                            type="primary"
                            size="large"
                            icon={<DownloadOutlined />}
                            onClick={handleDownload}
                            style={{
                                height: 56,
                                fontSize: 18,
                                fontWeight: 600,
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                border: 'none',
                                borderRadius: 8,
                                paddingLeft: 40,
                                paddingRight: 40
                            }}
                        >
                            Tải Extension (.zip)
                        </Button>
                        <div style={{ marginTop: 16, color: '#999', fontSize: 14 }}>
                            Version 1.0.0 • Cập nhật: {new Date().toLocaleDateString('vi-VN')}
                        </div>
                    </div>
                </Card>

                {/* Installation Steps */}
                <Card title={<><SettingOutlined /> Hướng Dẫn Cài Đặt</>} style={{ borderRadius: 12 }}>
                    <Steps
                        direction="vertical"
                        items={[
                            {
                                title: 'Giải nén file .zip',
                                description: (
                                    <div>
                                        <Paragraph>
                                            • Sau khi tải xong, giải nén file <Text code>merchize-extension.zip</Text>
                                        </Paragraph>
                                        <Paragraph>
                                            • Bạn sẽ có folder <Text code>merchize-fulfillment-extension</Text>
                                        </Paragraph>
                                    </div>
                                ),
                                status: 'process',
                                icon: <div style={{ background: '#667eea', color: 'white', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>1</div>
                            },
                            {
                                title: 'Mở Chrome Extensions',
                                description: (
                                    <div>
                                        <Paragraph>
                                            • Mở Chrome và truy cập <Text code>chrome://extensions/</Text>
                                        </Paragraph>
                                        <Paragraph>
                                            • Hoặc: Menu (⋮) → Extensions → Manage Extensions
                                        </Paragraph>
                                    </div>
                                ),
                                status: 'process',
                                icon: <div style={{ background: '#667eea', color: 'white', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>2</div>
                            },
                            {
                                title: 'Bật Developer Mode',
                                description: (
                                    <div>
                                        <Paragraph>
                                            • Bật công tắc <Text strong>"Developer mode"</Text> ở góc trên bên phải
                                        </Paragraph>
                                        <Alert
                                            message="Quan trọng"
                                            description="Bạn cần bật Developer mode mới có thể cài extension từ file local"
                                            type="info"
                                            showIcon
                                            style={{ marginTop: 12 }}
                                        />
                                    </div>
                                ),
                                status: 'process',
                                icon: <div style={{ background: '#667eea', color: 'white', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>3</div>
                            },
                            {
                                title: 'Load Extension',
                                description: (
                                    <div>
                                        <Paragraph>
                                            • Click nút <Text strong>"Load unpacked"</Text>
                                        </Paragraph>
                                        <Paragraph>
                                            • Chọn folder <Text code>merchize-fulfillment-extension</Text> đã giải nén
                                        </Paragraph>
                                        <Paragraph>
                                            • Extension sẽ xuất hiện trong danh sách
                                        </Paragraph>
                                    </div>
                                ),
                                status: 'process',
                                icon: <div style={{ background: '#667eea', color: 'white', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>4</div>
                            },
                            {
                                title: 'Hoàn tất!',
                                description: (
                                    <div>
                                        <Paragraph>
                                            • Extension đã sẵn sàng sử dụng
                                        </Paragraph>
                                        <Paragraph>
                                            • Vào POD Workflow và thử fulfill một đơn hàng
                                        </Paragraph>
                                        <Alert
                                            message="✅ Cài đặt thành công"
                                            description="Bạn sẽ thấy nút 'Fulfill to Merchize' trên các đơn hàng có status = Done"
                                            type="success"
                                            showIcon
                                            style={{ marginTop: 12 }}
                                        />
                                    </div>
                                ),
                                status: 'finish',
                                icon: <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                            }
                        ]}
                    />
                </Card>

                <Divider />

                {/* Usage Guide */}
                <Card title="📖 Cách Sử Dụng" style={{ borderRadius: 12, marginTop: 24 }}>
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        <div>
                            <Title level={4}>1. Approve Design File</Title>
                            <Paragraph>
                                • CS review và approve design → Đơn hàng chuyển sang status <Text code>Done</Text>
                            </Paragraph>
                        </div>

                        <div>
                            <Title level={4}>2. Fulfill to Merchize</Title>
                            <Paragraph>
                                • Click nút <Text strong>"Fulfill to Merchize"</Text> trên đơn hàng
                            </Paragraph>
                            <Paragraph>
                                • Chọn design file cần fulfill
                            </Paragraph>
                            <Paragraph>
                                • Xác nhận Order ID (có thể sửa nếu cần)
                            </Paragraph>
                        </div>

                        <div>
                            <Title level={4}>3. Tự Động Fulfill</Title>
                            <Paragraph>
                                Extension sẽ tự động:
                            </Paragraph>
                            <ul>
                                <li>Mở tab Merchize seller portal</li>
                                <li>Tìm đơn hàng theo External Number</li>
                                <li>Upload artwork file</li>
                                <li>Apply artwork vào đơn hàng</li>
                            </ul>
                        </div>

                        <div>
                            <Title level={4}>4. Hoàn Thành</Title>
                            <Paragraph>
                                • Nhận notification khi fulfill thành công
                            </Paragraph>
                            <Paragraph>
                                • Kiểm tra log trong order để xem lịch sử fulfill
                            </Paragraph>
                        </div>
                    </Space>
                </Card>

                {/* Support */}
                <Card style={{ borderRadius: 12, marginTop: 24, background: '#f5f7fa' }}>
                    <div style={{ textAlign: 'center' }}>
                        <Title level={4}>Cần Hỗ Trợ?</Title>
                        <Paragraph>
                            Nếu gặp vấn đề trong quá trình cài đặt hoặc sử dụng, vui lòng liên hệ team IT
                        </Paragraph>
                        <Button type="default" href="/board/fulfill/new">
                            Quay lại Dashboard
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default ExtensionDownload;
