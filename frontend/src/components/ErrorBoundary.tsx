import { Component, ErrorInfo, ReactNode } from 'react'
import { Result, Button, Typography } from 'antd'

const { Text } = Typography

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Result
          status="500"
          title="页面发生错误"
          subTitle="抱歉，页面发生错误。请尝试刷新页面或联系管理员。"
          extra={
            <Button
              type="primary"
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null })
                window.location.reload()
              }}
            >
              刷新页面
            </Button>
          }
        />
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
