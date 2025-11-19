// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { NotificationPermissionPrompt } from "./NotificationPermissionPrompt";
import * as useNotificationsModule from "@/hooks/useNotifications";

// Mock the useNotifications hook
vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: vi.fn(),
}));

describe("NotificationPermissionPrompt", () => {
  const mockRequestPermission = vi.fn();
  const mockShowNotification = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNotificationsModule.useNotifications).mockReturnValue({
      permission: "default",
      isSupported: true,
      requestPermission: mockRequestPermission,
      showNotification: mockShowNotification,
      isLoading: false,
      error: null,
    });
  });

  describe("rendering", () => {
    it("should not render if permission already granted", () => {
      vi.mocked(useNotificationsModule.useNotifications).mockReturnValue({
        permission: "granted",
        isSupported: true,
        requestPermission: mockRequestPermission,
        showNotification: mockShowNotification,
        isLoading: false,
        error: null,
      });

      const { container } = render(<NotificationPermissionPrompt />);
      expect(container.firstChild).toBeNull();
    });

    it("should not render if permission denied", () => {
      vi.mocked(useNotificationsModule.useNotifications).mockReturnValue({
        permission: "denied",
        isSupported: true,
        requestPermission: mockRequestPermission,
        showNotification: mockShowNotification,
        isLoading: false,
        error: null,
      });

      const { container } = render(<NotificationPermissionPrompt />);
      expect(container.firstChild).toBeNull();
    });

    it("should not render if notifications not supported", () => {
      vi.mocked(useNotificationsModule.useNotifications).mockReturnValue({
        permission: "default",
        isSupported: false,
        requestPermission: mockRequestPermission,
        showNotification: mockShowNotification,
        isLoading: false,
        error: null,
      });

      const { container } = render(<NotificationPermissionPrompt />);
      expect(container.firstChild).toBeNull();
    });

    it("should render prompt when permission is default and supported", () => {
      render(<NotificationPermissionPrompt />);

      expect(screen.getByText(/Enable Notifications/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Enable/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Not Now/i })
      ).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("should request permission when Enable clicked", async () => {
      const user = userEvent.setup();
      mockRequestPermission.mockResolvedValue("granted");

      render(<NotificationPermissionPrompt />);

      const enableButton = screen.getByRole("button", { name: /Enable/i });
      await user.click(enableButton);

      expect(mockRequestPermission).toHaveBeenCalledOnce();
    });

    it("should show test notification on successful permission grant", async () => {
      const user = userEvent.setup();
      mockRequestPermission.mockResolvedValue("granted");

      render(<NotificationPermissionPrompt />);

      const enableButton = screen.getByRole("button", { name: /Enable/i });
      await user.click(enableButton);

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith({
          title: "Notifications Enabled",
          body: "You'll now receive important updates from SecPal",
        });
      });
    });

    it("should hide prompt when Not Now clicked", async () => {
      const user = userEvent.setup();

      render(<NotificationPermissionPrompt />);

      const dismissButton = screen.getByRole("button", { name: /Not Now/i });
      await user.click(dismissButton);

      expect(
        screen.queryByText(/Enable Notifications/i)
      ).not.toBeInTheDocument();
    });

    it("should show loading state while requesting permission", async () => {
      mockRequestPermission.mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve("granted"), 100))
      );

      vi.mocked(useNotificationsModule.useNotifications).mockReturnValue({
        permission: "default",
        isSupported: true,
        requestPermission: mockRequestPermission,
        showNotification: mockShowNotification,
        isLoading: true,
        error: null,
      });

      render(<NotificationPermissionPrompt />);

      const enableButton = screen.getByRole("button", { name: /Enabling/i });
      expect(enableButton).toBeDisabled();
    });

    it("should handle permission denial gracefully", async () => {
      const user = userEvent.setup();
      mockRequestPermission.mockResolvedValue("denied");

      render(<NotificationPermissionPrompt />);

      const enableButton = screen.getByRole("button", { name: /Enable/i });
      await user.click(enableButton);

      await waitFor(() => {
        expect(mockRequestPermission).toHaveBeenCalledOnce();
        expect(mockShowNotification).not.toHaveBeenCalled();
      });
    });

    it("should display error message on failure", async () => {
      const user = userEvent.setup();
      const testError = new Error("Permission request failed");
      mockRequestPermission.mockRejectedValue(testError);

      render(<NotificationPermissionPrompt />);

      const enableButton = screen.getByRole("button", { name: /Enable/i });
      await user.click(enableButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Permission request failed/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("accessibility", () => {
    it("should have accessible button labels", () => {
      render(<NotificationPermissionPrompt />);

      expect(
        screen.getByRole("button", { name: /Enable/i })
      ).toHaveAccessibleName();
      expect(
        screen.getByRole("button", { name: /Not Now/i })
      ).toHaveAccessibleName();
    });

    it("should be keyboard navigable", async () => {
      const user = userEvent.setup();
      render(<NotificationPermissionPrompt />);

      // Tab to first button
      await user.tab();
      expect(screen.getByRole("button", { name: /Enable/i })).toHaveFocus();

      // Tab to second button
      await user.tab();
      expect(screen.getByRole("button", { name: /Not Now/i })).toHaveFocus();
    });
  });

  describe("persistence", () => {
    it("should not show again after dismissal (within session)", async () => {
      const user = userEvent.setup();

      const { rerender } = render(<NotificationPermissionPrompt />);

      const dismissButton = screen.getByRole("button", { name: /Not Now/i });
      await user.click(dismissButton);

      // Rerender component
      rerender(<NotificationPermissionPrompt />);

      expect(
        screen.queryByText(/Enable Notifications/i)
      ).not.toBeInTheDocument();
    });
  });
});
