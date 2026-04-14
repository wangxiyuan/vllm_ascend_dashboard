import { Modal, Table, Space, Typography, Tag, Card, Empty, Collapse, Descriptions } from 'antd'
import type { TableColumnsType } from 'antd'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { ModelComparisonResponse } from '../types/models'
import dayjs from 'dayjs'
import './Modal.css'

const { Text } = Typography

interface ModelCompareModalProps {
  visible: boolean
  comparisonData: ModelComparisonResponse | null
  onClose: () => void
}

/**
 * 报告对比弹窗组件
 * 展示两个报告的指标对比和雷达图
 */
export function ModelCompareModal({
  visible,
  comparisonData,
  onClose,
}: ModelCompareModalProps) {
  if (!comparisonData) return null

  const { reports, changes, tasks_comparison } = comparisonData

  // 智能格式化数值（不强制百分比）
  const formatValue = (value: any) => {
    if (value === null || value === undefined) return '-'
    if (typeof value !== 'number') return String(value)
    // 大数值使用 K/M 单位
    if (value >= 1000000) return (value / 1000000).toFixed(2) + 'M'
    if (value >= 1000) return (value / 1000).toFixed(2) + 'K'
    // 0-1 范围的值显示为百分比
    if (value >= 0 && value <= 1) return (value * 100).toFixed(2) + '%'
    // 其他数值直接显示
    return Number(value.toFixed(4)).toLocaleString()
  }

  // 准备雷达图数据
  const radarData = Object.entries(changes).map(([key, change]) => {
    const point: any = { metric: key }
    if (change.baseline !== null && change.baseline !== undefined) {
      point.baseline = typeof change.baseline === 'number' ? change.baseline * 100 : change.baseline
    }
    if (change.current !== null && change.current !== undefined) {
      point.current = typeof change.current === 'number' ? change.current * 100 : change.current
    }
    return point
  })

  // 对比表格列
  const columns: TableColumnsType<{ key: string; baseline: any; current: any; absolute_change: number | null; percent_change: number | null }> = [
    {
      title: '指标名称',
      dataIndex: 'key',
      key: 'key',
      width: 250,
      fixed: 'left',
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: '基准值',
      dataIndex: 'baseline',
      key: 'baseline',
      width: 120,
      render: (value: any) => formatValue(value),
    },
    {
      title: '当前值',
      dataIndex: 'current',
      key: 'current',
      width: 120,
      render: (value: any) => formatValue(value),
    },
    {
      title: '绝对变化',
      dataIndex: 'absolute_change',
      key: 'absolute_change',
      width: 120,
      render: (value: any) => {
        if (value === null || value === undefined) return '-'
        const color = value >= 0 ? '#3f8600' : '#cf1322'
        return (
          <Text style={{ color }}>
            {value >= 0 ? '+' : ''}{Number(value.toFixed(4)).toLocaleString()}
          </Text>
        )
      },
    },
    {
      title: '百分比变化',
      dataIndex: 'percent_change',
      key: 'percent_change',
      width: 120,
      render: (value: any) => {
        if (value === null || value === undefined) return '-'
        const color = value >= 0 ? '#3f8600' : '#cf1322'
        return (
          <Text style={{ color }}>
            {value >= 0 ? '+' : ''}{value.toFixed(2)}%
          </Text>
        )
      },
    },
  ]

  // 表格数据
  const tableData = Object.entries(changes).map(([key, change]) => ({
    key,
    ...change,
  }))

  return (
    <Modal
      title="报告对比"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1200}
      className="stripe-modal"
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 报告基本信息 */}
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Card size="small" style={{ flex: 1 }}>
            <Space direction="vertical" size="small">
              <Text strong>基准报告</Text>
              <div>
                <Tag color={reports[0]?.pass_fail === 'pass' ? 'green' : 'red'}>
                  {reports[0]?.pass_fail === 'pass' ? '通过' : '未通过'}
                </Tag>
              </div>
              <Text type="secondary">时间：{dayjs(reports[0]?.created_at).format('YYYY-MM-DD HH:mm:ss')}</Text>
              {reports[0]?.vllm_version && (
                <Tag color="blue">vLLM {reports[0].vllm_version}</Tag>
              )}
              {reports[0]?.dtype && (
                <Tag color="orange">权重 {reports[0].dtype}</Tag>
              )}
              {reports[0]?.report_json?.['vllm_ascend_version'] && (
                <Tag color="cyan">Ascend {reports[0].report_json['vllm_ascend_version']}</Tag>
              )}
              {reports[0]?.hardware && (
                <Tag color="purple">{reports[0].hardware}</Tag>
              )}
              {reports[0]?.features && reports[0].features.length > 0 && (
                <Space wrap size={4}>
                  {reports[0].features.map((f: string, i: number) => (
                    <Tag key={i} color="cyan">{f}</Tag>
                  ))}
                </Space>
              )}
            </Space>
          </Card>

          <div style={{ fontSize: 24, color: '#999' }}>VS</div>

          <Card size="small" style={{ flex: 1 }}>
            <Space direction="vertical" size="small">
              <Text strong>当前报告</Text>
              <div>
                <Tag color={reports[1]?.pass_fail === 'pass' ? 'green' : 'red'}>
                  {reports[1]?.pass_fail === 'pass' ? '通过' : '未通过'}
                </Tag>
              </div>
              <Text type="secondary">时间：{dayjs(reports[1]?.created_at).format('YYYY-MM-DD HH:mm:ss')}</Text>
              {reports[1]?.vllm_version && (
                <Tag color="blue">vLLM {reports[1].vllm_version}</Tag>
              )}
              {reports[1]?.dtype && (
                <Tag color="orange">权重 {reports[1].dtype}</Tag>
              )}
              {reports[1]?.report_json?.['vllm_ascend_version'] && (
                <Tag color="cyan">Ascend {reports[1].report_json['vllm_ascend_version']}</Tag>
              )}
              {reports[1]?.hardware && (
                <Tag color="purple">{reports[1].hardware}</Tag>
              )}
              {reports[1]?.features && reports[1].features.length > 0 && (
                <Space wrap size={4}>
                  {reports[1].features.map((f: string, i: number) => (
                    <Tag key={i} color="cyan">{f}</Tag>
                  ))}
                </Space>
              )}
            </Space>
          </Card>
        </Space>

        {/* 雷达图 */}
        <Card title="指标对比雷达图">
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Radar
                  name="基准"
                  dataKey="baseline"
                  stroke="#1890ff"
                  fill="#1890ff"
                  fillOpacity={0.3}
                />
                <Radar
                  name="当前"
                  dataKey="current"
                  stroke="#2fc25b"
                  fill="#2fc25b"
                  fillOpacity={0.3}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <Empty description="无对比数据" />
          )}
        </Card>

        {/* 详细对比表格 */}
        <Card title="详细对比数据">
          <Table
            columns={columns}
            dataSource={tableData}
            rowKey="key"
            pagination={false}
            scroll={{ x: 800, y: 400 }}
            size="small"
          />
        </Card>

        {/* Task 级别对比（新模板） */}
        {tasks_comparison && tasks_comparison.length > 0 && (
          <Card title="Task 级别对比">
            <Collapse
              defaultActiveKey={[]}
              expandIconPosition="end"
              items={tasks_comparison.map((task, index) => ({
                key: index,
                label: (
                  <Space>
                    <Text strong>{task.name}</Text>
                    {task.only_in_baseline && (
                      <Tag color="orange">仅基准</Tag>
                    )}
                    {task.only_in_current && (
                      <Tag color="cyan">仅当前</Tag>
                    )}
                    {task.is_common && (
                      <Space size="small">
                        <Tag color={task.baseline.pass_fail === 'pass' ? 'green' : 'red'}>
                          基准：{task.baseline.pass_fail}
                        </Tag>
                        <Tag color={task.current.pass_fail === 'pass' ? 'green' : 'red'}>
                          当前：{task.current.pass_fail}
                        </Tag>
                      </Space>
                    )}
                  </Space>
                ),
                children: (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    {/* 测试输入参数对比 */}
                    {(Object.keys(task.baseline.test_input || {}).length > 0 || 
                      Object.keys(task.current.test_input || {}).length > 0) && (
                      <Card title="测试输入参数" size="small" type="inner">
                        <Descriptions column={3} size="small" bordered>
                          {Object.entries(task.baseline.test_input || {}).map(([key, value]) => (
                            <Descriptions.Item key={`b-${key}`} label={`基准-${key}`}>
                              {typeof value === 'number' ? value.toFixed(2) : String(value)}
                            </Descriptions.Item>
                          ))}
                          {Object.entries(task.current.test_input || {}).map(([key, value]) => (
                            <Descriptions.Item key={`c-${key}`} label={`当前-${key}`}>
                              {typeof value === 'number' ? value.toFixed(2) : String(value)}
                            </Descriptions.Item>
                          ))}
                        </Descriptions>
                      </Card>
                    )}

                    {/* 目标阈值对比 */}
                    {(Object.keys(task.baseline.target || {}).length > 0 || 
                      Object.keys(task.current.target || {}).length > 0) && (
                      <Card title="目标阈值" size="small" type="inner">
                        <Descriptions column={3} size="small" bordered>
                          {Object.entries(task.baseline.target || {}).map(([key, value]) => (
                            <Descriptions.Item key={`b-${key}`} label={`基准-${key}`}>
                              {typeof value === 'number' ? value.toFixed(4) : String(value)}
                            </Descriptions.Item>
                          ))}
                          {Object.entries(task.current.target || {}).map(([key, value]) => (
                            <Descriptions.Item key={`c-${key}`} label={`当前-${key}`}>
                              {typeof value === 'number' ? value.toFixed(4) : String(value)}
                            </Descriptions.Item>
                          ))}
                        </Descriptions>
                      </Card>
                    )}

                    {/* Task 指标对比表格 */}
                    {Object.keys(task.changes).length > 0 && (
                      <Table
                        size="small"
                        pagination={false}
                        dataSource={Object.entries(task.changes).map(([key, change]) => ({
                          key,
                          metric: key,
                          baseline: change.baseline,
                          current: change.current,
                          absolute_change: change.absolute_change,
                          percent_change: change.percent_change,
                        }))}
                        columns={[
                          {
                            title: '指标名称',
                            dataIndex: 'metric',
                            key: 'metric',
                            width: 200,
                            render: (text: string) => <Text code>{text}</Text>,
                          },
                          {
                            title: '基准值',
                            dataIndex: 'baseline',
                            key: 'baseline',
                            width: 100,
                            render: (value: any) => formatValue(value),
                          },
                          {
                            title: '当前值',
                            dataIndex: 'current',
                            key: 'current',
                            width: 100,
                            render: (value: any) => formatValue(value),
                          },
                          {
                            title: '绝对变化',
                            dataIndex: 'absolute_change',
                            key: 'absolute_change',
                            width: 100,
                            render: (value: any) => {
                              if (value === null || value === undefined) return '-'
                              const color = value >= 0 ? '#3f8600' : '#cf1322'
                              return (
                                <Text style={{ color }}>
                                  {value >= 0 ? '+' : ''}{Number(value.toFixed(4)).toLocaleString()}
                                </Text>
                              )
                            },
                          },
                        ]}
                        scroll={{ x: 600 }}
                      />
                    )}
                  </Space>
                ),
              }))}
            />
          </Card>
        )}
      </Space>
    </Modal>
  )
}
