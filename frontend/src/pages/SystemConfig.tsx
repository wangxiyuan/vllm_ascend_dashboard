import { useState, useEffect, useMemo } from 'react'
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  message,
  Alert,
  Modal,
  Typography,
  Tabs,
  Table,
  Collapse,
} from 'antd'
import {
  SettingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  GithubOutlined,
  SyncOutlined,
  EditOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined,
  RobotOutlined,
  KeyOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import { useSystemConfig, useSystemStatus, useUpdateAppConfig, useUpdateGitHubConfig, useUpdateSyncConfig } from '../hooks/useSystemConfig'
import {
  useDailySummaryConfig,
  useUpdateDailySummaryConfig,
  useLLMProviders,
  useUpdateLLMProvider,
  useSystemPromptConfig,
  useUpdateSystemPromptConfig,
} from '../hooks/useDailySummary'

const { Text, Title } = Typography

// 格式化倒计时
const formatCountdown = (ms: number): string => {
  if (ms <= 0) return '即将执行'
  
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  
  const parts: string[] = []
  if (days > 0) parts.push(`${days}天`)
  if (hours > 0) parts.push(`${hours}小时`)
  if (minutes > 0) parts.push(`${minutes}分钟`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}秒`)
  
  return parts.join('')
}

// 计算倒计时的 Hook
const useCountdown = (targetTime: string | null | undefined, intervalMinutes: number | undefined) => {
  const [countdown, setCountdown] = useState<string>('')
  
  useEffect(() => {
    if (!targetTime || !intervalMinutes) {
      setCountdown('')
      return
    }
    
    const updateCountdown = () => {
      const target = new Date(targetTime).getTime()
      const now = Date.now()
      const diff = target - now
      
      if (diff <= 0) {
        // 如果已过时间，使用间隔时间计算下一次
        const nextTarget = target + intervalMinutes * 60 * 1000
        const newDiff = nextTarget - now
        setCountdown(formatCountdown(newDiff))
      } else {
        setCountdown(formatCountdown(diff))
      }
    }
    
    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    
    return () => clearInterval(timer)
  }, [targetTime, intervalMinutes])
  
  return countdown
}

function SystemConfig() {
  const [appConfigForm] = Form.useForm()
  const [gitHubConfigForm] = Form.useForm()
  const [syncConfigForm] = Form.useForm()
  const [dailySummaryConfigForm] = Form.useForm()
  const [llmProviderForm] = Form.useForm()
  const [systemPromptForm] = Form.useForm()

  const { data: config, isLoading: configLoading } = useSystemConfig()
  const { data: status } = useSystemStatus()
  const updateAppMutation = useUpdateAppConfig()
  const updateGitHubMutation = useUpdateGitHubConfig()
  const updateSyncMutation = useUpdateSyncConfig()

  // 每日总结配置 hooks
  const { data: dailySummaryConfig, isLoading: dailySummaryConfigLoading } = useDailySummaryConfig()
  const { data: llmProviders } = useLLMProviders()
  const updateDailySummaryMutation = useUpdateDailySummaryConfig()
  const updateLLMProviderMutation = useUpdateLLMProvider()

  // 系统提示词配置 hooks
  const { data: systemPromptConfig, isLoading: systemPromptConfigLoading } = useSystemPromptConfig()
  const updateSystemPromptMutation = useUpdateSystemPromptConfig()

  const [isAppConfigModalOpen, setIsAppConfigModalOpen] = useState(false)
  const [isGitHubConfigModalOpen, setIsGitHubConfigModalOpen] = useState(false)
  const [isSyncConfigModalOpen, setIsSyncConfigModalOpen] = useState(false)
  const [isDailySummaryConfigModalOpen, setIsDailySummaryConfigModalOpen] = useState(false)
  const [isLLMProviderModalOpen, setIsLLMProviderModalOpen] = useState(false)
  const [selectedLLMProvider, setSelectedLLMProvider] = useState<string | null>(null)
  const [isSystemPromptModalOpen, setIsSystemPromptModalOpen] = useState(false)

  const [activeTabKey, setActiveTabKey] = useState('system')

  // 倒计时 hooks
  const ciCountdown = useCountdown(
    status?.scheduler.tasks?.ci_sync?.next_sync,
    status?.scheduler.tasks?.ci_sync?.interval_minutes
  )
  const modelCountdown = useCountdown(
    status?.scheduler.tasks?.model_report_sync?.next_sync,
    status?.scheduler.tasks?.model_report_sync?.interval_minutes
  )
  const cacheCountdown = useCountdown(
    status?.scheduler.tasks?.project_dashboard_cache?.next_sync,
    status?.scheduler.tasks?.project_dashboard_cache?.interval_minutes
  )

  // 更新应用配置
  const handleUpdateAppConfig = (values: Record<string, string | boolean | null | undefined>) => {
    const updateData: Record<string, string | boolean> = {}
    if (values.log_level !== undefined && values.log_level !== null) {
      updateData.log_level = values.log_level as string
    }
    if (values.debug !== undefined && values.debug !== null) {
      updateData.debug = values.debug as boolean
    }

    updateAppMutation.mutate(updateData, {
      onSuccess: (data: { message: string }) => {
        message.success(data.message)
        setIsAppConfigModalOpen(false)
      },
      onError: (error: any) => {
        message.error(error.response?.data?.detail || '更新失败')
      },
    })
  }

  // 更新 GitHub 配置
  const handleUpdateGitHubConfig = (values: Record<string, string | null | undefined>) => {
    const updateData: Record<string, string> = {}
    if (values.github_token !== undefined && values.github_token !== null && values.github_token.trim()) {
      updateData.github_token = values.github_token.trim()
    }

    updateGitHubMutation.mutate(updateData, {
      onSuccess: (data: { message: string }) => {
        message.success(data.message)
        setIsGitHubConfigModalOpen(false)
      },
      onError: (error: any) => {
        message.error(error.response?.data?.detail || '更新失败')
      },
    })
  }

  // 打开应用配置编辑
  const handleOpenAppConfig = () => {
    appConfigForm.setFieldsValue({
      log_level: config?.app_config?.log_level,
      debug: config?.app_config?.debug,
    })
    setIsAppConfigModalOpen(true)
  }

  // 打开 GitHub 配置编辑
  const handleOpenGitHubConfig = () => {
    gitHubConfigForm.setFieldsValue({
      github_token: '',  // Token 不显示，只让用户输入新的
    })
    setIsGitHubConfigModalOpen(true)
  }

  // 打开同步配置编辑
  const handleOpenSyncConfig = () => {
    syncConfigForm.setFieldsValue({
      frontend_refresh_interval_minutes: config?.sync_config?.frontend_refresh_interval_minutes,
      github_cache_ttl_minutes: config?.sync_config?.github_cache_ttl_minutes,
    })
    setIsSyncConfigModalOpen(true)
  }

  // 更新同步配置
  const handleUpdateSyncConfig = (values: Record<string, string | boolean | number | null | undefined>) => {
    const updateData: Record<string, number | string> = {}
    if (values.frontend_refresh_interval_minutes !== undefined && values.frontend_refresh_interval_minutes !== null) {
      updateData.frontend_refresh_interval_minutes = values.frontend_refresh_interval_minutes as number
    }
    if (values.github_cache_ttl_minutes !== undefined && values.github_cache_ttl_minutes !== null) {
      updateData.github_cache_ttl_minutes = values.github_cache_ttl_minutes as number
    }

    updateSyncMutation.mutate(updateData, {
      onSuccess: (data: { message: string }) => {
        message.success(data.message)
        setIsSyncConfigModalOpen(false)
        syncConfigForm.resetFields()
      },
      onError: (error: any) => {
        message.error(error.response?.data?.detail || '更新失败')
      },
    })
  }

  // 渲染环境标签
  const renderEnvironmentTag = (env: string) => {
    const envMap: Record<string, { color: string; text: string }> = {
      development: { color: 'blue', text: '开发环境' },
      production: { color: 'red', text: '生产环境' },
      test: { color: 'orange', text: '测试环境' },
    }
    const config = envMap[env] || { color: 'default', text: env }
    return <Tag color={config.color}>{config.text}</Tag>
  }

  // 渲染数据库类型标签
  const renderDatabaseTypeTag = (type: string) => {
    const typeMap: Record<string, { color: string; icon: JSX.Element }> = {
      sqlite: { color: 'blue', icon: <DatabaseOutlined /> },
      mysql: { color: 'green', icon: <DatabaseOutlined /> },
    }
    const config = typeMap[type] || { color: 'default', icon: <DatabaseOutlined /> }
    return <Tag color={config.color} icon={config.icon}>{type.toUpperCase()}</Tag>
  }

  // 系统信息 Tab 内容（新增）
  const systemInfoTabContent = (
    <Card
      title={
        <span>
          <InfoCircleOutlined style={{ marginRight: 8 }} />
          系统信息
        </span>
      }
      loading={configLoading}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* 应用环境信息 */}
        <Descriptions
          title="应用环境"
          column={{ xxl: 3, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
          bordered
          size="small"
          styles={{ label: { width: 120, fontWeight: 'normal' } }}
          style={{ tableLayout: 'fixed' }}
        >
          <Descriptions.Item label="环境">
            {config?.app_config && renderEnvironmentTag(config.app_config.environment)}
          </Descriptions.Item>
          <Descriptions.Item label="调试模式">
            {config?.app_config ? (
              config.app_config.debug ? (
                <Tag color="green" icon={<CheckCircleOutlined />}>开启</Tag>
              ) : (
                <Tag color="default" icon={<CloseCircleOutlined />}>关闭</Tag>
              )
            ) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="日志级别">
            <Tag>{config?.app_config?.log_level || '-'}</Tag>
          </Descriptions.Item>
        </Descriptions>

        {/* 数据库状态 */}
        <Descriptions
          title="数据库状态"
          column={{ xxl: 3, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
          bordered
          size="small"
          styles={{ label: { width: 120, fontWeight: 'normal' } }}
          style={{ tableLayout: 'fixed' }}
        >
          <Descriptions.Item label="数据库类型">
            {config?.database_config && renderDatabaseTypeTag(config.database_config.type)}
          </Descriptions.Item>
          <Descriptions.Item label="配置状态">
            {config?.database_config?.configured ? (
              <Tag color="green" icon={<CheckCircleOutlined />}>已配置</Tag>
            ) : (
              <Tag color="red" icon={<CloseCircleOutlined />}>未配置</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="连接状态">
            {status?.database.connected ? (
              <Tag color="green" icon={<CheckCircleOutlined />}>正常</Tag>
            ) : (
              <Tag color="red" icon={<CloseCircleOutlined />}>异常</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>

        {/* Git 仓库缓存更新任务 */}
        <Descriptions
          title="Git 仓库缓存更新任务"
          column={{ xxl: 3, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
          bordered
          size="small"
          styles={{ label: { width: 120, fontWeight: 'normal' } }}
          style={{ tableLayout: 'fixed' }}
        >
          <Descriptions.Item label="下次同步时间">
            {status?.scheduler.tasks?.project_dashboard_cache?.next_sync ? (
              <Tag color="cyan"><ClockCircleOutlined style={{ marginRight: 4 }} />{new Date(status.scheduler.tasks.project_dashboard_cache.next_sync).toLocaleString()}</Tag>
            ) : (
              <Tag color="default">-</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="倒计时">
            {cacheCountdown ? (
              <Tag color="orange"><ClockCircleOutlined style={{ marginRight: 4 }} />{cacheCountdown}</Tag>
            ) : (
              <Tag color="default">-</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="同步间隔">
            <Tag color="purple">{status?.scheduler.tasks?.project_dashboard_cache?.interval_minutes} 分钟</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="任务状态">
            {status?.scheduler.running && status?.scheduler.tasks?.project_dashboard_cache?.next_sync ? (
              <Tag color="green" icon={<CheckCircleOutlined />}>正常</Tag>
            ) : (
              <Tag color="default">-</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>

        {/* CI 数据同步任务 */}
        <Descriptions
          title="CI 数据同步任务"
          column={{ xxl: 3, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
          bordered
          size="small"
          styles={{ label: { width: 120, fontWeight: 'normal' } }}
          style={{ tableLayout: 'fixed' }}
        >
          <Descriptions.Item label="下次同步时间">
            {status?.scheduler.tasks?.ci_sync?.next_sync ? (
              <Tag color="cyan"><ClockCircleOutlined style={{ marginRight: 4 }} />{new Date(status.scheduler.tasks.ci_sync.next_sync).toLocaleString()}</Tag>
            ) : (
              <Tag color="default">-</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="倒计时">
            {ciCountdown ? (
              <Tag color="orange"><ClockCircleOutlined style={{ marginRight: 4 }} />{ciCountdown}</Tag>
            ) : (
              <Tag color="default">-</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="同步间隔">
            <Tag color="blue">{status?.scheduler.tasks?.ci_sync?.interval_minutes || status?.scheduler.sync_interval_minutes} 分钟</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="任务状态">
            {status?.scheduler.running && status?.scheduler.tasks?.ci_sync?.next_sync ? (
              <Tag color="green" icon={<CheckCircleOutlined />}>正常</Tag>
            ) : (
              <Tag color="default">-</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>

        {/* 模型报告同步任务 */}
        <Descriptions
          title="模型报告同步任务"
          column={{ xxl: 3, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
          bordered
          size="small"
          styles={{ label: { width: 120, fontWeight: 'normal' } }}
          style={{ tableLayout: 'fixed' }}
        >
          <Descriptions.Item label="下次同步时间">
            {status?.scheduler.tasks?.model_report_sync?.next_sync ? (
              <Tag color="cyan"><ClockCircleOutlined style={{ marginRight: 4 }} />{new Date(status.scheduler.tasks.model_report_sync.next_sync).toLocaleString()}</Tag>
            ) : (
              <Tag color="default">-</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="倒计时">
            {modelCountdown ? (
              <Tag color="orange"><ClockCircleOutlined style={{ marginRight: 4 }} />{modelCountdown}</Tag>
            ) : (
              <Tag color="default">-</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="同步间隔">
            <Tag color="blue">{status?.scheduler.tasks?.model_report_sync?.interval_minutes || status?.scheduler.sync_interval_minutes} 分钟</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="任务状态">
            {status?.scheduler.running && status?.scheduler.tasks?.model_report_sync?.next_sync ? (
              <Tag color="green" icon={<CheckCircleOutlined />}>正常</Tag>
            ) : (
              <Tag color="default">-</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>

        {/* GitHub 仓库信息 */}
        <Descriptions
          title="GitHub 仓库"
          column={{ xxl: 3, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
          bordered
          size="small"
          styles={{ label: { width: 120, fontWeight: 'normal' } }}
          style={{ tableLayout: 'fixed' }}
        >
          <Descriptions.Item label="仓库">
            <Tag color="blue">{config?.github_config?.owner || '-'}/{config?.github_config?.repo || '-'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Token 状态" span={2}>
            {config?.github_config?.token_configured ? (
              <Tag color="green" icon={<CheckCircleOutlined />}>
                已配置 ({config?.github_config?.token_preview || '***'})
              </Tag>
            ) : (
              <Tag color="red" icon={<CloseCircleOutlined />}>未配置</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Space>
    </Card>
  )

  // 应用配置 Tab 内容
  const appConfigTabContent = (
    <Card
      title="应用配置"
      loading={configLoading}
      extra={
        <Button size="small" icon={<EditOutlined />} onClick={handleOpenAppConfig}>
          编辑
        </Button>
      }
    >
      <Descriptions
        column={{ xxl: 2, xl: 2, lg: 2, md: 2, sm: 2, xs: 1 }}
        bordered
        size="small"
        styles={{ label: { width: 120, fontWeight: 'normal' } }}
        style={{ tableLayout: 'fixed' }}
      >
        <Descriptions.Item label="调试模式">
          {config?.app_config?.debug ? (
            <Tag color="green" icon={<CheckCircleOutlined />}>开启</Tag>
          ) : (
            <Tag color="default" icon={<CloseCircleOutlined />}>关闭</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="日志级别">
          <Tag>{config?.app_config?.log_level || '-'}</Tag>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )

  // GitHub 配置 Tab 内容
  const githubConfigTabContent = (
    <Card
      title={
        <span>
          <GithubOutlined style={{ marginRight: 8 }} />
          GitHub 配置
        </span>
      }
      loading={configLoading}
      extra={
        <Button size="small" icon={<EditOutlined />} onClick={handleOpenGitHubConfig}>
          编辑
        </Button>
      }
    >
      <Descriptions
        column={{ xxl: 1, xl: 1, lg: 1, md: 1, sm: 1, xs: 1 }}
        bordered
        size="small"
        styles={{ label: { width: 120, fontWeight: 'normal' } }}
        style={{ tableLayout: 'fixed' }}
      >
        <Descriptions.Item label="项目">
          <Tag color="blue">vllm-project/vllm-ascend</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Token 状态">
          {config?.github_config?.token_configured ? (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              已配置 ({config?.github_config?.token_preview || '***'})
            </Tag>
          ) : (
            <Tag color="red" icon={<CloseCircleOutlined />}>未配置</Tag>
          )}
        </Descriptions.Item>
      </Descriptions>
      {!config?.github_config?.token_configured && (
        <Alert
          message="GitHub Token 未配置"
          description="请点击右上角'编辑'按钮配置 GitHub Token，否则无法同步 CI 数据"
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </Card>
  )

  // 同步配置 Tab 内容
  const syncConfigTabContent = (
    <Card
      title={
        <span>
          <SyncOutlined style={{ marginRight: 8 }} />
          同步配置
        </span>
      }
      loading={configLoading}
      extra={
        <Button size="small" icon={<EditOutlined />} onClick={handleOpenSyncConfig}>
          编辑
        </Button>
      }
    >
      <Descriptions
        column={{ xxl: 2, xl: 2, lg: 2, md: 2, sm: 2, xs: 1 }}
        bordered
        size="small"
        styles={{ label: { width: 160, fontWeight: 'normal' } }}
        style={{ tableLayout: 'fixed' }}
      >
        <Descriptions.Item label="前端刷新间隔">
          <Tag color="green">{config?.sync_config?.frontend_refresh_interval_minutes} 分钟</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="后端 GitHub 缓存过期时间">
          <Tag color="blue">{config?.sync_config?.github_cache_ttl_minutes} 分钟</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="说明" span={2}>
          <div>
            <Text type="secondary">前端页面自动刷新的间隔时间，设置为 0 禁用自动刷新</Text>
            <br />
            <Text type="secondary">后端 GitHub API 数据缓存过期时间，建议与前端刷新间隔保持一致</Text>
          </div>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )

  // 项目动态配置 Tab 内容
  const dailySummaryConfigTabContent = (
    <Card
      title={
        <span>
          <RobotOutlined style={{ marginRight: 8 }} />
          项目动态配置
        </span>
      }
      loading={dailySummaryConfigLoading}
      extra={
        <Button size="small" icon={<EditOutlined />} onClick={() => setIsDailySummaryConfigModalOpen(true)}>
          编辑
        </Button>
      }
    >
      <Descriptions
        column={{ xxl: 2, xl: 2, lg: 2, md: 2, sm: 2, xs: 1 }}
        bordered
        size="small"
        styles={{ label: { width: 160, fontWeight: 'normal' } }}
        style={{ tableLayout: 'fixed' }}
      >
        <Descriptions.Item label="定时任务状态">
          {dailySummaryConfig?.enabled ? (
            <Tag color="green" icon={<CheckCircleOutlined />}>已启用</Tag>
          ) : (
            <Tag color="default" icon={<CloseCircleOutlined />}>已禁用</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="执行时间">
          <Tag color="blue">
            每天 {dailySummaryConfig?.cron_hour || 8}:{(dailySummaryConfig?.cron_minute || 0).toString().padStart(2, '0')}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="时区">
          <Tag>{dailySummaryConfig?.timezone || 'Asia/Shanghai'}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="已配置 LLM 数量">
          <Tag color="cyan">{llmProviders?.filter((p: any) => p.api_key_configured).length || 0} / {llmProviders?.length || 0}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="已配置项目" span={2}>
          <Space wrap>
            {dailySummaryConfig?.projects?.map((p: any) => (
              <Tag key={p.id} color={p.enabled ? 'green' : 'default'}>
                {p.name} {p.enabled ? '✓' : '✗'}
              </Tag>
            ))}
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="说明" span={2}>
          <Text type="secondary">
            定时任务每天自动执行，生成项目动态总结；支持手动触发数据采集和总结生成
          </Text>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )

  // LLM 提供商配置 Tab 内容
  const llmProviderConfigTabContent = (
    <Card
      title={
        <span>
          <KeyOutlined style={{ marginRight: 8 }} />
          LLM 提供商配置
        </span>
      }
      loading={!llmProviders}
    >
      <Alert
        message="提示"
        description='LLM API Key 直接在此页面配置。请点击"编辑"按钮为各提供商配置 API Key 和显示名称。设置"激活状态"为 true 的提供商将用于 AI 每日总结生成。'
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Table
        dataSource={llmProviders || []}
        rowKey="provider"
        size="small"
        pagination={false}
        columns={[
          {
            title: '提供商',
            dataIndex: 'display_name',
            key: 'display_name',
            render: (text: string) => <Tag color="blue">{text}</Tag>,
          },
          {
            title: 'API Key',
            dataIndex: 'api_key_configured',
            key: 'api_key_configured',
            render: (configured: boolean) =>
              configured ? (
                <Tag color="green" icon={<CheckCircleOutlined />}>已配置</Tag>
              ) : (
                <Tag color="red" icon={<CloseCircleOutlined />}>未配置</Tag>
              ),
          },
          {
            title: '激活状态',
            dataIndex: 'is_active',
            key: 'is_active',
            render: (is_active: boolean) =>
              is_active ? (
                <Tag color="gold" icon={<CheckCircleOutlined />}>AI 总结使用</Tag>
              ) : (
                <Tag color="default">未激活</Tag>
              ),
          },
          {
            title: '默认模型',
            dataIndex: 'default_model',
            key: 'default_model',
            render: (text: string) => <Tag>{text}</Tag>,
          },
          {
            title: '操作',
            key: 'action',
            render: (_, record: any) => (
              <Button
                size="small"
                type="link"
                onClick={() => {
                  setSelectedLLMProvider(record.provider)
                  llmProviderForm.setFieldsValue({
                    is_active: record.is_active,
                    default_model: record.default_model,
                    display_name: record.display_name,
                    api_base_url: record.api_base_url || '',
                  })
                  setIsLLMProviderModalOpen(true)
                }}
              >
                编辑
              </Button>
            ),
          },
        ]}
      />
    </Card>
  )

  // 系统提示词配置 Tab 内容
  const systemPromptConfigTabContent = (
    <Card
      title={
        <span>
          <MessageOutlined style={{ marginRight: 8 }} />
          系统提示词配置
        </span>
      }
      loading={systemPromptConfigLoading}
      extra={
        <Button size="small" icon={<EditOutlined />} onClick={() => setIsSystemPromptModalOpen(true)}>
          编辑
        </Button>
      }
    >
      <Alert
        message="说明"
        description="系统提示词用于指导 AI 生成项目动态总结的风格和内容重点。不同项目可使用不同的提示词模板。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Collapse
        items={[
          {
            key: 'ascend',
            label: <Tag color="purple">vLLM Ascend 项目提示词</Tag>,
            children: (
              <div style={{ maxHeight: 200, overflow: 'auto' }}>
                <Text>{systemPromptConfig?.prompts?.ascend || '未配置'}</Text>
              </div>
            ),
          },
          {
            key: 'vllm',
            label: <Tag color="cyan">vLLM 项目提示词</Tag>,
            children: (
              <div style={{ maxHeight: 200, overflow: 'auto' }}>
                <Text>{systemPromptConfig?.prompts?.vllm || '未配置'}</Text>
              </div>
            ),
          },
          {
            key: 'combined',
            label: <Tag color="green">通用提示词模板</Tag>,
            children: (
              <div style={{ maxHeight: 200, overflow: 'auto' }}>
                <Text>{systemPromptConfig?.prompts?.combined || '未配置'}</Text>
              </div>
            ),
          },
        ]}
      />
    </Card>
  )

  const tabItems = [
    {
      key: 'system',
      label: (
        <Space>
          <InfoCircleOutlined />
          系统信息
        </Space>
      ),
      children: systemInfoTabContent,
    },
    {
      key: 'app',
      label: (
        <Space>
          <SettingOutlined />
          应用配置
        </Space>
      ),
      children: appConfigTabContent,
    },
    {
      key: 'github',
      label: (
        <Space>
          <GithubOutlined />
          GitHub 配置
        </Space>
      ),
      children: githubConfigTabContent,
    },
    {
      key: 'sync',
      label: (
        <Space>
          <SyncOutlined />
          同步配置
        </Space>
      ),
      children: syncConfigTabContent,
    },
    {
      key: 'daily_summary',
      label: (
        <Space>
          <RobotOutlined />
          项目动态配置
        </Space>
      ),
      children: dailySummaryConfigTabContent,
    },
    {
      key: 'llm_providers',
      label: (
        <Space>
          <KeyOutlined />
          LLM 提供商
        </Space>
      ),
      children: llmProviderConfigTabContent,
    },
    {
      key: 'system_prompt',
      label: (
        <Space>
          <MessageOutlined />
          系统提示词
        </Space>
      ),
      children: systemPromptConfigTabContent,
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, display: 'inline-block', marginRight: 16 }}>
          <SettingOutlined style={{ marginRight: 8 }} />
          系统配置
        </Title>
        <Text type="secondary">管理系统核心配置和同步设置</Text>
      </div>

      {/* 系统状态警告 */}
      {status && !status.scheduler.running && (
        <Alert
          message="警告：数据同步调度器未运行"
          description="请检查后端服务状态，数据同步将不会自动执行"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Tab 页 */}
      <Tabs
        activeKey={activeTabKey}
        onChange={setActiveTabKey}
        items={tabItems}
        className="stripe-page-tabs"
      />

      {/* 应用配置编辑弹窗 */}
      <Modal
        title="编辑应用配置"
        open={isAppConfigModalOpen}
        onCancel={() => {
          setIsAppConfigModalOpen(false)
          appConfigForm.resetFields()
        }}
        footer={null}
        width={500}
      >
        <Alert
          message="提示"
          description="配置修改将同时更新运行时配置和 .env 文件，无需重启服务"
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form
          form={appConfigForm}
          layout="vertical"
          onFinish={handleUpdateAppConfig}
        >
          <Form.Item
            name="log_level"
            label="日志级别"
            rules={[{ required: true, message: '请选择日志级别' }]}
          >
            <Select>
              <Select.Option value="DEBUG">DEBUG</Select.Option>
              <Select.Option value="INFO">INFO</Select.Option>
              <Select.Option value="WARNING">WARNING</Select.Option>
              <Select.Option value="ERROR">ERROR</Select.Option>
              <Select.Option value="CRITICAL">CRITICAL</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="debug"
            label="调试模式"
            valuePropName="checked"
          >
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setIsAppConfigModalOpen(false)
                appConfigForm.resetFields()
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={updateAppMutation.isPending}>
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* GitHub 配置编辑弹窗 */}
      <Modal
        title="编辑 GitHub 配置"
        open={isGitHubConfigModalOpen}
        onCancel={() => {
          setIsGitHubConfigModalOpen(false)
          gitHubConfigForm.resetFields()
        }}
        footer={null}
        width={500}
      >
        <Alert
          message="提示"
          description="配置修改将同时更新运行时配置和 .env 文件，无需重启服务"
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form
          form={gitHubConfigForm}
          layout="vertical"
          onFinish={handleUpdateGitHubConfig}
        >
          <Form.Item
            name="github_token"
            label="GitHub Token"
            rules={[
              { required: true, message: '请输入 GitHub Token' },
              { min: 10, message: 'GitHub Token 长度至少 10 个字符' },
            ]}
            extra="GitHub Token 用于访问 GitHub API，格式：ghp_xxxxxxxxxxxx"
          >
            <Input.Password placeholder="请输入新的 GitHub Token" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setIsGitHubConfigModalOpen(false)
                gitHubConfigForm.resetFields()
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={updateGitHubMutation.isPending}>
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 同步配置编辑弹窗 */}
      <Modal
        title="编辑同步配置"
        open={isSyncConfigModalOpen}
        onCancel={() => {
          setIsSyncConfigModalOpen(false)
          syncConfigForm.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Alert
          message="提示"
          description="配置修改将同时更新运行时配置和 .env 文件，无需重启服务"
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form
          form={syncConfigForm}
          layout="vertical"
          onFinish={handleUpdateSyncConfig}
        >
          <Form.Item
            name="frontend_refresh_interval_minutes"
            label="前端刷新间隔（分钟）"
            rules={[{ required: true, message: '请输入刷新间隔' }]}
            extra="前端页面自动刷新的间隔时间，范围 0-60 分钟，设置为 0 禁用自动刷新"
          >
            <InputNumber min={0} max={60} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="github_cache_ttl_minutes"
            label="后端 GitHub 缓存过期时间（分钟）"
            rules={[{ required: true, message: '请输入缓存过期时间' }]}
            extra="后端 GitHub API 数据缓存过期时间，范围 1-60 分钟，建议与前端刷新间隔保持一致"
          >
            <InputNumber min={1} max={60} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setIsSyncConfigModalOpen(false)
                syncConfigForm.resetFields()
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={updateSyncMutation.isPending}>
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 项目动态配置编辑弹窗 */}
      <Modal
        title="编辑项目动态配置"
        open={isDailySummaryConfigModalOpen}
        onCancel={() => {
          setIsDailySummaryConfigModalOpen(false)
          dailySummaryConfigForm.resetFields()
        }}
        footer={null}
        width={700}
      >
        <Alert
          message="提示"
          description="配置修改后将保存到数据库，定时任务配置需要重启服务生效"
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form
          form={dailySummaryConfigForm}
          layout="vertical"
          onFinish={(values) => {
            updateDailySummaryMutation.mutate({
              enabled: values.enabled,
              cron_hour: values.cron_hour,
              cron_minute: values.cron_minute,
              timezone: values.timezone,
              projects: values.projects,
            }, {
              onSuccess: () => {
                message.success('配置已更新')
                setIsDailySummaryConfigModalOpen(false)
              },
              onError: (error: any) => {
                message.error(error.response?.data?.detail || '更新失败')
              },
            })
          }}
          initialValues={{
            enabled: dailySummaryConfig?.enabled ?? true,
            cron_hour: dailySummaryConfig?.cron_hour ?? 8,
            cron_minute: dailySummaryConfig?.cron_minute ?? 0,
            timezone: dailySummaryConfig?.timezone ?? 'Asia/Shanghai',
            projects: dailySummaryConfig?.projects ?? [],
          }}
        >
          <Form.Item
            name="enabled"
            label="启用定时任务"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
          
          <Form.Item
            name="cron_hour"
            label="执行时间（时）"
            rules={[{ required: true, message: '请输入执行时间' }]}
          >
            <InputNumber min={0} max={23} style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="cron_minute"
            label="执行时间（分）"
            rules={[{ required: true, message: '请输入执行时间' }]}
          >
            <InputNumber min={0} max={59} style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="timezone"
            label="时区"
            rules={[{ required: true, message: '请选择时区' }]}
          >
            <Select>
              <Select.Option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</Select.Option>
              <Select.Option value="UTC">UTC</Select.Option>
              <Select.Option value="America/New_York">America/New_York</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* LLM 提供商编辑弹窗 */}
      <Modal
        title={`编辑 LLM 提供商 - ${selectedLLMProvider}`}
        open={isLLMProviderModalOpen}
        onCancel={() => {
          setIsLLMProviderModalOpen(false)
          setSelectedLLMProvider(null)
          llmProviderForm.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Alert
          message="提示"
          description='设置"激活状态"为 true 的提供商将用于 AI 每日总结生成。同一时间只能有一个提供商被激活。'
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        {selectedLLMProvider && (
          <Form
            form={llmProviderForm}
            layout="vertical"
            onFinish={(values) => {
              // 只有当用户输入了新的 API Key 时才发送，否则不发送该字段（保留原有值）
              const config: any = {
                is_active: values.is_active,
                default_model: values.default_model,
                display_name: values.display_name,
                api_base_url: values.api_base_url,
              }
              if (values.api_key && values.api_key.trim() !== '') {
                config.api_key = values.api_key
              }
              updateLLMProviderMutation.mutate({
                provider: selectedLLMProvider,
                config,
              }, {
                onSuccess: () => {
                  message.success('配置已更新')
                  setIsLLMProviderModalOpen(false)
                  setSelectedLLMProvider(null)
                },
                onError: (error: any) => {
                  message.error(error.response?.data?.detail || '更新失败')
                },
              })
            }}
          >
            <Form.Item
              name="is_active"
              label="激活状态（用于 AI 总结）"
              valuePropName="checked"
              extra="设置为激活后，该提供商将用于 AI 每日总结生成。同一时间只能有一个提供商被激活。"
            >
              <Switch checkedChildren="激活" unCheckedChildren="未激活" />
            </Form.Item>

            <Form.Item
              name="display_name"
              label="显示名称"
              rules={[{ required: true, message: '请输入显示名称' }]}
            >
              <Input placeholder="例如：OpenAI GPT-4, 通义千问" />
            </Form.Item>

            <Form.Item
              name="api_key"
              label="API Key"
              extra={
                <Space direction="vertical" size={0}>
                  <span>留空表示不修改，输入新的 API Key 将会覆盖原有配置。</span>
                  {llmProviders?.find((p: any) => p.provider === selectedLLMProvider)?.api_key_preview && (
                    <span style={{ color: '#1890ff', fontWeight: 500 }}>
                      已配置：{llmProviders.find((p: any) => p.provider === selectedLLMProvider)?.api_key_preview}
                    </span>
                  )}
                </Space>
              }
            >
              <Input.Password 
                placeholder="输入新的 API Key 以覆盖原有配置"
                autoComplete="new-password"
              />
            </Form.Item>

            <Form.Item
              name="default_model"
              label="默认模型"
              rules={[{ required: true, message: '请输入默认模型名称' }]}
            >
              <Input placeholder="例如：gpt-4o, claude-sonnet-4-20250514, qwen-plus" />
            </Form.Item>

            <Form.Item
              name="api_base_url"
              label="API Base URL"
            >
              <Input placeholder="例如：https://api.openai.com/v1" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={() => {
                  setIsLLMProviderModalOpen(false)
                  setSelectedLLMProvider(null)
                  llmProviderForm.resetFields()
                }}>
                  取消
                </Button>
                <Button type="primary" htmlType="submit" loading={updateLLMProviderMutation.isPending}>
                  保存
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* 系统提示词编辑弹窗 */}
      <Modal
        title="编辑系统提示词"
        open={isSystemPromptModalOpen}
        onCancel={() => {
          setIsSystemPromptModalOpen(false)
          systemPromptForm.resetFields()
        }}
        footer={null}
        width={800}
      >
        <Alert
          message="说明"
          description="系统提示词用于指导 AI 生成项目动态总结的风格和内容重点。修改后会对新生成的总结生效。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form
          form={systemPromptForm}
          layout="vertical"
          onFinish={(values) => {
            updateSystemPromptMutation.mutate({
              ascend: values.ascend,
              vllm: values.vllm,
              combined: values.combined,
            }, {
              onSuccess: () => {
                message.success('系统提示词已更新')
                setIsSystemPromptModalOpen(false)
              },
              onError: (error: any) => {
                message.error(error.response?.data?.detail || '更新失败')
              },
            })
          }}
          initialValues={{
            ascend: systemPromptConfig?.prompts?.ascend || '',
            vllm: systemPromptConfig?.prompts?.vllm || '',
            combined: systemPromptConfig?.prompts?.combined || '',
          }}
        >
          <Form.Item
            name="ascend"
            label={<Tag color="purple">vLLM Ascend 项目提示词</Tag>}
          >
            <Input.TextArea
              rows={6}
              placeholder="用于 vLLM Ascend 项目动态总结的系统提示词..."
            />
          </Form.Item>

          <Form.Item
            name="vllm"
            label={<Tag color="cyan">vLLM 项目提示词</Tag>}
          >
            <Input.TextArea
              rows={6}
              placeholder="用于 vLLM 项目动态总结的系统提示词..."
            />
          </Form.Item>

          <Form.Item
            name="combined"
            label={<Tag color="green">通用提示词模板</Tag>}
          >
            <Input.TextArea
              rows={6}
              placeholder="通用系统提示词模板..."
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setIsSystemPromptModalOpen(false)
                systemPromptForm.resetFields()
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={updateSystemPromptMutation.isPending}>
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SystemConfig
