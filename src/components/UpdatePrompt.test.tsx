// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdatePrompt } from "./UpdatePrompt";
import { useServiceWorkerUpdate } from "../hooks/useServiceWorkerUpdate";

// Mock i18n - simple pass-through
vi.mock("@lingui/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  msg: () => "mocked-aria-label",
}));

vi.mock("@lingui/react", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLingui: () => ({
    _: () => "mocked-aria-label",
  }),
}));

// Mock useServiceWorkerUpdate hook
vi.mock("../hooks/useServiceWorkerUpdate");

describe("UpdatePrompt", () => {
  const mockUpdateServiceWorker = vi.fn();
  const mockClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock: no update available
    vi.mocked(useServiceWorkerUpdate).mockReturnValue({
      needRefresh: false,
      offlineReady: false,
      updateServiceWorker: mockUpdateServiceWorker,
      close: mockClose,
    });
  });

  describe("Visibility", () => {
    it("should not render when needRefresh is false", () => {
      const { container } = render(<UpdatePrompt />);
      expect(container.firstChild).toBeNull();
    });

    it.skip("should render when needRefresh is true", () => {
      vi.mocked(useServiceWorkerUpdate).mockReturnValue({
        needRefresh: true,
        offlineReady: false,
        updateServiceWorker: mockUpdateServiceWorker,
        close: mockClose,
      });

      render(<UpdatePrompt />);

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

    it.skip("should display title", () => {
      render(<UpdatePrompt />);
      expect(screen.getByText("New version available")).toBeInTheDocument();
    });

    it.skip("should display description", () => {
      render(<UpdatePrompt />);
      expect(
        screen.getByText(/A new version of SecPal is ready/i)
      ).toBeInTheDocument();
    });

    it.skip("should display Update button", () => {
      render(<UpdatePrompt />);
      expect(screen.getByText("Update")).toBeInTheDocument();
    });

    it.skip("should display Later button", () => {
      render(<UpdatePrompt />);
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

    it.skip("should call updateServiceWorker when Update button is clicked", async () => {
      const user = userEvent.setup();
      render(<UpdatePrompt />);

      const updateButton = screen.getByText("Update");
      await user.click(updateButton);

      expect(mockUpdateServiceWorker).toHaveBeenCalledTimes(1);
    });

    it.skip("should call close when Later button is clicked", async () => {
      const user = userEvent.setup();
      render(<UpdatePrompt />);

      const laterButton = screen.getByText("Later");
      await user.click(laterButton);

      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it.skip("should not call updateServiceWorker when Later is clicked", async () => {
      const user = userEvent.setup();
      render(<UpdatePrompt />);

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
      render(<UpdatePrompt />);
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("should have aria-live=polite", () => {
      render(<UpdatePrompt />);
      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
    });

    it("should have aria-atomic=true", () => {
      render(<UpdatePrompt />);
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
      const { container } = render(<UpdatePrompt />);
      const wrapper = container.firstChild as HTMLElement;

      expect(wrapper).toHaveClass("fixed");
      expect(wrapper).toHaveClass("bottom-4");
      expect(wrapper).toHaveClass("right-4");
    });

    it("should have high z-index to overlay other content", () => {
      const { container } = render(<UpdatePrompt />);
      const wrapper = container.firstChild as HTMLElement;

      expect(wrapper).toHaveClass("z-50");
    });

    it("should have max-width constraint", () => {
      const { container } = render(<UpdatePrompt />);
      const wrapper = container.firstChild as HTMLElement;

      expect(wrapper).toHaveClass("max-w-md");
    });
  });

  describe("State Changes", () => {
    it.skip("should hide when needRefresh changes to false", () => {
      const { rerender } = render(<UpdatePrompt />);

      // Initially visible
      vi.mocked(useServiceWorkerUpdate).mockReturnValue({
        needRefresh: true,
        offlineReady: false,
        updateServiceWorker: mockUpdateServiceWorker,
        close: mockClose,
      });

      rerender(<UpdatePrompt />);
      expect(screen.getByText("New version available")).toBeInTheDocument();

      // Change to hidden
      vi.mocked(useServiceWorkerUpdate).mockReturnValue({
        needRefresh: false,
        offlineReady: false,
        updateServiceWorker: mockUpdateServiceWorker,
        close: mockClose,
      });

      rerender(<UpdatePrompt />);
      expect(
        screen.queryByText("New version available")
      ).not.toBeInTheDocument();
    });
  });
});
