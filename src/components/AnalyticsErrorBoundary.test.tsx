// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalyticsErrorBoundary } from "./AnalyticsErrorBoundary";
import { analytics } from "../lib/analytics";

// Mock analytics
vi.mock("../lib/analytics", () => ({
  analytics: {
    trackError: vi.fn(),
  },
}));

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>No error</div>;
};

describe("AnalyticsErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error in tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("normal rendering", () => {
    it("should render children when no error occurs", () => {
      render(
        <AnalyticsErrorBoundary>
          <div>Test content</div>
        </AnalyticsErrorBoundary>
      );

      expect(screen.getByText("Test content")).toBeInTheDocument();
    });
  });

  describe("error handling", () => {
    it("should catch errors and show fallback UI", () => {
      render(
        <AnalyticsErrorBoundary>
          <ThrowError shouldThrow={true} />
        </AnalyticsErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(
        screen.getByText(/we encountered an unexpected error/i)
      ).toBeInTheDocument();
    });

    it("should track error in analytics", () => {
      render(
        <AnalyticsErrorBoundary>
          <ThrowError shouldThrow={true} />
        </AnalyticsErrorBoundary>
      );

      expect(analytics!.trackError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Test error",
        }),
        expect.objectContaining({
          errorBoundary: true,
        }),
        false // includeStack parameter
      );
    });

    it("should call onError callback when provided", () => {
      const onError = vi.fn();

      render(
        <AnalyticsErrorBoundary onError={onError}>
          <ThrowError shouldThrow={true} />
        </AnalyticsErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Test error" }),
        expect.objectContaining({ componentStack: expect.any(String) })
      );
    });

    it("should show custom fallback when provided", () => {
      const customFallback = <div>Custom error message</div>;

      render(
        <AnalyticsErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </AnalyticsErrorBoundary>
      );

      expect(screen.getByText("Custom error message")).toBeInTheDocument();
      expect(
        screen.queryByText("Something went wrong")
      ).not.toBeInTheDocument();
    });

    it("should show refresh button", () => {
      render(
        <AnalyticsErrorBoundary>
          <ThrowError shouldThrow={true} />
        </AnalyticsErrorBoundary>
      );

      expect(
        screen.getByRole("button", { name: /refresh page/i })
      ).toBeInTheDocument();
    });
  });

  describe("error recovery", () => {
    it("should recover when error is fixed", () => {
      const { rerender } = render(
        <AnalyticsErrorBoundary>
          <ThrowError shouldThrow={true} />
        </AnalyticsErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();

      // Rerender with no error
      rerender(
        <AnalyticsErrorBoundary>
          <ThrowError shouldThrow={false} />
        </AnalyticsErrorBoundary>
      );

      // Error boundary keeps showing error UI until component is remounted
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });

  describe("analytics integration", () => {
    it("should not crash if analytics is not available", () => {
      // Temporarily remove analytics
      const originalAnalytics = analytics;
      (globalThis as unknown as { analytics: unknown }).analytics = null;

      render(
        <AnalyticsErrorBoundary>
          <ThrowError shouldThrow={true} />
        </AnalyticsErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();

      // Restore analytics
      (globalThis as unknown as { analytics: unknown }).analytics =
        originalAnalytics;
    });
  });
});
