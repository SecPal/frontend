// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { NotificationPreferences } from "./NotificationPreferences";
import * as useNotificationsModule from "@/hooks/useNotifications";

// Mock the useNotifications hook
const mockUseNotifications = vi.spyOn(
  useNotificationsModule,
  "useNotifications"
);

const renderWithI18n = (component: React.ReactElement) => {
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
};

describe("NotificationPreferences", () => {
  const mockRequestPermission = vi.fn();
  const mockShowNotification = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockUseNotifications.mockReturnValue({
      permission: "granted",
      isSupported: true,
      requestPermission: mockRequestPermission,
      showNotification: mockShowNotification,
      isLoading: false,
      error: null,
    });
  });

  describe("browser support", () => {
    it("should show warning when notifications not supported", () => {
      mockUseNotifications.mockReturnValue({
        permission: "default",
        isSupported: false,
        requestPermission: mockRequestPermission,
        showNotification: mockShowNotification,
        isLoading: false,
        error: null,
      });

      renderWithI18n(<NotificationPreferences />);

      expect(
        screen.getByText(/not supported in your browser/i)
      ).toBeInTheDocument();
    });
  });

  describe("permission states", () => {
    it("should show enable button when permission is default", () => {
      mockUseNotifications.mockReturnValue({
        permission: "default",
        isSupported: true,
        requestPermission: mockRequestPermission,
        showNotification: mockShowNotification,
        isLoading: false,
        error: null,
      });

      renderWithI18n(<NotificationPreferences />);

      expect(
        screen.getByRole("button", { name: /enable notifications/i })
      ).toBeInTheDocument();
    });

    it("should show blocked message when permission is denied", () => {
      mockUseNotifications.mockReturnValue({
        permission: "denied",
        isSupported: true,
        requestPermission: mockRequestPermission,
        showNotification: mockShowNotification,
        isLoading: false,
        error: null,
      });

      renderWithI18n(<NotificationPreferences />);

      expect(
        screen.getByText(/notifications have been blocked/i)
      ).toBeInTheDocument();
    });

    it("should show preferences when permission is granted", () => {
      renderWithI18n(<NotificationPreferences />);

      expect(screen.getByText(/notification preferences/i)).toBeInTheDocument();
      expect(screen.getByText(/security alerts/i)).toBeInTheDocument();
      expect(screen.getByText(/system updates/i)).toBeInTheDocument();
      expect(screen.getByText(/shift reminders/i)).toBeInTheDocument();
      expect(screen.getByText(/team messages/i)).toBeInTheDocument();
    });
  });

  describe("enabling notifications", () => {
    it("should request permission when enable button clicked", async () => {
      mockUseNotifications.mockReturnValue({
        permission: "default",
        isSupported: true,
        requestPermission: mockRequestPermission,
        showNotification: mockShowNotification,
        isLoading: false,
        error: null,
      });

      mockRequestPermission.mockResolvedValue("granted");
      mockShowNotification.mockResolvedValue(undefined);

      renderWithI18n(<NotificationPreferences />);
      const user = userEvent.setup();

      const enableButton = screen.getByRole("button", {
        name: /enable notifications/i,
      });
      await user.click(enableButton);

      await waitFor(() => {
        expect(mockRequestPermission).toHaveBeenCalledOnce();
      });
    });

    it("should show welcome notification after enabling", async () => {
      mockUseNotifications.mockReturnValue({
        permission: "default",
        isSupported: true,
        requestPermission: mockRequestPermission,
        showNotification: mockShowNotification,
        isLoading: false,
        error: null,
      });

      mockRequestPermission.mockResolvedValue("granted");
      mockShowNotification.mockResolvedValue(undefined);

      renderWithI18n(<NotificationPreferences />);
      const user = userEvent.setup();

      const enableButton = screen.getByRole("button", {
        name: /enable notifications/i,
      });
      await user.click(enableButton);

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.any(String),
            body: expect.any(String),
            tag: "welcome-notification",
          })
        );
      });
    });

    it("should handle enable errors gracefully", async () => {
      mockUseNotifications.mockReturnValue({
        permission: "default",
        isSupported: true,
        requestPermission: mockRequestPermission,
        showNotification: mockShowNotification,
        isLoading: false,
        error: null,
      });

      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockRequestPermission.mockRejectedValue(new Error("Permission denied"));

      renderWithI18n(<NotificationPreferences />);
      const user = userEvent.setup();

      const enableButton = screen.getByRole("button", {
        name: /enable notifications/i,
      });
      await user.click(enableButton);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          "Failed to enable notifications:",
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });
  });

  describe("preference toggles", () => {
    it("should toggle preference when switch clicked", async () => {
      renderWithI18n(<NotificationPreferences />);
      const user = userEvent.setup();

      const alertsSwitch = screen.getByRole("switch", {
        name: /security alerts/i,
      });

      // Initially enabled
      expect(alertsSwitch).toHaveAttribute("aria-checked", "true");

      // Toggle off
      await user.click(alertsSwitch);
      expect(alertsSwitch).toHaveAttribute("aria-checked", "false");

      // Toggle back on
      await user.click(alertsSwitch);
      expect(alertsSwitch).toHaveAttribute("aria-checked", "true");
    });

    it("should save preferences to localStorage", async () => {
      renderWithI18n(<NotificationPreferences />);
      const user = userEvent.setup();

      const alertsSwitch = screen.getByRole("switch", {
        name: /security alerts/i,
      });

      await user.click(alertsSwitch);

      await waitFor(() => {
        const stored = localStorage.getItem("secpal-notification-preferences");
        expect(stored).toBeTruthy();
        const parsed = JSON.parse(stored!);
        expect(
          parsed.find((p: { category: string }) => p.category === "alerts")
        ).toMatchObject({
          category: "alerts",
          enabled: false,
        });
      });
    });

    it("should load preferences from localStorage", () => {
      const storedPreferences = [
        { category: "alerts", enabled: false },
        { category: "updates", enabled: false },
        { category: "reminders", enabled: true },
        { category: "messages", enabled: true },
      ];

      localStorage.setItem(
        "secpal-notification-preferences",
        JSON.stringify(storedPreferences)
      );

      renderWithI18n(<NotificationPreferences />);

      const alertsSwitch = screen.getByRole("switch", {
        name: /security alerts/i,
      });
      const messagesSwitch = screen.getByRole("switch", {
        name: /team messages/i,
      });

      expect(alertsSwitch).toHaveAttribute("aria-checked", "false");
      expect(messagesSwitch).toHaveAttribute("aria-checked", "true");
    });
  });

  describe("test notification", () => {
    it("should send test notification when button clicked", async () => {
      mockShowNotification.mockResolvedValue(undefined);

      renderWithI18n(<NotificationPreferences />);
      const user = userEvent.setup();

      const testButton = screen.getByRole("button", { name: /send test/i });
      await user.click(testButton);

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.any(String),
            body: expect.any(String),
            tag: "test-notification",
            requireInteraction: false,
          })
        );
      });
    });

    it("should not send test if permission not granted", async () => {
      mockUseNotifications.mockReturnValue({
        permission: "default",
        isSupported: true,
        requestPermission: mockRequestPermission,
        showNotification: mockShowNotification,
        isLoading: false,
        error: null,
      });

      renderWithI18n(<NotificationPreferences />);

      // Should not have test button when permission is default
      expect(
        screen.queryByRole("button", { name: /send test/i })
      ).not.toBeInTheDocument();
    });

    it("should handle test notification errors", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockShowNotification.mockRejectedValue(
        new Error("Failed to show notification")
      );

      renderWithI18n(<NotificationPreferences />);
      const user = userEvent.setup();

      const testButton = screen.getByRole("button", { name: /send test/i });
      await user.click(testButton);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          "Failed to send test notification:",
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });
  });

  describe("accessibility", () => {
    it("should have proper ARIA labels", () => {
      renderWithI18n(<NotificationPreferences />);

      const switches = screen.getAllByRole("switch");
      switches.forEach((switchElement) => {
        // Catalyst Switch uses aria-labelledby instead of aria-label
        expect(
          switchElement.hasAttribute("aria-label") ||
            switchElement.hasAttribute("aria-labelledby")
        ).toBe(true);
        expect(switchElement).toHaveAttribute("aria-checked");
      });
    });

    it("should be keyboard navigable", async () => {
      renderWithI18n(<NotificationPreferences />);

      const alertsSwitch = screen.getByRole("switch", {
        name: /security alerts/i,
      });

      // Focus the switch
      alertsSwitch.focus();
      expect(alertsSwitch).toHaveFocus();
    });
  });
});
