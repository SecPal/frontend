// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { UpdatePrompt } from "./UpdatePrompt";
import { useServiceWorkerUpdate } from "../hooks/useServiceWorkerUpdate";

// Mock useServiceWorkerUpdate hook
vi.mock("../hooks/useServiceWorkerUpdate");

describe("UpdatePrompt", () => {
  const mockUpdateServiceWorker = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup i18n with English locale
    i18n.load("en", {});
    i18n.activate("en");

    // Default mock: no update available
    vi.mocked(useServiceWorkerUpdate).mockReturnValue({
      needRefresh: false,
      offlineReady: false,
      updateServiceWorker: mockUpdateServiceWorker,
    });
  });

  function renderWithI18n(component: React.ReactElement) {
    return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
  }

  describe("Visibility", () => {
    it("should not render when needRefresh is false", () => {
      const { container } = renderWithI18n(<UpdatePrompt />);
      expect(container.firstChild).toBeNull();
    });

    it("should render when needRefresh is true", () => {
      vi.mocked(useServiceWorkerUpdate).mockReturnValue({
        needRefresh: true,
        offlineReady: false,
        updateServiceWorker: mockUpdateServiceWorker,
      });

      renderWithI18n(<UpdatePrompt />);

      expect(
        screen.getByText(/A new version of SecPal is available/i)
      ).toBeInTheDocument();
    });

    it("should always be visible when update is available (no dismiss option)", () => {
      vi.mocked(useServiceWorkerUpdate).mockReturnValue({
        needRefresh: true,
        offlineReady: false,
        updateServiceWorker: mockUpdateServiceWorker,
      });

      renderWithI18n(<UpdatePrompt />);

      // Verify banner is shown
      expect(
        screen.getByText(/A new version of SecPal is available/i)
      ).toBeInTheDocument();

      // Verify no dismiss/later button exists
      expect(screen.queryByText("Later")).not.toBeInTheDocument();
      expect(screen.queryByText("Dismiss")).not.toBeInTheDocument();
    });
  });

  describe("Content", () => {
    beforeEach(() => {
      vi.mocked(useServiceWorkerUpdate).mockReturnValue({
        needRefresh: true,
        offlineReady: false,
        updateServiceWorker: mockUpdateServiceWorker,
      });
    });

    it("should display update message", () => {
      renderWithI18n(<UpdatePrompt />);
      expect(
        screen.getByText(/A new version of SecPal is available/i)
      ).toBeInTheDocument();
    });

    it("should display Update now button", () => {
      renderWithI18n(<UpdatePrompt />);
      expect(screen.getByText("Update now")).toBeInTheDocument();
    });

    it("should not display Later button", () => {
      renderWithI18n(<UpdatePrompt />);
      expect(screen.queryByText("Later")).not.toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    beforeEach(() => {
      vi.mocked(useServiceWorkerUpdate).mockReturnValue({
        needRefresh: true,
        offlineReady: false,
        updateServiceWorker: mockUpdateServiceWorker,
      });
    });

    it("should call updateServiceWorker when Update now button is clicked", async () => {
      const user = userEvent.setup();
      renderWithI18n(<UpdatePrompt />);

      const updateButton = screen.getByText("Update now");
      await user.click(updateButton);

      expect(mockUpdateServiceWorker).toHaveBeenCalledTimes(1);
    });
  });

  describe("Accessibility", () => {
    beforeEach(() => {
      vi.mocked(useServiceWorkerUpdate).mockReturnValue({
        needRefresh: true,
        offlineReady: false,
        updateServiceWorker: mockUpdateServiceWorker,
      });
    });

    it("should have role=status for screen readers", () => {
      renderWithI18n(<UpdatePrompt />);
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("should have aria-live=polite", () => {
      renderWithI18n(<UpdatePrompt />);
      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
    });

    it("should have aria-atomic=true", () => {
      renderWithI18n(<UpdatePrompt />);
      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-atomic", "true");
    });
  });

  describe("Positioning", () => {
    beforeEach(() => {
      vi.mocked(useServiceWorkerUpdate).mockReturnValue({
        needRefresh: true,
        offlineReady: false,
        updateServiceWorker: mockUpdateServiceWorker,
      });
    });

    it("should be fixed at top of screen", () => {
      const { container } = renderWithI18n(<UpdatePrompt />);
      const wrapper = container.firstChild as HTMLElement;

      expect(wrapper).toHaveClass("fixed");
      expect(wrapper).toHaveClass("top-0");
      expect(wrapper).toHaveClass("left-0");
      expect(wrapper).toHaveClass("right-0");
    });

    it("should have high z-index to overlay other content", () => {
      const { container } = renderWithI18n(<UpdatePrompt />);
      const wrapper = container.firstChild as HTMLElement;

      expect(wrapper).toHaveClass("z-50");
    });

    it("should span full width", () => {
      const { container } = renderWithI18n(<UpdatePrompt />);
      const wrapper = container.firstChild as HTMLElement;

      expect(wrapper).toHaveClass("left-0");
      expect(wrapper).toHaveClass("right-0");
    });
  });

  describe("State Changes", () => {
    it("should hide when needRefresh changes to false", () => {
      const { rerender } = renderWithI18n(<UpdatePrompt />);

      // Initially visible
      vi.mocked(useServiceWorkerUpdate).mockReturnValue({
        needRefresh: true,
        offlineReady: false,
        updateServiceWorker: mockUpdateServiceWorker,
      });

      rerender(
        <I18nProvider i18n={i18n}>
          <UpdatePrompt />
        </I18nProvider>
      );
      expect(
        screen.getByText(/A new version of SecPal is available/i)
      ).toBeInTheDocument();

      // Change to hidden
      vi.mocked(useServiceWorkerUpdate).mockReturnValue({
        needRefresh: false,
        offlineReady: false,
        updateServiceWorker: mockUpdateServiceWorker,
      });

      rerender(
        <I18nProvider i18n={i18n}>
          <UpdatePrompt />
        </I18nProvider>
      );
      expect(
        screen.queryByText(/A new version of SecPal is available/i)
      ).not.toBeInTheDocument();
    });
  });
});
