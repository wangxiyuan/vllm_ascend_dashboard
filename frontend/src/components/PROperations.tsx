import { useState } from 'react'
import { Card, Input, Button, Space, message, Descriptions, Tag, Spin, Modal, Alert, Typography } from 'antd'
import { ReloadOutlined, MergeOutlined } from '@ant-design/icons'
import { getPRCIStatus, rerunPRCI, forceMergePR, type WorkflowRun } from '../services/projectDashboard'
import { useCurrentUser } from '../hooks/useCurrentUser'

const { Title, Text } = Typography

interface PROperationsProps {
  isAdmin: boolean
}

export default function PROperations({ isAdmin }: PROperationsProps) {
  const { data: currentUser } = useCurrentUser()
  const isLoggedIn = !!localStorage.getItem('access_token')

  const [ciStatusPrNumber, setCiStatusPrNumber] = useState<number | null>(null)
  const [ciStatus, setCiStatus] = useState<{
    pr_title: string
    pr_url: string
    pr_state: string
    workflow_runs: {
      in_progress: WorkflowRun[]
      queued: WorkflowRun[]
      completed: WorkflowRun[]
      failed: WorkflowRun[]
      success: WorkflowRun[]
      skipped: WorkflowRun[]
    }
    summary: Record<string, number>
  } | null>(null)
  const [ciStatusLoading, setCiStatusLoading] = useState(false)
  const [prActionLoading, setPrActionLoading] = useState(false)
  const [prActionModalVisible, setPrActionModalVisible] = useState(false)

  const loadCIStatus = async (prNumber: number) => {
    setCiStatusLoading(true)
    try {
      const data = await getPRCIStatus(prNumber)
      setCiStatus({
        pr_title: data.pr_title,
        pr_url: data.pr_url,
        pr_state: data.pr_state,
        workflow_runs: data.workflow_runs,
        summary: data.summary,
      })
      setCiStatusPrNumber(prNumber)
    } catch (error: any) {
      console.error('[PR CI Status] Error:', error)
      message.error('加载 CI 状态失败：' + (error.response?.data?.detail || error.message))
      setCiStatus(null)
      setCiStatusPrNumber(null)
    } finally {
      setCiStatusLoading(false)
    }
  }

  // 重新触发 CI（直接执行，不弹窗）
  const handleRerunCI = async () => {
    if (!ciStatusPrNumber) {
      message.error('请先查询 PR 状态')
      return
    }

    setPrActionLoading(true)

    try {
      message.loading({ content: `正在触发 PR #${ciStatusPrNumber} 的 CI 重新运行...`, key: 'pr-action', duration: 0 })
      const result = await rerunPRCI(ciStatusPrNumber)
      message.success({
        content: `CI 重新运行已触发！${result.workflow_id ? `(Workflow ID: ${result.workflow_id})` : ''}`,
        key: 'pr-action',
        duration: 5
      })
      // 重新加载 CI 状态
      await loadCIStatus(ciStatusPrNumber)
    } catch (error: any) {
      message.error({
        content: '操作失败：' + (error.response?.data?.detail || error.message),
        key: 'pr-action',
        duration: 5
      })
    } finally {
      setPrActionLoading(false)
    }
  }

  // 强行合入 PR（需要二次确认）
  const handleForceMerge = async () => {
    if (!ciStatusPrNumber) {
      message.error('请先查询 PR 状态')
      return
    }

    setPrActionLoading(true)

    try {
      message.loading({ content: `正在强行合入 PR #${ciStatusPrNumber}...`, key: 'pr-action', duration: 0 })
      const result = await forceMergePR(ciStatusPrNumber)
      message.success({
        content: `PR #${ciStatusPrNumber} 已合入！${result.merge_sha ? `(SHA: ${result.merge_sha?.slice(0, 7)})` : ''}`,
        key: 'pr-action',
        duration: 5
      })
      setPrActionModalVisible(false)
      // 重新加载 CI 状态
      await loadCIStatus(ciStatusPrNumber)
    } catch (error: any) {
      message.error({
        content: '操作失败：' + (error.response?.data?.detail || error.message),
        key: 'pr-action',
        duration: 5
      })
    } finally {
      setPrActionLoading(false)
    }
  }

  // 判断是否允许重新触发 CI：有失败且没有运行中的任务
  const canRerunCI = ciStatus && (
    ciStatus.summary.failed > 0 && 
    ciStatus.summary.in_progress === 0
  )

  return (
    <>
      {!isLoggedIn ? (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <p>需要登录才能执行 PR 操作</p>
          <Button type="primary" onClick={() => window.location.href = '/login'}>去登录</Button>
        </div>
      ) : (
        <>
          {/* PR 查询 */}
          <Card
            title="PR CI 状态查询"
            size="small"
            style={{ marginBottom: 16 }}
          >
            <Space>
              <Input
                type="number"
                placeholder="输入 PR 编号"
                style={{ width: 150 }}
                defaultValue={ciStatusPrNumber || ''}
                onPressEnter={(e) => {
                  const val = parseInt((e.target as HTMLInputElement).value)
                  if (val) loadCIStatus(val)
                }}
                id="pr-number-input"
              />
              <Button
                type="primary"
                onClick={() => {
                  const input = document.getElementById('pr-number-input') as HTMLInputElement
                  const val = parseInt(input?.value || '')
                  if (val) loadCIStatus(val)
                  else message.error('请输入 PR 编号')
                }}
              >
                查询
              </Button>
            </Space>
          </Card>

          {/* CI 状态显示 */}
          {ciStatusLoading && <Spin tip="加载 CI 状态中..." />}

          {ciStatus && !ciStatusLoading && (
            <Card size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="PR" span={2}>
                  <a href={ciStatus.pr_url} target="_blank" rel="noopener noreferrer">
                    {ciStatus.pr_title} #{ciStatusPrNumber}
                  </a>
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={ciStatus.pr_state === 'open' ? 'success' : 'default'}>
                    {ciStatus.pr_state === 'open' ? 'Open' : 'Closed'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="运行中">
                  <Tag color="processing">{ciStatus.summary.in_progress || 0}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="等待中">
                  <Tag color="warning">{ciStatus.summary.queued || 0}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="失败">
                  <Tag color="error">{ciStatus.summary.failed || 0}</Tag>
                </Descriptions.Item>
              </Descriptions>

              {/* 操作按钮 */}
              <div style={{ marginTop: 16 }}>
                <Space>
                  <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    onClick={handleRerunCI}
                    disabled={!canRerunCI}
                    loading={prActionLoading}
                  >
                    重新触发 CI
                  </Button>
                  {isAdmin && (
                    <Button
                      danger
                      icon={<MergeOutlined />}
                      onClick={() => setPrActionModalVisible(true)}
                      disabled={ciStatus.pr_state !== 'open'}
                    >
                      强行合入 PR
                    </Button>
                  )}
                </Space>
              </div>

              {/* 等待中的任务 */}
              {(ciStatus.workflow_runs.queued || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Title level={5}>等待中的任务</Title>
                  {(ciStatus.workflow_runs.queued || []).map(run => (
                    <div key={run.id} style={{ marginBottom: 8 }}>
                      <Space>
                        <Tag color="warning">等待中</Tag>
                        <Text strong>{run.name}</Text>
                        <a href={run.html_url} target="_blank" rel="noopener noreferrer">查看</a>
                      </Space>
                    </div>
                  ))}
                </div>
              )}

              {/* 运行中的任务 */}
              {(ciStatus.workflow_runs.in_progress || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Title level={5}>运行中的任务</Title>
                  {(ciStatus.workflow_runs.in_progress || []).map(run => (
                    <div key={run.id} style={{ marginBottom: 8 }}>
                      <Space>
                        <Tag color="processing">运行中</Tag>
                        <Text strong>{run.name}</Text>
                        <a href={run.html_url} target="_blank" rel="noopener noreferrer">查看</a>
                      </Space>
                    </div>
                  ))}
                </div>
              )}

              {/* 失败的任务 */}
              {(ciStatus.workflow_runs.failed || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Title level={5}>失败的任务</Title>
                  {(ciStatus.workflow_runs.failed || []).map(run => (
                    <div key={run.id} style={{ marginBottom: 8 }}>
                      <Space>
                        <Tag color="error">失败</Tag>
                        <Text strong>{run.name}</Text>
                        <a href={run.details_url || run.html_url} target="_blank" rel="noopener noreferrer">查看</a>
                      </Space>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* 强行合入 PR 确认弹窗 */}
      {prActionModalVisible && (
        <Modal
          title="确认强行合入 PR"
          open={prActionModalVisible}
          onCancel={() => setPrActionModalVisible(false)}
          onOk={handleForceMerge}
          okText="确认"
          cancelText="取消"
          confirmLoading={prActionLoading}
          okButtonProps={{
            danger: true,
            loading: prActionLoading,
          }}
        >
          <Alert
            message="警告"
            description="强行合入 PR 是破坏性操作，请确保您了解后果。"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <p>确定要强行合入 PR #{ciStatusPrNumber} 吗？</p>
        </Modal>
      )}
    </>
  )
}
