import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Table, Space, Tag, Typography, Button, Descriptions, Alert, Select } from 'antd'
import {
  ArrowLeftOutlined,
  EyeOutlined,
  GithubOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { formatDuration, renderStatusTag, renderConclusionTag } from '../utils/ciRenderers'
import { formatTimezone, fromTimezoneNow } from '../utils/timezone'

const { Text, Title } = Typography

interface JobRun {
  id: number
  job_id: number
  run_id: number
  workflow_name: string
  job_name: string
  status: string
  conclusion: string | null
  hardware: string | null
  runner_name: string | null
  started_at: string | null
  completed_at: string | null
  duration_seconds: number | null
  created_at: string
}

function JobRuns() {
  const { workflowName, jobName } = useParams<{ workflowName: string; jobName: string }>()
  const navigate = useNavigate()

  const [conclusionFilter, setConclusionFilter] = useState<string[]>([])
  const [daysFilter, setDaysFilter] = useState<number | 'all'>(7)

  // 获取 job 的所有运行记录（带时间窗口过滤）
  const { data: jobRuns, isLoading: runsLoading, refetch } = useQuery<JobRun[]>({
    queryKey: ['job-runs', workflowName, jobName, daysFilter],
    queryFn: async () => {
      const response = await api.get<JobRun[]>('/job-owners/jobs/runs', {
        params: {
          workflow_name: workflowName,
          job_name: jobName,
          days: daysFilter === 'all' ? undefined : daysFilter,
        },
      })
      return response.data
    },
    enabled: !!workflowName && !!jobName,
  })

  // 获取责任人信息
  const { data: jobOwners } = useQuery<Array<{ workflow_name: string; job_name: string; owner: string; display_name: string | null; email: string | null }>>({
    queryKey: ['job-owners', { workflow_name: workflowName }],
    queryFn: async () => {
      const response = await api.get('/job-owners', {
        params: { workflow_name: workflowName },
      })
      return response.data
    },
  })

  const jobOwner = jobOwners?.find(
    (jo) => jo.workflow_name === workflowName && jo.job_name === jobName
  )

  // 表格列定义
  const columns = [
    {
      title: 'Run ID',
      dataIndex: 'run_id',
      key: 'run_id',
      width: 100,
      render: (runId: number) => (
        <Space size={4}>
          <Text strong>#{runId}</Text>
          <a
            href={`https://github.com/vllm-project/vllm-ascend/actions/runs/${runId}`}
            target="_blank"
            rel="noopener noreferrer"
            title="在 GitHub 上查看"
          >
            <GithubOutlined />
          </a>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: renderStatusTag,
    },
    {
      title: '结果',
      dataIndex: 'conclusion',
      key: 'conclusion',
      width: 100,
      filters: [
        { text: '成功', value: 'success' },
        { text: '失败', value: 'failure' },
        { text: '取消', value: 'cancelled' },
        { text: '进行中', value: 'in_progress' },
        { text: '等待中', value: 'queued' },
        { text: '其他', value: 'other' },
      ],
      filteredValue: conclusionFilter,
      onFilter: (value: any, record: JobRun) => {
        if (value === 'other') {
          return record.conclusion !== 'success' && record.conclusion !== 'failure' && record.conclusion !== 'cancelled'
        }
        return record.conclusion === value
      },
      render: renderConclusionTag,
    },
    {
      title: '硬件',
      dataIndex: 'hardware',
      key: 'hardware',
      width: 100,
      render: (hardware: string | null) => {
        if (!hardware) return '-'
        const colorMap: Record<string, string> = {
          A2: 'green',
          A3: 'purple',
          '310P': 'orange',
        }
        return <Tag color={colorMap[hardware] || 'default'}>{hardware}</Tag>
      },
    },
    {
      title: '时长',
      dataIndex: 'duration_seconds',
      key: 'duration_seconds',
      width: 90,
      render: formatDuration,
    },
    {
      title: 'Runner',
      dataIndex: 'runner_name',
      key: 'runner_name',
      width: 200,
      ellipsis: true,
      render: (runnerName: string | null) => runnerName || '-',
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 180,
      sorter: (a: JobRun, b: JobRun) => {
        if (!a.started_at) return -1
        if (!b.started_at) return 1
        return new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      },
      render: (startedAt: string | null) => {
        if (!startedAt) return '-'
        return (
          <Space direction="vertical" size={0}>
            <Text strong>{formatTimezone(startedAt, 'YYYY-MM-DD HH:mm:ss')}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {fromTimezoneNow(startedAt)}
            </Text>
          </Space>
        )
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: JobRun) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/ci/jobs/${record.job_id}`)}
        >
          查看详情
        </Button>
      ),
    },
  ]

  // 统计信息
  const stats = {
    total: jobRuns?.length || 0,
    success: jobRuns?.filter((j) => j.conclusion === 'success').length || 0,
    failure: jobRuns?.filter((j) => j.conclusion === 'failure').length || 0,
    inProgress: jobRuns?.filter((j) => j.status === 'in_progress').length || 0,
  }

  if (!workflowName || !jobName) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="参数错误"
          description="缺少 workflow 或 job 名称参数"
          type="error"
          showIcon
        />
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      {/* 返回按钮和标题 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ci?tab=job')}>
            返回 Job 统计
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            刷新
          </Button>
        </Space>
        <Select
          value={daysFilter}
          onChange={setDaysFilter}
          options={[
            { label: '最近 7 天', value: 7 },
            { label: '最近 14 天', value: 14 },
            { label: '最近 30 天', value: 30 },
            { label: '全部数据', value: 'all' },
          ]}
          style={{ width: 120 }}
        />
      </div>

      <Title level={2} style={{ marginBottom: 24 }}>
        Job 运行历史
      </Title>

      {/* Job 基本信息 */}
      <Card style={{ marginBottom: 24 }}>
        <Descriptions column={4} bordered>
          <Descriptions.Item label="Workflow">
            <Tag color="blue">{workflowName}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Job 名称">
            <Space direction="vertical" size={0}>
              <Text strong>{jobName}</Text>
              {jobOwner?.display_name && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {jobOwner.display_name}
                </Text>
              )}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="责任人">
            {jobOwner ? (
              <Space direction="vertical" size={0}>
                <Tag color="green">{jobOwner.owner}</Tag>
                {jobOwner.email && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {jobOwner.email}
                  </Text>
                )}
              </Space>
            ) : (
              <Text type="secondary">未配置</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="统计范围">
            <Tag color="orange">{daysFilter === 'all' ? '全部数据' : `最近 ${daysFilter} 天`}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 统计卡片 */}
      <Card style={{ marginBottom: 24 }}>
        <Space size="large" style={{ justifyContent: 'space-around', width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.total}</div>
            <div style={{ color: '#999' }}>总运行次数</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>{stats.success}</div>
            <div style={{ color: '#999' }}>成功</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>{stats.failure}</div>
            <div style={{ color: '#999' }}>失败</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>{stats.inProgress}</div>
            <div style={{ color: '#999' }}>进行中</div>
          </div>
        </Space>
      </Card>

      {/* 运行记录表格 */}
      <Card title="运行记录">
        <Table
          columns={columns}
          dataSource={jobRuns || []}
          loading={runsLoading}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          scroll={{ x: 1200 }}
          onChange={(_, filters) => {
            if (filters.conclusion) {
              setConclusionFilter(filters.conclusion as string[])
            } else {
              setConclusionFilter([])
            }
          }}
          onRow={(record: JobRun) => ({
            onClick: () => navigate(`/ci/jobs/${record.job_id}`),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>
    </div>
  )
}

export default JobRuns
