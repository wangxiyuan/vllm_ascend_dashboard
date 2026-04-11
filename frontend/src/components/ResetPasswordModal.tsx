import React from 'react'
import { Modal, Form, Input, message } from 'antd'
import { resetUserPassword } from '../services/users'
import './Modal.css'

interface ResetPasswordModalProps {
  open: boolean
  userId: number | null
  username: string
  onClose: () => void
  onSuccess: () => void
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  open,
  userId,
  username,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = React.useState(false)

  const handleSubmit = async (values: { new_password: string; confirm_password: string }) => {
    if (values.new_password !== values.confirm_password) {
      message.error('两次输入的新密码不一致')
      return
    }

    if (!userId) return

    setLoading(true)
    try {
      await resetUserPassword(userId, values.new_password)
      message.success(`用户 ${username} 的密码已成功重置`)
      form.resetFields()
      onSuccess()
      onClose()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '重置密码失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={`重置密码 - ${username}`}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="确认重置"
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

export default ResetPasswordModal
