import React from 'react'
import { Modal, Form, Input, message } from 'antd'
import { changePassword } from '../services/auth'
import './Modal.css'

interface ChangePasswordModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ open, onClose, onSuccess }) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = React.useState(false)

  const handleSubmit = async (values: { old_password: string; new_password: string; confirm_password: string }) => {
    if (values.new_password !== values.confirm_password) {
      message.error('两次输入的新密码不一致')
      return
    }

    setLoading(true)
    try {
      await changePassword({
        old_password: values.old_password,
        new_password: values.new_password,
      })
      message.success('密码已成功修改')
      form.resetFields()
      onSuccess()
      onClose()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '修改密码失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="修改密码"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="确认修改"
      cancelText="取消"
      width={480}
      className="stripe-modal"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Form.Item
          label="当前密码"
          name="old_password"
          rules={[
            { required: true, message: '请输入当前密码' },
            { min: 6, message: '密码长度至少为 6 位' },
          ]}
        >
          <Input.Password placeholder="请输入当前密码" />
        </Form.Item>

        <Form.Item
          label="新密码"
          name="new_password"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 6, message: '密码长度至少为 6 位' },
          ]}
        >
          <Input.Password placeholder="请输入新密码" />
        </Form.Item>

        <Form.Item
          label="确认新密码"
          name="confirm_password"
          rules={[
            { required: true, message: '请再次输入新密码' },
            { min: 6, message: '密码长度至少为 6 位' },
          ]}
        >
          <Input.Password placeholder="请再次输入新密码" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default ChangePasswordModal
