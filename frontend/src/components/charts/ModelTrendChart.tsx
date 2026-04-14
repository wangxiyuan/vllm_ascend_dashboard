import { Card, Empty, Tabs, Tag, Space, Typography, Checkbox } from 'antd'
import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { ModelTrendData } from '../../types/models'

const { Text } = Typography

interface ModelTrendChartProps {
  data: ModelTrendData[]
  height?: number
}

/**
 * 计算 Y 轴的合理范围
 */
const calculateYAxisDomain = (values: (number | string)[]) => {
  const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v)) as number[]
  if (numericValues.length === 0) return [0, 100]
  
  const minValue = Math.min(...numericValues)
  const maxValue = Math.max(...numericValues)
  const padding = (maxValue - minValue) * 0.1 || 10
  
  return [
    Math.max(0, minValue - padding),
    maxValue + padding
  ]
}

/**
 * 判断是否需要百分比格式化
 */
const isPercentage = (values: (number | string)[]) => {
  return values.every(v => typeof v === 'number' && v >= 0 && v <= 1)
}

/**
 * 单个 Task 的趋势图组件（多个指标用不同折线表示）
 * 支持按指标选择过滤
 */
function TaskTrendChart({
  taskName,
  metrics,
  data,
  height,
  colorIndex
}: {
  taskName: string
  metrics: string[]
  data: any[]
  height: number
  colorIndex: number
}) {
  // 颜色映射（为每个指标分配不同颜色）
  const colors = [
    '#1890ff', '#2fc25b', '#facc14', '#f04864', '#8543e0',
    '#13c2c2', '#fa8c16', '#a0d911', '#fa541c', '#722ed1',
  ]

  // 计算所有指标的 Y 轴范围
  const allValues = metrics.flatMap(metricKey =>
    data.map(d => {
      const key = `${taskName}.${metricKey}`
      return d[key]
    }).filter(v => typeof v === 'number' && !isNaN(v))
  )
  const yAxisDomain = calculateYAxisDomain(allValues)

  // 状态：控制哪些指标显示
  const [visibleMetrics, setVisibleMetrics] = useState<Set<string>>(
    () => new Set(metrics)  // 默认显示所有指标
  )

  const toggleMetric = (metricKey: string) => {
    const newSet = new Set(visibleMetrics)
    if (newSet.has(metricKey)) {
      newSet.delete(metricKey)
    } else {
      newSet.add(metricKey)
    }
    setVisibleMetrics(newSet)
  }

  // 全选/取消全选
  const toggleAllMetrics = (checked: boolean) => {
    if (checked) {
      setVisibleMetrics(new Set(metrics))
    } else {
      setVisibleMetrics(new Set())
    }
  }

  return (
    <Card
      size="small"
      style={{ marginBottom: 16 }}
      title={
        <Space>
          <Text strong>{taskName}</Text>
          <Tag color={colors[colorIndex % colors.length]}>
            {visibleMetrics.size}/{metrics.length} 个指标
          </Tag>
        </Space>
      }
      extra={
        <Space size="small">
          <Checkbox
            checked={visibleMetrics.size === metrics.length}
            indeterminate={visibleMetrics.size > 0 && visibleMetrics.size < metrics.length}
            onChange={(e) => toggleAllMetrics(e.target.checked)}
          >
            全选
          </Checkbox>
          <Text type="secondary" style={{ fontSize: 12 }}>
            点击图例可隐藏/显示单个指标
          </Text>
        </Space>
      }
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            label={{ value: '日期', position: 'insideBottom', offset: -5 }}
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            domain={yAxisDomain}
            label={{ 
              value: '数值', 
              angle: -90, 
              position: 'insideLeft',
              offset: 0
            }}
            tickFormatter={(value) => {
              if (typeof value === 'number') {
                if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M'
                if (value >= 1000) return (value / 1000).toFixed(1) + 'K'
                return value.toFixed(0)
              }
              return String(value)
            }}
          />
          <Tooltip
            formatter={(value: any, name: string) => {
              if (typeof value === 'number') {
                if (value >= 1000000) return [(value / 1000000).toFixed(2) + 'M', name]
                if (value >= 1000) return [(value / 1000).toFixed(2) + 'K', name]
                return [Number(value.toFixed(4)).toLocaleString(), name]
              }
              return [String(value), name]
            }}
            labelFormatter={(label) => `日期：${label}`}
          />
          <Legend
            // 使用自定义图例渲染来完全控制点击行为
            content={({ payload }: any) => {
              if (!payload || !Array.isArray(payload)) {
                return null
              }
              return (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {payload.map((entry: any, index: number) => {
                    // entry.dataKey 是完整的 taskName.metricKey 格式
                    const fullKey = entry.dataKey as string
                    // 提取原始的 metricKey（去掉 taskName 前缀）
                    const metricKey = fullKey.includes('.') ? fullKey.split('.').pop()! : fullKey
                    const isVisible = visibleMetrics.has(metricKey)
                    return (
                      <li
                        key={`item-${index}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'pointer',
                          opacity: isVisible ? 1 : 0.5,
                        }}
                        onClick={() => toggleMetric(metricKey)}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            width: 10,
                            height: 10,
                            backgroundColor: entry.color,
                            marginRight: 4,
                            borderRadius: 2,
                          }}
                        />
                        <span style={{ color: isVisible ? '#333' : '#999' }}>{entry.value}</span>
                      </li>
                    )
                  })}
                </ul>
              )
            }}
          />
          {metrics.map((metricKey, index) => {
            const fullKey = `${taskName}.${metricKey}`
            const color = colors[(colorIndex + index) % colors.length]
            const isVisible = visibleMetrics.has(metricKey)
            
            return (
              <Line
                key={metricKey}
                type="monotone"
                dataKey={fullKey}
                name={metricKey}
                stroke={color}
                strokeWidth={isVisible ? 2 : 0}
                dot={{ r: isVisible ? 3 : 0 }}
                activeDot={{ r: 5 }}
                connectNulls
                hide={!isVisible}
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}

/**
 * 模型趋势图表组件 - 按 Task 分组 Tab 展示
 * 展示所有指标随时间的变化趋势
 */
export function ModelTrendChart({
  data,
  height = 250,
}: ModelTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card title="指标趋势">
        <Empty description="暂无趋势数据" />
      </Card>
    )
  }

  // 提取所有 task 和指标
  const taskMetricsMap = new Map<string, Map<string, any[]>>()
  
  data.forEach(item => {
    // 处理 tasks 中的指标
    if (item.tasks && Array.isArray(item.tasks)) {
      item.tasks.forEach((task: any) => {
        if (task.name && task.metrics) {
          if (!taskMetricsMap.has(task.name)) {
            taskMetricsMap.set(task.name, new Map())
          }
          const taskMap = taskMetricsMap.get(task.name)!
          Object.entries(task.metrics).forEach(([key, value]) => {
            if (!taskMap.has(key)) {
              taskMap.set(key, [])
            }
          })
        }
      })
    }
  })

  // 转换数据格式
  const chartData = data.map((item) => {
    const point: any = {
      date: item.date,
      pass_fail: item.pass_fail,
    }
    
    // 扁平化 metrics
    if (item.metrics) {
      Object.entries(item.metrics).forEach(([key, value]) => {
        point[key] = value
      })
    }
    
    // Task 指标：taskName.metricKey
    if (item.tasks && Array.isArray(item.tasks)) {
      item.tasks.forEach((task: any) => {
        if (task.name && task.metrics) {
          Object.entries(task.metrics).forEach(([key, value]) => {
            const taskMetricKey = `${task.name}.${key}`
            point[taskMetricKey] = value
          })
        }
      })
    }
    
    return point
  })

  // 颜色映射
  const colors = [
    '#1890ff', '#2fc25b', '#facc14', '#f04864', '#8543e0',
    '#13c2c2', '#fa8c16', '#a0d911', '#fa541c', '#722ed1',
  ]

  // 生成 Tab 项目
  const tabItems = Array.from(taskMetricsMap.entries()).map(([taskName, metrics], taskIndex) => {
    const metricKeys = Array.from(metrics.keys())
    
    return {
      key: taskName,
      label: (
        <Space>
          <Text strong>{taskName}</Text>
          <Tag color={colors[taskIndex % colors.length]}>
            {metricKeys.length} 个指标
          </Tag>
        </Space>
      ),
      children: (
        <TaskTrendChart
          taskName={taskName}
          metrics={metricKeys}
          data={chartData}
          height={height}
          colorIndex={taskIndex}
        />
      ),
    }
  })

  // 如果没有 task 数据，使用扁平化的所有指标（合并到一个图表）
  if (tabItems.length === 0) {
    const allMetricKeys = new Set<string>()
    data.forEach(item => {
      if (item.metrics) {
        Object.keys(item.metrics).forEach(key => allMetricKeys.add(key))
      }
    })

    return (
      <TaskTrendChart
        taskName="全部指标"
        metrics={Array.from(allMetricKeys)}
        data={chartData}
        height={height}
        colorIndex={0}
      />
    )
  }

  return (
    <Tabs
      defaultActiveKey={tabItems[0]?.key}
      items={tabItems}
      type="card"
    />
  )
}
