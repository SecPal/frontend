// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { OfflineIndicator } from "./OfflineIndicator";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

// Mock useOnlineStatus hook
vi.mock("../hooks/useOnlineStatus");

describe("OfflineIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Setup i18n with English locale
    i18n.load("en", {});
    i18n.activate("en");

    // Default mock: online
    vi.mocked(useOnlineStatus).mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function renderWithI18n(component: React.ReactElement) {
    return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
  }

  describe("Visibility", () => {
    it("should not render when online", () => {
      vi.mocked(useOnlineStatus).mockReturnValue(true);

      const { container } = renderWithI18n(<OfflineIndicator />);

      expect(container.firstChild).toBeNull();
    });

    it("should render when offline", () => {
      vi.mocked(useOnlineStatus).mockReturnValue(false);

      renderWithI18n(<OfflineIndicator />);

      expect(screen.getByText(/You're offline/i)).toBeInTheDocument();
    });

    it("should hide when going back online", () => {
      const mockUseOnlineStatus = vi.mocked(useOnlineStatus);
      mockUseOnlineStatus.mockReturnValue(false);

      const { rerender } = renderWithI18n(<OfflineIndicator />);

      expect(screen.getByText(/You're offline/i)).toBeInTheDocument();

      // Simulate going online
      mockUseOnlineStatus.mockReturnValue(true);
      rerender(
        <I18nProvider i18n={i18n}>
          <OfflineIndicator />
        </I18nProvider>
      );

      // Component should not render when online
      expect(screen.queryByText(/You're offline/i)).not.toBeInTheDocument();
    });
  });

  describe("Content", () => {
    beforeEach(() => {
      vi.mocked(useOnlineStatus).mockReturnValue(false);
    });

    it("should display offline title", () => {
      renderWithI18n(<OfflineIndicator />);
      expect(screen.getByText(/You're offline/i)).toBeInTheDocument();
    });

    it("should display sync message", () => {
      renderWithI18n(<OfflineIndicator />);
      expect(
        screen.getByText(/Your changes will sync when you're back online/i)
      ).toBeInTheDocument();
    });

    it("should display limited features warning", () => {
      renderWithI18n(<OfflineIndicator />);
      expect(
        screen.getByText(/Some features may be limited/i)
      ).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    beforeEach(() => {
      vi.mocked(useOnlineStatus).mockReturnValue(false);
    });

    it("should have status role for screen readers", () => {
      renderWithI18n(<OfflineIndicator />);

      const banner = screen.getByRole("status");
      expect(banner).toBeInTheDocument();
    });

    it("should have polite aria-live for non-intrusive announcement", () => {
      renderWithI18n(<OfflineIndicator />);

      const banner = screen.getByRole("status");
      expect(banner).toHaveAttribute("aria-live", "polite");
    });

    it("should have aria-atomic for complete announcement", () => {
      renderWithI18n(<OfflineIndicator />);

      const banner = screen.getByRole("status");
      expect(banner).toHaveAttribute("aria-atomic", "true");
    });

    it("should have accessible label on minimized icon button", async () => {
      vi.mocked(useOnlineStatus).mockReturnValue(false);

      renderWithI18n(<OfflineIndicator />);

      // Wait for auto-minimize
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      const iconButton = screen.getByRole("button");
      expect(iconButton).toHaveAttribute("aria-label");
    });
  });

  describe("Non-blocking behavior", () => {
    it("should NOT use a modal dialog", () => {
      vi.mocked(useOnlineStatus).mockReturnValue(false);

      renderWithI18n(<OfflineIndicator />);

      // Should NOT have dialog role (which would block interaction)
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("should NOT have a backdrop overlay", () => {
      vi.mocked(useOnlineStatus).mockReturnValue(false);

      const { container } = renderWithI18n(<OfflineIndicator />);

      // Check that there's no backdrop element
      const backdropElements = container.querySelectorAll(
        '[class*="backdrop"], [class*="overlay"]'
      );
      expect(backdropElements).toHaveLength(0);
    });

    it("should be positioned fixed at bottom", () => {
      vi.mocked(useOnlineStatus).mockReturnValue(false);

      renderWithI18n(<OfflineIndicator />);

      const banner = screen.getByRole("status");
      expect(banner).toHaveClass("fixed");
      expect(banner).toHaveClass("bottom-4");
    });
  });

  describe("Auto-minimize behavior", () => {
    beforeEach(() => {
      vi.mocked(useOnlineStatus).mockReturnValue(false);
    });

    it("should show expanded banner initially", () => {
      renderWithI18n(<OfflineIndicator />);

      expect(screen.getByText(/You're offline/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Some features may be limited/i)
      ).toBeInTheDocument();
    });

    it("should auto-minimize after 5 seconds", async () => {
      renderWithI18n(<OfflineIndicator />);

      // Initially expanded
      expect(screen.getByText(/You're offline/i)).toBeInTheDocument();

      // Advance time by 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should be minimized - only icon button visible
      expect(screen.queryByText(/You're offline/i)).not.toBeInTheDocument();
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("should NOT minimize before 5 seconds", () => {
      renderWithI18n(<OfflineIndicator />);

      // Advance time by 4.9 seconds
      act(() => {
        vi.advanceTimersByTime(4900);
      });

      // Should still be expanded
      expect(screen.getByText(/You're offline/i)).toBeInTheDocument();
    });

    it("should expand when clicking minimized icon", () => {
      renderWithI18n(<OfflineIndicator />);

      // Wait for auto-minimize
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Click the icon button to expand
      const iconButton = screen.getByRole("button");
      fireEvent.click(iconButton);

      // Should be expanded again
      expect(screen.getByText(/You're offline/i)).toBeInTheDocument();
    });

    it("should allow manual minimize via button", () => {
      renderWithI18n(<OfflineIndicator />);

      // Find and click minimize button (the chevron button)
      const minimizeButton = screen.getByRole("button", {
        name: /minimize/i,
      });
      fireEvent.click(minimizeButton);

      // Should be minimized
      expect(screen.queryByText(/You're offline/i)).not.toBeInTheDocument();
    });

    it("should reset to expanded state when going online then offline again", async () => {
      const mockUseOnlineStatus = vi.mocked(useOnlineStatus);
      mockUseOnlineStatus.mockReturnValue(false);

      const { rerender } = renderWithI18n(<OfflineIndicator />);

      // Wait for auto-minimize
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Verify minimized
      expect(screen.queryByText(/You're offline/i)).not.toBeInTheDocument();

      // Go online
      mockUseOnlineStatus.mockReturnValue(true);
      rerender(
        <I18nProvider i18n={i18n}>
          <OfflineIndicator />
        </I18nProvider>
      );

      // Go offline again
      mockUseOnlineStatus.mockReturnValue(false);
      rerender(
        <I18nProvider i18n={i18n}>
          <OfflineIndicator />
        </I18nProvider>
      );

      // Should be expanded again (reset)
      expect(screen.getByText(/You're offline/i)).toBeInTheDocument();
    });
  });
});
