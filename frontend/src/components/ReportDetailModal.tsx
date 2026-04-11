import { Modal, Descriptions, Tag, Space, Typography, Collapse, Table, Card, Alert } from 'antd'
import type { ModelReport, TaskReport } from '../types/models'
import { CodeOutlined, EnvironmentOutlined, SettingOutlined } from '@ant-design/icons'
import './Modal.css'

const { Text, Paragraph, Title } = Typography

interface ReportDetailModalProps {
  visible: boolean
  report: ModelReport | null
  onClose: () => void
}

/**
 * 报告详情弹窗组件 - 支持新模板
 */
export function ReportDetailModal({
  visible,
  report,
  onClose,
}: ReportDetailModalProps) {
  if (!report) return null

  // 部署类型判断
  const deployType = report.serve_cmd?.mix ? 'mix' : report.serve_cmd?.pd ? 'pd' : null

  return (
    <Modal
      title={`报告详情 #${report.id}`}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1000}
      className="stripe-modal"
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 基本信息 */}
        <div>
          <Title level={5}>基本信息</Title>
          <Descriptions column={3} bordered size="small">
            <Descriptions.Item label="报告时间">
              {new Date(report.created_at).toLocaleString('zh-CN')}
            </Descriptions.Item>
            <Descriptions.Item label="Workflow Run ID">
              {report.workflow_run_id || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Pass/Fail 状态">
              <Tag color={report.pass_fail === 'pass' ? 'green' : 'red'}>
                {report.pass_fail === 'pass' ? '通过' : '未通过'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="vLLM 版本">
              {report.vllm_version || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="硬件类型">
              {report.hardware || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="权重类型">
              {report.dtype ? <Tag color="blue">{report.dtype}</Tag> : '-'}
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* 特性列表 */}
        {report.features && report.features.length > 0 && (
          <div>
            <Title level={5}>特性列表</Title>
            <Space wrap>
              {report.features.map((feature, index) => (
                <Tag key={index} color="cyan">{feature}</Tag>
              ))}
            </Space>
          </div>
        )}

        {/* 部署命令与环境变量 */}
        {(report.serve_cmd || report.environment) && (
          <div>
            <Title level={5}>
              <SettingOutlined /> 部署配置
            </Title>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {/* 部署类型 */}
              {deployType && (
                <Alert
                  message={`部署模式：${deployType === 'mix' ? '标准部署 (Mix)' : 'PD 分离部署'}`}
                  type="info"
                  showIcon
                />
              )}

              {/* 启动命令 */}
              {report.serve_cmd && (
                <Card title="启动命令" size="small" type="inner">
                  {deployType === 'mix' && report.serve_cmd.mix && (
                    <Paragraph
                      code
                      copyable={{ text: report.serve_cmd.mix }}
                      style={{ marginBottom: 0, fontFamily: 'monospace' }}
                    >
                      {report.serve_cmd.mix}
                    </Paragraph>
                  )}
                  {deployType === 'pd' && report.serve_cmd.pd && (
                    <Descriptions column={1} size="small">
                      {Object.entries(report.serve_cmd.pd).map(([key, cmd]) => (
                        <Descriptions.Item key={key} label={key}>
                          <Paragraph
                            code
                            copyable={{ text: cmd as string }}
                            style={{ marginBottom: 0, fontFamily: 'monospace' }}
                          >
                            {cmd as string}
                          </Paragraph>
                        </Descriptions.Item>
                      ))}
                    </Descriptions>
                  )}
                </Card>
              )}

              {/* 环境变量 */}
              {report.environment && Object.keys(report.environment).length > 0 && (
                <Card title={<><EnvironmentOutlined /> 环境变量</>} size="small" type="inner">
                  <Descriptions column={2} size="small">
                    {Object.entries(report.environment).map(([key, value]) => (
                      <Descriptions.Item key={key} label={key}>
                        <Text code>{value as string}</Text>
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                </Card>
              )}
            </Space>
          </div>
        )}

        {/* 测试任务详情 */}
        {report.tasks && report.tasks.length > 0 && (
          <div>
            <Title level={5}><CodeOutlined /> 测试任务详情 ({report.tasks.length})</Title>
            <Collapse
              defaultActiveKey={[]}
              expandIconPosition="end"
              items={report.tasks.map((task, index) => (
                {
                  key: index,
                  label: (
                    <Space>
                      <Tag color={task.pass_fail === 'pass' ? 'green' : 'red'}>
                        {task.pass_fail === 'pass' ? '✓' : '✗'}
                      </Tag>
                      <Text strong>{task.name}</Text>
                    </Space>
                  ),
                  children: (
                    <TaskDetail task={task} />
                  ),
                }
              ))}
            />
          </div>
        )}
      </Space>
    </Modal>
  )
}

/**
 * Task 详情子组件
 */
function TaskDetail({ task }: { task: TaskReport }) {
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {/* 测试输入参数 */}
      {task.test_input && Object.keys(task.test_input).length > 0 && (
        <Card title="测试输入参数" size="small" type="inner">
          <Descriptions column={3} size="small">
            {Object.entries(task.test_input).map(([key, value]) => (
              <Descriptions.Item key={key} label={key}>
                {typeof value === 'number' ? value.toFixed(2) : String(value)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </Card>
      )}

      {/* 目标阈值 */}
      {task.target && Object.keys(task.target).length > 0 && (
        <Card title="目标阈值" size="small" type="inner">
          <Descriptions column={2} size="small">
            {Object.entries(task.target).map(([key, value]) => (
              <Descriptions.Item key={key} label={key}>
                {typeof value === 'number' ? value.toFixed(4) : String(value)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </Card>
      )}

      {/* Metrics */}
      {task.metrics && Object.keys(task.metrics).length > 0 && (
        <Card title="性能指标" size="small" type="inner">
          <Table
            size="small"
            pagination={false}
            dataSource={Object.entries(task.metrics).map(([key, value]) => ({
              key,
              metric: key,
              value: typeof value === 'number' ? value.toFixed(4) : String(value),
            }))}
            columns={[
              {
                title: '指标名称',
                dataIndex: 'metric',
                key: 'metric',
                render: (text: string) => <Text code>{text}</Text>,
              },
              {
                title: '值',
                dataIndex: 'value',
                key: 'value',
                align: 'right',
              },
            ]}
          />
        </Card>
      )}
    </Space>
  )
}
