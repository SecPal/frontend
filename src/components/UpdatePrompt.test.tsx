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
  const mockClose = vi.fn();

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
      close: mockClose,
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
        close: mockClose,
      });

      renderWithI18n(<UpdatePrompt />);

      expect(screen.getByText("New version available")).toBeInTheDocument();
    });
  });

  describe("Content", () => {
    beforeEach(() => {
      vi.mocked(useServiceWorkerUpdate).mockReturnValue({
        needRefresh: true,
        offlineReady: false,
        updateServiceWorker: mockUpdateServiceWorker,
        close: mockClose,
      });
    });

    it("should display title", () => {
      renderWithI18n(<UpdatePrompt />);
      expect(screen.getByText("New version available")).toBeInTheDocument();
    });

    it("should display description", () => {
      renderWithI18n(<UpdatePrompt />);
      expect(
        screen.getByText(/A new version of SecPal is ready/i)
      ).toBeInTheDocument();
    });

    it("should display Update button", () => {
      renderWithI18n(<UpdatePrompt />);
      expect(screen.getByText("Update")).toBeInTheDocument();
    });

    it("should display Later button", () => {
      renderWithI18n(<UpdatePrompt />);
      expect(screen.getByText("Later")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    beforeEach(() => {
      vi.mocked(useServiceWorkerUpdate).mockReturnValue({
        needRefresh: true,
        offlineReady: false,
        updateServiceWorker: mockUpdateServiceWorker,
        close: mockClose,
      });
    });

    it("should call updateServiceWorker when Update button is clicked", async () => {
      const user = userEvent.setup();
      renderWithI18n(<UpdatePrompt />);

      const updateButton = screen.getByText("Update");
      await user.click(updateButton);

      expect(mockUpdateServiceWorker).toHaveBeenCalledTimes(1);
    });

    it("should call close when Later button is clicked", async () => {
      const user = userEvent.setup();
      renderWithI18n(<UpdatePrompt />);

      const laterButton = screen.getByText("Later");
      await user.click(laterButton);

      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it("should not call updateServiceWorker when Later is clicked", async () => {
      const user = userEvent.setup();
      renderWithI18n(<UpdatePrompt />);

      const laterButton = screen.getByText("Later");
      await user.click(laterButton);

      expect(mockUpdateServiceWorker).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    beforeEach(() => {
      vi.mocked(useServiceWorkerUpdate).mockReturnValue({
        needRefresh: true,
        offlineReady: false,
        updateServiceWorker: mockUpdateServiceWorker,
        close: mockClose,
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
        close: mockClose,
      });
    });

    it("should be fixed at bottom-right corner", () => {
      const { container } = renderWithI18n(<UpdatePrompt />);
      const wrapper = container.firstChild as HTMLElement;

      expect(wrapper).toHaveClass("fixed");
      expect(wrapper).toHaveClass("bottom-4");
      expect(wrapper).toHaveClass("right-4");
    });

    it("should have high z-index to overlay other content", () => {
      const { container } = renderWithI18n(<UpdatePrompt />);
      const wrapper = container.firstChild as HTMLElement;

      expect(wrapper).toHaveClass("z-50");
    });

    it("should have max-width constraint", () => {
      const { container } = renderWithI18n(<UpdatePrompt />);
      const wrapper = container.firstChild as HTMLElement;

      expect(wrapper).toHaveClass("max-w-md");
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
        close: mockClose,
      });

      rerender(
        <I18nProvider i18n={i18n}>
          <UpdatePrompt />
        </I18nProvider>
      );
      expect(screen.getByText("New version available")).toBeInTheDocument();

      // Change to hidden
      vi.mocked(useServiceWorkerUpdate).mockReturnValue({
        needRefresh: false,
        offlineReady: false,
        updateServiceWorker: mockUpdateServiceWorker,
        close: mockClose,
      });

      rerender(
        <I18nProvider i18n={i18n}>
          <UpdatePrompt />
        </I18nProvider>
      );
      expect(
        screen.queryByText("New version available")
      ).not.toBeInTheDocument();
    });
  });
});
