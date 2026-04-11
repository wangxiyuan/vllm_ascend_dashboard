import { useState } from 'react'
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Cascader,
  message,
  Popconfirm,
  Tag,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useJobOwners, useCreateJobOwner, useUpdateJobOwner, useDeleteJobOwner, useAvailableJobs } from '../hooks/useJobOwners'
import type { JobOwner } from '../services/jobOwners'

const { TextArea } = Input

function JobOwnerManagement() {
  const [form] = Form.useForm()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingOwner, setEditingOwner] = useState<JobOwner | null>(null)
  const [workflowFilter, setWorkflowFilter] = useState<string[]>([])

  const { data: jobOwners, isLoading, refetch } = useJobOwners()
  const { data: availableJobs } = useAvailableJobs()
  const createMutation = useCreateJobOwner()
  const updateMutation = useUpdateJobOwner()
  const deleteMutation = useDeleteJobOwner()

  // 将 available jobs 转换为 Cascader 选项格式
  const jobOptions = availableJobs?.reduce((acc: Array<{ value: string; label: string; children: Array<{ value: string; label: string }> }>, item: { workflow_name: string; job_name: string }) => {
    let workflowOption = acc.find(opt => opt.value === item.workflow_name)
    if (!workflowOption) {
      workflowOption = {
        value: item.workflow_name,
        label: item.workflow_name,
        children: [],
      }
      acc.push(workflowOption)
    }
    workflowOption.children?.push({
      value: item.job_name,
      label: item.job_name,
    })
    return acc
  }, [] as Array<{ value: string; label: string; children: Array<{ value: string; label: string }> }>) || []

  // 打开创建弹窗
  const handleOpenCreate = () => {
    setEditingOwner(null)
    form.resetFields()
    setIsModalOpen(true)
  }

  // 打开编辑弹窗
  const handleOpenEdit = (owner: JobOwner) => {
    setEditingOwner(owner)
    form.setFieldsValue({
      workflow_job: [owner.workflow_name, owner.job_name],
      owner: owner.owner,
      email: owner.email,
      notes: owner.notes,
    })
    setIsModalOpen(true)
  }

  // 删除确认
  const handleDelete = async (ownerId: number) => {
    try {
      await deleteMutation.mutateAsync(ownerId)
      message.success('删除成功')
    } catch (error: any) {
      message.error(error.response?.data?.detail || '删除失败')
    }
  }

  // 提交表单
  const handleSubmit = async (values: any) => {
    try {
      const [workflow_name, job_name] = values.workflow_job
      if (editingOwner) {
        // 更新
        await updateMutation.mutateAsync({
          ownerId: editingOwner.id,
          data: {
            owner: values.owner,
            email: values.email,
            notes: values.notes,
          },
        })
        message.success('更新成功')
      } else {
        // 创建
        await createMutation.mutateAsync({
          workflow_name,
          job_name,
          owner: values.owner,
          email: values.email,
          notes: values.notes,
        })
        message.success('创建成功')
      }
      setIsModalOpen(false)
      form.resetFields()
      refetch()
    } catch (error: any) {
      message.error(error.response?.data?.detail || (editingOwner ? '更新失败' : '创建失败'))
    }
  }

  // 表格列定义
  const columns = [
    {
      title: 'Workflow',
      dataIndex: 'workflow_name',
      key: 'workflow_name',
      filters: Array.from(new Set(jobOwners?.map(jo => jo.workflow_name) || [])).map((wf) => ({
        text: wf,
        value: wf,
      })),
      filteredValue: workflowFilter,
      onFilter: (value: any, record: JobOwner) => record.workflow_name === value,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Job 名称',
      dataIndex: 'job_name',
      key: 'job_name',
      ellipsis: true,
    },
    {
      title: '责任人',
      dataIndex: 'owner',
      key: 'owner',
      render: (text: string) => <Tag color="green">{text}</Tag>,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      render: (text: string | null) => text || '-',
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (text: string | null) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: JobOwner) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除 "${record.workflow_name}" 的 "${record.job_name}" 责任人配置吗？`}
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 操作栏 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
          >
            新增责任人
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={jobOwners || []}
        loading={isLoading}
        rowKey="id"
        pagination={{
          pageSize: 20,
          showSizeChanger: false,
        }}
        scroll={{ x: 800 }}
        onChange={(_, filters) => {
          if (filters.workflow_name) {
            setWorkflowFilter(filters.workflow_name as string[])
          } else {
            setWorkflowFilter([])
          }
        }}
      />

      {/* 编辑/创建弹窗 */}
      <Modal
        title={editingOwner ? '编辑责任人' : '新增责任人'}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false)
          form.resetFields()
        }}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            workflow_job: editingOwner ? [editingOwner.workflow_name, editingOwner.job_name] : undefined,
          }}
        >
          <Form.Item
            name="workflow_job"
            label="Workflow / Job"
            rules={[{ required: true, message: '请选择 Workflow 和 Job' }]}
          >
            <Cascader
              placeholder="请选择 Workflow 和 Job"
              options={jobOptions}
              changeOnSelect
              disabled={!!editingOwner}
              showSearch
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="owner"
            label="责任人"
            rules={[{ required: true, message: '请输入责任人姓名' }]}
          >
            <Input placeholder="请输入责任人姓名" />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="请输入责任人邮箱（可选）" />
          </Form.Item>

          <Form.Item
            name="notes"
            label="备注"
          >
            <TextArea
              rows={3}
              placeholder="请输入备注信息（可选）"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setIsModalOpen(false)
                form.resetFields()
              }}>
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingOwner ? '保存' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default JobOwnerManagement
