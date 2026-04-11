import { useParams, useNavigate } from 'react-router-dom'
import { Card, Table, Tag, Button, Space, Typography, Descriptions, Divider, Alert, Tooltip, message } from 'antd'
import { useState } from 'react'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ArrowLeftOutlined,
  GithubOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useJobsByRun, useRuns } from '../hooks/useCI'
import { useJobOwners } from '../hooks/useJobOwners'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import { formatTimezone, fromTimezoneNow } from '../utils/timezone'
import { renderStatusTag, renderConclusionTag, formatDuration, renderHardwareTag } from '../utils/ciRenderers'

dayjs.extend(duration)
dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const { Title, Text } = Typography

function WorkflowDetail() {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()
  const runIdNum = runId ? parseInt(runId) : null

  const [conclusionFilter, setConclusionFilter] = useState<string[]>([])
  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useJobsByRun(runIdNum)
  const { data: runs, refetch: refetchRuns } = useRuns({ limit: 100 })
  const { data: jobOwners } = useJobOwners()

  // 找到当前 run 的信息 - 使用 run_id 匹配
  const currentRun = runs?.find(r => r.run_id === runIdNum)

  // 构建 job owner 查找表：key = workflow_name + job_name
  const ownerMap = new Map<string, { owner: string; display_name?: string | null }>()
  jobOwners?.forEach(owner => {
    const key = `${owner.workflow_name}-${owner.job_name}`
    ownerMap.set(key, { owner: owner.owner, display_name: owner.display_name })
  })

  // 刷新数据
  const handleRefresh = async () => {
    await Promise.all([refetchJobs(), refetchRuns()])
    message.success('数据已刷新')
  }

  // 表格列定义
  const columns = [
    {
      title: 'Job 名称',
      dataIndex: 'job_name',
      key: 'job_name',
      width: 250,
      ellipsis: true,
      render: (text: string, record: any) => {
        const ownerKey = `${record.workflow_name}-${record.job_name}`
        const ownerInfo = ownerMap.get(ownerKey)
        return (
          <Tooltip
            title={
              <div>
                <div><strong>Job:</strong> {text}</div>
                {ownerInfo?.display_name && <div><strong>显示名:</strong> {ownerInfo.display_name}</div>}
                {record.runner_name && <div><strong>Runner:</strong> {record.runner_name}</div>}
              </div>
            }
            placement="topLeft"
          >
            <div style={{ maxWidth: 230 }}>
              <Space direction="vertical" size={0}>
                <Text strong ellipsis>{text}</Text>
                {ownerInfo?.display_name && (
                  <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                    {ownerInfo.display_name}
                  </Text>
                )}
                {record.runner_name && (
                  <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                    Runner: {record.runner_name}
                  </Text>
                )}
              </Space>
            </div>
          </Tooltip>
        )
      },
    },
    {
      title: '硬件',
      dataIndex: 'hardware',
      key: 'hardware',
      render: renderHardwareTag,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: renderStatusTag,
    },
    {
      title: '结果',
      dataIndex: 'conclusion',
      key: 'conclusion',
      filters: [
        { text: '成功', value: 'success' },
        { text: '失败', value: 'failure' },
        { text: '取消', value: 'cancelled' },
        { text: '进行中', value: 'in_progress' },
        { text: '等待中', value: 'queued' },
        { text: '其他', value: 'other' },
      ],
      filteredValue: conclusionFilter,
      onFilter: (value: any, record: any) => {
        if (value === 'other') {
          return record.conclusion !== 'success' && record.conclusion !== 'failure' && record.conclusion !== 'cancelled'
        }
        return record.conclusion === value
      },
      render: renderConclusionTag,
    },
    {
      title: '时长',
      dataIndex: 'duration_seconds',
      key: 'duration_seconds',
      render: formatDuration,
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (startedAt: string | null) => {
        if (!startedAt) return '-'
        return (
          <Space direction="vertical" size={0}>
            <Text>{formatTimezone(startedAt)}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {fromTimezoneNow(startedAt)}
            </Text>
          </Space>
        )
      },
    },
    {
      title: 'Steps',
      key: 'steps',
      render: (_: any, record: any) => {
        if (!record.steps_summary || record.steps_summary.length === 0) return '-'
        const successCount = record.steps_summary.filter((s: any) => s.conclusion === 'success').length
        const failureCount = record.steps_summary.filter((s: any) => s.conclusion === 'failure').length
        const skippedCount = record.steps_summary.filter((s: any) => s.conclusion === 'skipped').length

        return (
          <Space size="small">
            {successCount > 0 && (
              <Tag color="success" icon={<CheckCircleOutlined />}>{successCount}</Tag>
            )}
            {failureCount > 0 && (
              <Tag color="error" icon={<CloseCircleOutlined />}>{failureCount}</Tag>
            )}
            {skippedCount > 0 && (
              <Tag color="default">{skippedCount}</Tag>
            )}
          </Space>
        )
      },
    },
    {
      title: '责任人',
      key: 'owner',
      render: (_: any, record: any) => {
        const ownerKey = `${record.workflow_name}-${record.job_name}`
        const ownerInfo = ownerMap.get(ownerKey)
        if (!ownerInfo) return '-'
        return (
          <Space>
            <UserOutlined />
            <Text>{ownerInfo.owner}</Text>
          </Space>
        )
      },
    },
  ]

  // 统计信息
  const stats = {
    total: jobs?.length || 0,
    success: jobs?.filter(j => j.conclusion === 'success').length || 0,
    failure: jobs?.filter(j => j.conclusion === 'failure').length || 0,
    inProgress: jobs?.filter(j => j.status === 'in_progress').length || 0,
    cancelled: jobs?.filter(j => j.conclusion === 'cancelled').length || 0,
  }

  return (
    <div style={{ padding: 24 }}>
      {/* 返回按钮和标题 */}
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ci')}>
          返回 CI 看板
        </Button>
        {currentRun?.github_html_url && (
          <Button
            icon={<GithubOutlined />}
            href={currentRun.github_html_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            在 GitHub 上查看
          </Button>
        )}
      </Space>

      <Title level={2} style={{ marginBottom: 24 }}>
        Workflow 运行详情 {runIdNum ? `(#${runIdNum})` : ''}
      </Title>

      {/* 没有数据时的提示 */}
      {!currentRun && !jobsLoading && (
        <Alert
          message="未找到 Workflow 运行记录"
          description={`数据库中找不到 run_id: ${runIdNum} 的记录，请确认 ID 是否正确，或先同步数据。`}
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
          action={
            <Button size="small" onClick={() => navigate('/ci')}>
              返回 CI 看板
            </Button>
          }
        />
      )}

      {/* Jobs 为空的提示 */}
      {currentRun && jobs && jobs.length === 0 && !jobsLoading && (
        <Alert
          message="暂无 Jobs 数据"
          description="该 Workflow 运行记录没有关联的 Jobs，可能是 GitHub API 未返回数据或该运行已被取消。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Workflow 基本信息 */}
      {currentRun && (
        <Card style={{ marginBottom: 24 }}>
          <Descriptions column={4} bordered>
            <Descriptions.Item label="Workflow">{currentRun.workflow_name}</Descriptions.Item>
            <Descriptions.Item label="Run ID">
              <Space size={4}>
                #{currentRun.run_id}
                {currentRun.github_html_url && (
                  <a
                    href={currentRun.github_html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="在 GitHub 上查看"
                  >
                    <GithubOutlined />
                  </a>
                )}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Run Number">#{currentRun.run_number || '-'}</Descriptions.Item>
            <Descriptions.Item label="事件类型">{currentRun.event || '-'}</Descriptions.Item>
            <Descriptions.Item label="分支">{currentRun.branch || '-'}</Descriptions.Item>
            <Descriptions.Item label="Commit SHA">
              {currentRun.head_sha ? (
                <Text code style={{ fontSize: 12 }}>{currentRun.head_sha.substring(0, 7)}</Text>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="硬件">
              {currentRun.hardware ? (
                <Tag color={currentRun.hardware === 'A2' ? 'green' : 'purple'}>
                  {currentRun.hardware}
                </Tag>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {renderStatusTag(currentRun.status)}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* 统计卡片 */}
      <Card style={{ marginBottom: 24 }}>
        <Space size="large" style={{ justifyContent: 'space-around', width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.total}</div>
            <div style={{ color: '#999' }}>总 Jobs</div>
          </div>
          <Divider type="vertical" style={{ height: 40 }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>{stats.success}</div>
            <div style={{ color: '#999' }}>成功</div>
          </div>
          <Divider type="vertical" style={{ height: 40 }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>{stats.failure}</div>
            <div style={{ color: '#999' }}>失败</div>
          </div>
          <Divider type="vertical" style={{ height: 40 }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>{stats.inProgress}</div>
            <div style={{ color: '#999' }}>进行中</div>
          </div>
          <Divider type="vertical" style={{ height: 40 }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#faad14' }}>{stats.cancelled}</div>
            <div style={{ color: '#999' }}>已取消</div>
          </div>
        </Space>
      </Card>

      {/* Jobs 表格 */}
      <Card title="Jobs 列表">
        <Table
          columns={columns}
          dataSource={jobs || []}
          loading={jobsLoading}
          rowKey="job_id"
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
          }}
          scroll={{ x: 1400 }}
          onRow={(record: any) => ({
            onClick: () => navigate(`/ci/jobs/${record.job_id}`),
            style: { cursor: 'pointer' },
          })}
          onChange={(_, filters) => {
            if (filters.conclusion) {
              setConclusionFilter(filters.conclusion as string[])
            } else {
              setConclusionFilter([])
            }
          }}
        />
      </Card>
    </div>
  )
}

export default WorkflowDetail
