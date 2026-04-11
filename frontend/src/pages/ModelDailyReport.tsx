import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Row, Col, Statistic, Tag, Typography, Space, Button, message, DatePicker } from 'antd'
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExperimentOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import dayjs from 'dayjs'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const { Title, Text } = Typography

interface ModelResult {
  model_id: number
  model_name: string
  series: string | null
  total_reports: number
  success_reports: number
  failure_reports: number
  latest_report: {
    report_id: number
    status: string | null
    accuracy: number | null
    throughput: number | null
    first_token_latency: number | null
    created_at: string | null
    github_html_url: string | null
  } | null
}

interface ModelDailyReport {
  date: string
  summary: {
    total_reports: number
    success_reports: number
    failure_reports: number
    success_rate: number
  }
  model_results: ModelResult[]
  markdown_report: string
}

function ModelDailyReport() {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'))

  // 获取每日报告
  const { data: report, isLoading } = useQuery<ModelDailyReport>({
    queryKey: ['model-daily-report', selectedDate],
    queryFn: async () => {
      const response = await api.get<ModelDailyReport>(`/models/reports/daily/${selectedDate}`)
      return response.data
    },
  })

  // 处理导出 Markdown
  const handleExportMarkdown = () => {
    if (!report?.markdown_report) {
      message.warning('暂无报告内容可导出')
      return
    }

    const blob = new Blob([report.markdown_report], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Model_Daily_Report_${selectedDate}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    message.success('报告已导出')
  }

  // 处理模型卡片点击
  const handleModelCardClick = (modelId: number) => {
    navigate(`/models/${modelId}`)
  }

  return (
    <div style={{ padding: 24 }}>
      {/* 顶部导航 */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/')}
        >
          返回主页
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          <ExperimentOutlined style={{ color: '#722ed1', marginRight: 8 }} />
          模型每日报告
        </Title>
        <Space style={{ marginLeft: 'auto' }}>
          <DatePicker
            value={dayjs(selectedDate)}
            onChange={(date) => {
              if (date) {
                setSelectedDate(date.format('YYYY-MM-DD'))
              }
            }}
            style={{ width: 150 }}
          />
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportMarkdown}
            disabled={!report?.markdown_report}
          >
            导出 Markdown
          </Button>
        </Space>
      </div>

      {isLoading ? (
        <Row gutter={16}>
          {[1, 2, 3, 4].map((i) => (
            <Col span={6} key={i}>
              <Card><div style={{ height: 200 }} /></Card>
            </Col>
          ))}
        </Row>
      ) : report ? (
        <>
          {/* 统计卡片 */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总报告数"
                  value={report.summary.total_reports}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="成功"
                  value={report.summary.success_reports}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="失败"
                  value={report.summary.failure_reports}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="成功率"
                  value={`${report.summary.success_rate}%`}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 模型结果卡片 */}
          <Card
            title="模型详情"
            style={{ marginBottom: 24 }}
          >
            {report.model_results && report.model_results.length > 0 ? (
              <Row gutter={[16, 16]}>
                {report.model_results.map((model) => {
                  const latest = model.latest_report
                  const getAccentColor = () => {
                    if (latest?.status === 'success') return '#52c41a'
                    if (latest?.status === 'failure') return '#ff4d4f'
                    return '#d9d9d9'
                  }

                  return (
                    <Col span={6} key={model.model_id}>
                      <Card
                        hoverable
                        size="small"
                        style={{
                          height: '100%',
                          cursor: latest ? 'pointer' : 'default',
                          borderTop: `3px solid ${getAccentColor()}`,
                        }}
                        onClick={() => latest && handleModelCardClick(model.model_id)}
                      >
                        <div style={{ marginBottom: 12 }}>
                          <Text strong style={{ fontSize: 15 }}>{model.model_name}</Text>
                          {model.series && (
                            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                              系列：{model.series}
                            </div>
                          )}
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ fontSize: 12, color: '#8c8c8c' }}>状态</div>
                            {latest?.status === 'success' && (
                              <Tag color="success" icon={<CheckCircleOutlined />}>成功</Tag>
                            )}
                            {latest?.status === 'failure' && (
                              <Tag color="error" icon={<CloseCircleOutlined />}>失败</Tag>
                            )}
                            {!latest && (
                              <Tag>暂无报告</Tag>
                            )}
                          </div>

                          {latest?.accuracy !== null && latest?.accuracy !== undefined && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <div style={{ fontSize: 12, color: '#8c8c8c' }}>准确率</div>
                              <Text strong>{(latest.accuracy * 100).toFixed(2)}%</Text>
                            </div>
                          )}
                          {latest?.throughput !== null && latest?.throughput !== undefined && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <div style={{ fontSize: 12, color: '#8c8c8c' }}>吞吐量</div>
                              <Text strong>{latest.throughput.toFixed(2)} tok/s</Text>
                            </div>
                          )}
                          {latest?.first_token_latency !== null && latest?.first_token_latency !== undefined && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <div style={{ fontSize: 12, color: '#8c8c8c' }}>首 Token 延迟</div>
                              <Text strong>{latest.first_token_latency.toFixed(2)} ms</Text>
                            </div>
                          )}
                        </div>

                        {latest?.created_at && (
                          <div style={{ fontSize: 11, color: '#bfbfbf' }}>
                            运行时间：{dayjs(latest.created_at).format('MM-DD HH:mm')}
                          </div>
                        )}
                      </Card>
                    </Col>
                  )
                })}
              </Row>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无模型报告数据
              </div>
            )}
          </Card>

          {/* Markdown 报告 */}
          {report.markdown_report && (
            <Card title="Markdown 报告">
              <div style={{ maxHeight: 600, overflow: 'auto' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {report.markdown_report}
                </ReactMarkdown>
              </div>
            </Card>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          暂无报告数据
        </div>
      )}
    </div>
  )
}

export default ModelDailyReport
