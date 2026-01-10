import React from 'react';
import { Layout, Typography, Table, Button } from 'antd';
import { colors } from '../theme/themeConfig';

const { Header, Content } = Layout;
const { Title } = Typography;

const Admin: React.FC = () => {
    return (
        <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
            <Header style={{ background: '#fff', padding: '0 24px' }}>
                <Title level={4} style={{ margin: '14px 0', color: colors.primaryPink }}>Admin Settings</Title>
            </Header>
            <Content style={{ padding: 24 }}>
                <div style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                        <Title level={5}>User Management</Title>
                        <Button type="primary">Add User</Button>
                    </div>
                    <Table columns={[{ title: 'Name', dataIndex: 'name' }, { title: 'Role', dataIndex: 'role' }]} dataSource={[]} />
                </div>
            </Content>
        </Layout>
    );
};

export default Admin;
