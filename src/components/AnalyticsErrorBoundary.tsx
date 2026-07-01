// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, type ReactNode, type ErrorInfo } from "react";
import { TriangleAlert } from "lucide-react";
import { analytics } from "../lib/analytics";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary that tracks errors via analytics
 * Catches React rendering errors and reports them for monitoring
 *
 * Usage:
 * ```tsx
 * <AnalyticsErrorBoundary>
 *   <YourComponent />
 * </AnalyticsErrorBoundary>
 * ```
 */
export class AnalyticsErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Track error in analytics (privacy-first: no file paths/stack traces)
    if (analytics) {
      analytics.trackError(
        error,
        {
          errorBoundary: true,
        },
        false // Explicitly disable stack traces (privacy)
      );
    }

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error("Error caught by boundary:", error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Show custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="bg-background min-h-screen flex items-center justify-center px-4">
          <div className="bg-card text-card-foreground max-w-md w-full rounded-lg p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <TriangleAlert
                className="text-destructive h-6 w-6"
                aria-hidden="true"
              />
              <h2 className="text-foreground text-lg font-semibold">
                Something went wrong
              </h2>
            </div>
            <p className="text-muted-foreground mb-4 text-sm">
              We encountered an unexpected error. Please try refreshing the
              page.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-4 text-xs">
                <summary className="text-muted-foreground mb-2 cursor-pointer">
                  Error Details (Development Only)
                </summary>
                <pre className="bg-muted text-destructive overflow-x-auto rounded p-3">
                  {this.state.error.message}
                  {"\n\n"}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 w-full rounded-lg px-4 py-2 font-medium transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
