import React, { useState } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, Upload, Select, Button, Switch, Row, Col, message } from 'antd';
import { UploadOutlined, FireOutlined } from '@ant-design/icons';
import { colors } from '../../theme/themeConfig';
import type { Order } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { doc, setDoc, collection } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { uploadFileToDropbox } from '../../services/dropbox';

const { TextArea } = Input;
const { Dragger } = Upload;
const { Option } = Select;

interface NewTaskModalProps {
    open: boolean;
    onCancel: () => void;
    onSuccess: () => void;
}

const NewTaskModal: React.FC<NewTaskModalProps> = ({ open, onCancel, onSuccess }) => {
    const [form] = Form.useForm();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [isUrgent, setIsUrgent] = useState(false);
    const [fileList, setFileList] = useState<any[]>([]);

    const onFinish = async (values: any) => {
        if (!user) return;
        setLoading(true);
        try {
            const newOrderRef = doc(collection(db, "orders"));
            const orderData: Partial<Order> = {
                id: newOrderRef.id,
                readableId: Date.now(), // Temporary: Needs better auto-inc strategy
                title: values.title,
                sku: values.sku,
                category: values.category || 'T-shirt',
                quantity: values.quantity || 1,
                deadline: values.deadline ? values.deadline.toDate() : new Date(),
                description: values.description,
                status: 'new', // Directly to New for now, or 'draft'
                isUrgent: isUrgent,
                createdBy: user.uid,
                dropboxPath: `/PINK/${new Date().getFullYear()}/${newOrderRef.id}`, // Placeholder
                sampleFiles: [], // Logic to handle file upload needed
                created_at: new Date(),
            };

            // Upload files to Dropbox
            if (fileList.length > 0) {
                try {
                    const uploadPromises = fileList.map(async (file) => {
                        // We need read file content to upload. Antd Upload file originFileObj is the File object
                        if (file.originFileObj) {
                            return uploadFileToDropbox(file.originFileObj, orderData.dropboxPath!);
                        }
                        return null;
                    });

                    await Promise.all(uploadPromises);

                    // Update sampleFiles metadata with simple names for now, 
                    // or we could store shared links if we fetched them.
                    orderData.sampleFiles = fileList.map(f => f.name);
                } catch (e) {
                    console.error("Upload error", e);
                    message.warning("Task created but some files failed to upload to Dropbox. Check console.");
                }
            }

            await setDoc(newOrderRef, orderData);

            message.success('Tạo task thành công!');
            form.resetFields();
            setFileList([]);
            setIsUrgent(false);
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
            title={<span style={{ color: colors.primaryPink, fontSize: 18, fontWeight: 600 }}>Create New Task</span>}
            open={open}
            onCancel={onCancel}
            footer={null}
            width={700}
            style={{ top: 20 }}
            maskClosable={false}
        >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <span style={{ marginRight: 8, fontWeight: 500, color: isUrgent ? colors.urgentRed : 'inherit' }}>Urgent?</span>
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
                initialValues={{ quantity: 1, category: 'T-shirt' }}
            >
                <Form.Item name="title" label="Title" rules={[{ required: true }]}>
                    <Input placeholder="Task title..." />
                </Form.Item>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="sku" label="SKU">
                            <Input placeholder="Product SKU" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="category" label="Category">
                            <Select>
                                <Option value="T-shirt">T-shirt</Option>
                                <Option value="Hoodie">Hoodie</Option>
                                <Option value="Mug">Mug</Option>
                                <Option value="Canvas">Canvas</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="quantity" label="Quantity">
                            <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="deadline" label="Deadline">
                            <DatePicker style={{ width: '100%' }} showTime format="YYYY-MM-DD HH:mm" />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item name="description" label="Description">
                    <TextArea rows={4} placeholder="Detailed instructions..." />
                </Form.Item>

                <Form.Item label="Sample Images">
                    <Dragger
                        multiple
                        fileList={fileList}
                        beforeUpload={(file) => {
                            setFileList([...fileList, file]);
                            return false; // Prevent auto upload
                        }}
                        onRemove={(file) => {
                            setFileList(fileList.filter(f => f.uid !== file.uid));
                        }}
                    >
                        <p className="ant-upload-drag-icon">
                            <UploadOutlined style={{ color: colors.primaryPink }} />
                        </p>
                        <p className="ant-upload-text">Kéo thả ảnh mẫu vào đây</p>
                    </Dragger>
                </Form.Item>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                    <Button onClick={onCancel}>Cancel</Button>
                    <Button>Draft</Button>
                    <Button type="primary" htmlType="submit" loading={loading} style={{ background: colors.primaryPink, borderColor: colors.primaryPink }}>
                        Save Task
                    </Button>
                </div>
            </Form>
        </Modal>
    );
};

export default NewTaskModal;
