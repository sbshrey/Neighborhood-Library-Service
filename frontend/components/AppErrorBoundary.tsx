"use client";

import { ErrorInfo } from "react";
import React from "react";

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export default class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "Unexpected UI error",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("AppErrorBoundary caught an error", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error-shell">
          <section className="app-error-card">
            <div className="badge">Error</div>
            <h1>Something went wrong</h1>
            <p className="lede">
              The page crashed unexpectedly. Retry the view or reload the application.
            </p>
            {this.state.message ? <p className="notice">{this.state.message}</p> : null}
            <div className="row-actions">
              <button type="button" onClick={this.handleRetry}>
                Retry
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
