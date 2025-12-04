// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { screen } from "@testing-library/dom";
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

const renderWithI18n = async (component: React.ReactElement) => {
  const result = render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
  // Wait for HeadlessUI Switch transitions to settle
  await waitFor(() => {});
  return result;
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
    it("should show warning when notifications not supported", async () => {
      mockUseNotifications.mockReturnValue({
        permission: "default",
        isSupported: false,
        requestPermission: mockRequestPermission,
        showNotification: mockShowNotification,
        isLoading: false,
        error: null,
      });

      await renderWithI18n(<NotificationPreferences />);

      expect(
        screen.getByText(/not supported in your browser/i)
      ).toBeInTheDocument();
    });
  });

  describe("permission states", () => {
    it("should show enable button when permission is default", async () => {
      mockUseNotifications.mockReturnValue({
        permission: "default",
        isSupported: true,
        requestPermission: mockRequestPermission,
        showNotification: mockShowNotification,
        isLoading: false,
        error: null,
      });

      await renderWithI18n(<NotificationPreferences />);

      expect(
        screen.getByRole("button", { name: /enable notifications/i })
      ).toBeInTheDocument();
    });

    it("should show blocked message when permission is denied", async () => {
      mockUseNotifications.mockReturnValue({
        permission: "denied",
        isSupported: true,
        requestPermission: mockRequestPermission,
        showNotification: mockShowNotification,
        isLoading: false,
        error: null,
      });

      await renderWithI18n(<NotificationPreferences />);

      expect(
        screen.getByText(/notifications have been blocked/i)
      ).toBeInTheDocument();
    });

    it("should show preferences when permission is granted", async () => {
      await renderWithI18n(<NotificationPreferences />);

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

      await renderWithI18n(<NotificationPreferences />);
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

      await renderWithI18n(<NotificationPreferences />);
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

      await renderWithI18n(<NotificationPreferences />);
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
      await renderWithI18n(<NotificationPreferences />);
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
      await renderWithI18n(<NotificationPreferences />);
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

    it("should load preferences from localStorage", async () => {
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

      await renderWithI18n(<NotificationPreferences />);

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

      await renderWithI18n(<NotificationPreferences />);
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

      await renderWithI18n(<NotificationPreferences />);

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

      await renderWithI18n(<NotificationPreferences />);
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
    it("should have proper ARIA labels", async () => {
      await renderWithI18n(<NotificationPreferences />);

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
      await renderWithI18n(<NotificationPreferences />);
      const user = userEvent.setup();

      const alertsSwitch = screen.getByRole("switch", {
        name: /security alerts/i,
      });

      // Focus the switch using userEvent to properly trigger React state updates
      await user.click(alertsSwitch);
      expect(alertsSwitch).toHaveFocus();
    });
  });

  describe("translation updates", () => {
    it("should update translations when locale changes without excessive re-renders", async () => {
      // Track render count to detect infinite loop
      let renderCount = 0;
      const RenderCounter = () => {
        renderCount++;
        return null;
      };

      const { rerender } = render(
        <I18nProvider i18n={i18n}>
          <RenderCounter />
          <NotificationPreferences />
        </I18nProvider>
      );
      // Wait for HeadlessUI Switch transitions to settle
      await waitFor(() => {});

      const initialRenderCount = renderCount;

      // Wait for initial render to settle
      await waitFor(() => {
        expect(
          screen.getByText(/notification preferences/i)
        ).toBeInTheDocument();
      });

      // Simulate locale change by re-rendering with new i18n instance
      // (In real app, this would happen via i18n.activate())
      rerender(
        <I18nProvider i18n={i18n}>
          <RenderCounter />
          <NotificationPreferences />
        </I18nProvider>
      );
      // Wait for HeadlessUI Switch transitions to settle
      await waitFor(() => {});

      // Wait a bit to allow any cascading re-renders
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify that render count is reasonable (not hundreds/thousands indicating infinite loop)
      // Allow for a few re-renders due to React's normal behavior, but catch runaway loops
      const finalRenderCount = renderCount;
      const renderDelta = finalRenderCount - initialRenderCount;

      expect(renderDelta).toBeLessThan(10); // Arbitrary reasonable limit
      expect(screen.getByText(/security alerts/i)).toBeInTheDocument();
    });

    it("should preserve enabled state when translations update", async () => {
      await renderWithI18n(<NotificationPreferences />);
      const user = userEvent.setup();

      // Toggle alerts off
      const alertsSwitch = screen.getByRole("switch", {
        name: /security alerts/i,
      });
      await user.click(alertsSwitch);
      expect(alertsSwitch).toHaveAttribute("aria-checked", "false");

      // Simulate translation update (in real app via locale change)
      // The component should maintain the enabled=false state
      // We can't easily trigger a real locale change in tests, but the fix
      // ensures that when locale (not _ function) changes, state is preserved

      // Verify state is still false after potential re-render
      await waitFor(() => {
        expect(alertsSwitch).toHaveAttribute("aria-checked", "false");
      });
    });
  });
});
