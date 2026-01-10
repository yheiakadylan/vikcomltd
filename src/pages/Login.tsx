import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Typography, Layout, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { colors } from '../theme/themeConfig';
import { useAuth } from '../contexts/AuthContext';

const { Title } = Typography;
const { Content } = Layout;

const Login: React.FC = () => {
    const { signIn, user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            navigate('/');
        }
    }, [user, navigate]);

    const onFinish = async (values: any) => {
        setLoading(true);
        try {
            await signIn(values.email, values.password);
            message.success('Đăng nhập thành công!');
            navigate('/');
        } catch (error: any) {
            console.error(error);
            message.error(error.message || 'Đăng nhập thất bại!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', background: colors.softPink, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Content style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ marginBottom: 32, textAlign: 'center' }}>
                    {/* Logo Placeholder */}
                    <Title level={2} style={{ color: colors.primaryPink, margin: 0 }}>Pink POD System</Title>
                </div>
                <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>Đăng nhập</Title>
                    <Form
                        name="login"
                        onFinish={onFinish}
                        layout="vertical"
                        size="large"
                    >
                        <Form.Item
                            name="email"
                            rules={[{ required: true, message: 'Please input your Email!' }]}
                        >
                            <Input placeholder="Email" />
                        </Form.Item>
                        <Form.Item
                            name="password"
                            rules={[{ required: true, message: 'Please input your Password!' }]}
                        >
                            <Input.Password placeholder="Password" />
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" block loading={loading} style={{ background: colors.primaryPink, borderColor: colors.primaryPink }}>
                                Đăng nhập
                            </Button>
                        </Form.Item>
                        <div style={{ textAlign: 'center' }}>
                            <a style={{ color: colors.actionBlue }} href="#">Quên mật khẩu?</a>
                        </div>
                    </Form>
                </Card>
            </Content>
        </Layout>
    );
};

export default Login;
