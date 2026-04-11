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
  Tag,
  Switch,
  Select,
  Typography,
  Tooltip,
} from 'antd'
import {
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons'
import { useJobOwners, useCreateJobOwner, useUpdateJobOwner, useAvailableJobs, useToggleJobHidden, useJobVisibilityList, useToggleJobVisibility } from '../hooks/useJobOwners'

const { TextArea } = Input
const { Text } = Typography

interface JobConfigItem {
  workflow_name: string
  job_name: string
  display_name?: string | null
  owner?: string
  email?: string | null
  notes?: string | null
  is_hidden?: boolean
  owner_id?: number
  has_owner?: boolean
}

function JobConfig() {
  const [form] = Form.useForm()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [workflowFilter, setWorkflowFilter] = useState<string[]>([])
  const [showHidden, setShowHidden] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)

  const { data: jobOwners, isLoading, refetch } = useJobOwners()
  const { data: availableJobs } = useAvailableJobs()
  const { data: jobVisibilityList } = useJobVisibilityList()
  const createMutation = useCreateJobOwner()
  const updateMutation = useUpdateJobOwner()
  const toggleHiddenMutation = useToggleJobHidden()
  const toggleVisibilityMutation = useToggleJobVisibility()

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

  // 构建去重后的责任人选项（按 owner 去重）
  const ownerOptions = Array.from(
    new Map(
      jobOwners?.map(o => [
        o.owner,
        {
          value: o.owner,
          label: `${o.owner}${o.email ? ` (${o.email})` : ''}`,
        },
      ]) || []
    ).values()
  )

  // 构建 job visibility 映射
  const visibilityMap = new Map(
    jobVisibilityList?.map((v) => [`${v.workflow_name}-${v.job_name}`, v.is_hidden]) || []
  )

  // 构建完整的 job 配置列表（包含已配置和未配置的）
  const jobConfigList: JobConfigItem[] = availableJobs?.map((job) => {
    const owner = jobOwners?.find(
      (jo) => jo.workflow_name === job.workflow_name && jo.job_name === job.job_name
    )
    // 优先使用 job_owner 的 is_hidden，如果没有配置责任人则使用 job_visibility 的 is_hidden
    const isHidden = owner?.is_hidden ?? visibilityMap.get(`${job.workflow_name}-${job.job_name}`) ?? false

    return {
      workflow_name: job.workflow_name,
      job_name: job.job_name,
      display_name: owner?.display_name,
      owner: owner?.owner,
      email: owner?.email,
      notes: owner?.notes,
      is_hidden: isHidden,
      owner_id: owner?.id,
      has_owner: !!owner,
    }
  }) || []

  // 过滤数据（默认显示未隐藏的，点击"显示已隐藏"后只显示已隐藏的）
  const filteredData = jobConfigList.filter((item) => {
    if (workflowFilter.length > 0 && !workflowFilter.includes(item.workflow_name)) {
      return false
    }
    // 根据 showHidden 状态过滤
    if (showHidden) {
      // 显示已隐藏模式：只显示已隐藏的 job
      return item.is_hidden === true
    } else {
      // 默认模式：只显示未隐藏的 job
      return item.is_hidden !== true
    }
  })

  // 打开配置/编辑弹窗（自动判断是新建还是编辑）
  const handleOpenConfig = (workflow_name: string, job_name: string) => {
    // 查找是否已配置责任人
    const existingOwner = jobOwners?.find(
      (o) => o.workflow_name === workflow_name && o.job_name === job_name
    )
    
    if (existingOwner) {
      // 编辑模式：填充现有数据
      setIsEditMode(true)
      form.setFieldsValue({
        workflow_job: [workflow_name, job_name],
        owner: existingOwner.owner,
        email: existingOwner.email,
        notes: existingOwner.notes,
        display_name: existingOwner.display_name,
      })
    } else {
      // 新建模式：只填充 Workflow/Job
      setIsEditMode(false)
      form.setFieldsValue({
        workflow_job: [workflow_name, job_name],
      })
    }
    setIsModalOpen(true)
  }

  // 提交表单（新建/更新责任人）
  const handleSubmit = async (values: any) => {
    try {
      const [workflow_name, job_name] = values.workflow_job
      
      // Select tags 模式返回的是数组，取第一个值
      const ownerValue = Array.isArray(values.owner) ? values.owner[0] : values.owner
      
      if (!ownerValue) {
        message.error('请选择或输入责任人')
        return
      }

      if (isEditMode) {
        // 更新模式
        const existingOwner = jobOwners?.find(
          (o) => o.workflow_name === workflow_name && o.job_name === job_name
        )
        if (existingOwner && existingOwner.id) {
          await updateMutation.mutateAsync({
            ownerId: existingOwner.id,
            data: {
              owner: ownerValue,
              email: values.email,
              notes: values.notes,
              display_name: values.display_name,
            },
          })
          message.success('更新成功')
        }
      } else {
        // 新建模式
        await createMutation.mutateAsync({
          workflow_name,
          job_name,
          owner: ownerValue,
          email: values.email,
          notes: values.notes,
          display_name: values.display_name,
        })
        message.success('创建成功')
      }
      setIsModalOpen(false)
      setIsEditMode(false)
      form.resetFields()
      refetch()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  // 切换隐藏状态
  const handleToggleHidden = async (record: JobConfigItem) => {
    const newIsHidden = !record.is_hidden

    if (record.has_owner && record.owner_id) {
      // 已配置责任人的，使用 job_owner 的 toggle-hidden API
      try {
        await toggleHiddenMutation.mutateAsync(record.owner_id)
        message.success('状态已更新')
      } catch (error: any) {
        message.error(error.response?.data?.detail || '操作失败')
      }
    } else {
      // 未配置责任人的，使用 job_visibility
      try {
        await toggleVisibilityMutation.mutateAsync({
          workflow_name: record.workflow_name,
          job_name: record.job_name,
          is_hidden: newIsHidden,
        })
        message.success('状态已更新')
      } catch (error: any) {
        message.error(error.response?.data?.detail || '操作失败')
      }
    }
  }

  // 表格列定义
  const columns = [
    {
      title: 'Workflow',
      dataIndex: 'workflow_name',
      key: 'workflow_name',
      width: 180,
      filters: Array.from(new Set(jobConfigList.map(jo => jo.workflow_name))).map((wf) => ({
        text: wf,
        value: wf,
      })),
      filteredValue: workflowFilter,
      onFilter: (value: any, record: JobConfigItem) => record.workflow_name === value,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Job 名称',
      dataIndex: 'job_name',
      key: 'job_name',
      width: 250,
      ellipsis: true,
      render: (text: string, record: JobConfigItem) => (
        <Tooltip
          title={
            <div>
              <div><strong>Job:</strong> {text}</div>
              {record.display_name && <div><strong>显示名:</strong> {record.display_name}</div>}
            </div>
          }
          placement="topLeft"
        >
          <div style={{ maxWidth: 230 }}>
            <Space direction="vertical" size={0}>
              <Text strong ellipsis>{text}</Text>
              {record.display_name && (
                <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                  {record.display_name}
                </Text>
              )}
            </Space>
          </div>
        </Tooltip>
      ),
    },
    {
      title: '责任人',
      key: 'owner',
      width: 200,
      render: (_: any, record: JobConfigItem) => {
        if (!record.owner) {
          return (
            <Tag color="default">未配置</Tag>
          )
        }
        return (
          <Space direction="vertical" size={0}>
            <Tag color="green">{record.owner}</Tag>
            {record.email && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.email}
              </Text>
            )}
          </Space>
        )
      },
    },
    {
      title: '显示状态',
      key: 'is_hidden',
      width: 100,
      render: (_: any, record: JobConfigItem) => (
        <Space size="small">
          <Switch
            checkedChildren="显示"
            unCheckedChildren="隐藏"
            checked={!record.is_hidden}
            onChange={() => handleToggleHidden(record)}
          />
          {record.is_hidden && (
            <Tag color="default">隐藏</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      width: 200,
      ellipsis: true,
      render: (text: string | null) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: JobConfigItem) => (
        <Button
          type="link"
          size="small"
          onClick={() => handleOpenConfig(record.workflow_name, record.job_name)}
        >
          配置
        </Button>
      ),
    },
  ]

  // 统计信息
  const stats = {
    total: jobConfigList.length,
    visible: jobConfigList.filter(j => !j.is_hidden).length,
    hidden: jobConfigList.filter(j => j.is_hidden).length,
    configured: jobOwners?.length || 0,
  }

  return (
    <div>
      {/* 统计卡片 */}
      <Space size="large" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.total}</div>
          <div style={{ color: '#999' }}>总 Job 数</div>
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>{stats.visible}</div>
          <div style={{ color: '#999' }}>已显示</div>
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#8c8c8c' }}>{stats.hidden}</div>
          <div style={{ color: '#999' }}>已隐藏</div>
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>{stats.configured}</div>
          <div style={{ color: '#999' }}>已配置责任人</div>
        </div>
      </Space>

      {/* 操作栏 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Space>
          <Select
            mode="multiple"
            placeholder="筛选 Workflow"
            style={{ width: 200 }}
            options={Array.from(new Set(jobConfigList.map(j => j.workflow_name))).map(wf => ({
              label: wf,
              value: wf,
            }))}
            value={workflowFilter}
            onChange={setWorkflowFilter}
            allowClear
          />
          <Button
            icon={showHidden ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            onClick={() => setShowHidden(!showHidden)}
          >
            {showHidden ? '显示未隐藏' : '显示已隐藏'}
          </Button>
        </Space>
      </div>

      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={filteredData}
        loading={isLoading}
        rowKey={(record) => `${record.workflow_name}-${record.job_name}`}
        pagination={{
          pageSize: 20,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
        scroll={{ x: 1400 }}
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
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false)
          setIsEditMode(false)
          form.resetFields()
        }}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
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
              showSearch
              disabled={isEditMode}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="display_name"
            label="Job 显示名"
          >
            <Input placeholder="请输入 Job 显示名（可选）" />
          </Form.Item>

          <Form.Item
            name="owner"
            label="责任人"
            rules={[{ required: true, message: '请选择或输入责任人' }]}
          >
            <Select
              placeholder="请选择或输入责任人"
              showSearch
              allowClear
              mode="tags"
              maxTagCount="responsive"
              tokenSeparators={[',']}
              options={ownerOptions}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
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
                setIsEditMode(false)
                form.resetFields()
              }}>
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                完成
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default JobConfig
