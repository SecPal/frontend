// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { NotificationInstallationsApiError } from "@/services/notificationInstallationsApi";
import { NotificationDeploymentUnavailableError } from "@/hooks/useNotifications";
import { messages as deMessages } from "@/locales/de/messages.mjs";
import { messages as enMessages } from "@/locales/en/messages.mjs";
import { NotificationPermissionPrompt } from "./NotificationPermissionPrompt";
import * as useNotificationsModule from "@/hooks/useNotifications";

vi.mock("@/hooks/useNotifications", async () => {
  const actual = await vi.importActual<
    typeof import("@/hooks/useNotifications")
  >("@/hooks/useNotifications");

  return {
    ...actual,
    useNotifications: vi.fn(),
  };
});

const renderWithI18n = (component: React.ReactElement) =>
  render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);

describe("NotificationPermissionPrompt", () => {
  const mockRequestPermission = vi.fn();
  const mockShowNotification = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", enMessages);
    i18n.load("de", deMessages);
    i18n.activate("en");
    vi.mocked(useNotificationsModule.useNotifications).mockReturnValue({
      permission: "default",
      isSupported: true,
      requestPermission: mockRequestPermission,
      showNotification: mockShowNotification,
      isLoading: false,
      error: null,
    });
  });

  it("renders truthful browser-scoped prompt copy", () => {
    renderWithI18n(<NotificationPermissionPrompt />);

    expect(
      screen.getByText(/enable browser notifications/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /turn on notifications for this signed-in browser on the current secpal deployment/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /category-specific notification controls are not available yet/i
      )
    ).toBeInTheDocument();
  });

  it("does not render when permission is already granted, denied, or unsupported", () => {
    vi.mocked(useNotificationsModule.useNotifications).mockReturnValue({
      permission: "granted",
      isSupported: true,
      requestPermission: mockRequestPermission,
      showNotification: mockShowNotification,
      isLoading: false,
      error: null,
    });

    const grantedRender = renderWithI18n(<NotificationPermissionPrompt />);
    expect(grantedRender.container.firstChild).toBeNull();
    grantedRender.unmount();

    vi.mocked(useNotificationsModule.useNotifications).mockReturnValue({
      permission: "denied",
      isSupported: true,
      requestPermission: mockRequestPermission,
      showNotification: mockShowNotification,
      isLoading: false,
      error: null,
    });

    const deniedRender = renderWithI18n(<NotificationPermissionPrompt />);
    expect(deniedRender.container.firstChild).toBeNull();
    deniedRender.unmount();

    vi.mocked(useNotificationsModule.useNotifications).mockReturnValue({
      permission: "default",
      isSupported: false,
      requestPermission: mockRequestPermission,
      showNotification: mockShowNotification,
      isLoading: false,
      error: null,
    });

    const unsupportedRender = renderWithI18n(<NotificationPermissionPrompt />);
    expect(unsupportedRender.container.firstChild).toBeNull();
  });

  it("requests permission and shows a confirmation notification after enabling", async () => {
    const user = userEvent.setup();
    mockRequestPermission.mockResolvedValue("granted");

    renderWithI18n(<NotificationPermissionPrompt />);

    await user.click(screen.getByRole("button", { name: /enable/i }));

    await waitFor(() => {
      expect(mockRequestPermission).toHaveBeenCalledOnce();
      expect(mockShowNotification).toHaveBeenCalledWith({
        title: "Notifications Enabled",
        body: "You'll now receive important updates from SecPal",
      });
    });
  });

  it("maps stale runtime errors to a safe deployment-reset message", async () => {
    const user = userEvent.setup();
    let permission: NotificationPermission = "default";

    vi.mocked(useNotificationsModule.useNotifications).mockImplementation(
      () => ({
        permission,
        isSupported: true,
        requestPermission: mockRequestPermission,
        showNotification: mockShowNotification,
        isLoading: false,
        error: null,
      })
    );
    mockRequestPermission.mockImplementation(async () => {
      permission = "granted";
      throw new NotificationInstallationsApiError(
        "Notification runtime metadata changed; refresh bootstrap before retrying this installation update.",
        409,
        "NOTIFICATION_RUNTIME_STATE_INVALID"
      );
    });

    renderWithI18n(<NotificationPermissionPrompt />);

    await user.click(screen.getByRole("button", { name: /enable/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          /this deployment's notification configuration changed\. refresh secpal and enable notifications again if the browser prompts you/i
        )
      ).toBeInTheDocument();
    });
  });

  it("maps re-authentication failures to a sign-in-again message", async () => {
    const user = userEvent.setup();
    let permission: NotificationPermission = "default";

    vi.mocked(useNotificationsModule.useNotifications).mockImplementation(
      () => ({
        permission,
        isSupported: true,
        requestPermission: mockRequestPermission,
        showNotification: mockShowNotification,
        isLoading: false,
        error: null,
      })
    );
    mockRequestPermission.mockImplementation(async () => {
      permission = "granted";
      throw new NotificationInstallationsApiError("Unauthenticated.", 401);
    });

    renderWithI18n(<NotificationPermissionPrompt />);

    await user.click(screen.getByRole("button", { name: /enable/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/sign in again before secpal can sync this browser/i)
      ).toBeInTheDocument();
    });
  });

  it("translates deployment-unavailable errors instead of showing the raw fallback message", async () => {
    const user = userEvent.setup();

    i18n.activate("de");
    mockRequestPermission.mockRejectedValue(
      new NotificationDeploymentUnavailableError()
    );

    renderWithI18n(<NotificationPermissionPrompt />);

    await user.click(screen.getByRole("button", { name: /aktivieren/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          /dieses deployment veröffentlicht derzeit kein browser-web-push/i
        )
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText(
        /web push notifications are not available for this deployment/i
      )
    ).not.toBeInTheDocument();
  });

  it("hides the prompt after dismissal", async () => {
    const user = userEvent.setup();

    renderWithI18n(<NotificationPermissionPrompt />);

    await user.click(screen.getByRole("button", { name: /not now/i }));

    expect(
      screen.queryByText(/enable browser notifications/i)
    ).not.toBeInTheDocument();
  });
});
