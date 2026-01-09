import React, { Component, ReactNode } from 'react';
import { ErrorState } from './ErrorStates';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary - React Error Boundary
 *
 * 컴포넌트 트리 어디서든 발생하는 JavaScript 에러를 포착하고
 * 에러 UI를 표시합니다.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);

    // 여기에 에러 추적 서비스 연동 가능 (예: Sentry)
    // trackError(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload(); // 페이지 새로고침으로 복구 시도
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
          <div className="max-w-md w-full">
            <ErrorState
              type="general"
              title="문제가 발생했습니다"
              message={
                this.state.error?.message ||
                '알 수 없는 오류가 발생했습니다. 페이지를 새로고침해주세요.'
              }
              action={this.handleReset}
              actionText="새로고침"
            />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
