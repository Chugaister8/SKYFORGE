"use client";
import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children:  React.ReactNode;
  fallback?: React.ReactNode;
  context?:  string;
}

interface State {
  hasError: boolean;
  error:    Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.context ?? "unknown"}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 bg-bg-base">
          <div className="flex items-center gap-3 text-threat-medium">
            <AlertTriangle className="w-8 h-8" strokeWidth={1.5} />
            <div>
              <p className="font-mono text-sm font-medium text-text-primary">
                Component Error
              </p>
              <p className="font-mono text-xs text-text-secondary mt-0.5">
                {this.props.context && `[${this.props.context}] `}
                {this.state.error?.message ?? "Unknown error"}
              </p>
            </div>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-1.5 px-4 py-2 rounded border border-border-dim text-text-secondary hover:text-text-primary hover:border-border-active font-mono text-xs transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Convenience wrapper for specific components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  context: string,
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary context={context}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
