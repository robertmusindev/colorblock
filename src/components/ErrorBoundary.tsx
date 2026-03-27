import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="w-full h-full min-h-[50vh] flex flex-col items-center justify-center bg-red-900 text-white p-8 rounded-2xl z-[99999] relative">
          <h2 className="text-3xl font-black mb-4">CRASH IN {this.props.name || 'APP'}</h2>
          <p className="text-red-200 mb-4">{this.state.error?.message}</p>
          <pre className="bg-red-950 p-4 rounded text-xs text-left max-w-full overflow-auto">
            {this.state.error?.stack}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 bg-white text-red-900 px-6 py-2 rounded-xl font-bold"
          >
            RICARICA
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
