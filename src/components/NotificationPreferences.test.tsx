// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as deMessages } from "@/locales/de/messages.mjs";
import { messages as enMessages } from "@/locales/en/messages.mjs";
import { NotificationInstallationsApiError } from "@/services/notificationInstallationsApi";
import { NotificationDeploymentUnavailableError } from "@/hooks/useNotifications";
import { NotificationPreferences } from "./NotificationPreferences";
import * as useNotificationsModule from "@/hooks/useNotifications";

const mockUseNotifications = vi.spyOn(
  useNotificationsModule,
  "useNotifications"
);

const renderWithI18n = async (component: React.ReactElement) => {
  const result = render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
  await waitFor(() => {});
  return result;
};

describe("NotificationPreferences", () => {
  const mockRequestPermission = vi.fn();
  const mockShowNotification = vi.fn();

  beforeAll(() => {
    i18n.load("en", enMessages);
    i18n.load("de", deMessages);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    i18n.activate("en");

    mockUseNotifications.mockReturnValue({
      permission: "granted",
      isSupported: true,
      requestPermission: mockRequestPermission,
      showNotification: mockShowNotification,
      isLoading: false,
      error: null,
    });
  });

  it("shows explicit unsupported-browser guidance", async () => {
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
      screen.getByText(/browser cannot receive secpal web push notifications/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/chrome, edge, firefox, or safari/i)
    ).toBeInTheDocument();
  });

  it("shows a truthful browser-scoped status instead of category toggles", async () => {
    await renderWithI18n(<NotificationPreferences />);

    expect(
      screen.getByRole("heading", { name: /browser notifications/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /category-specific notification preferences are not available yet/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /browser notifications are enabled for this signed-in browser on this deployment/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/https and a same-origin service worker are required/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /changing deployment domains, service-worker scope, site data, or signing out/i
      )
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("shows blocked-browser guidance when permission is denied", async () => {
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
      screen.getByText(/browser notifications are blocked for this site/i)
    ).toBeInTheDocument();
  });

  it("lets the user enable browser notifications when permission is undecided", async () => {
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
      screen.getByText(
        /turn on notifications for this signed-in browser on the current secpal deployment/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /enable notifications/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /send test/i })
    ).not.toBeInTheDocument();
  });

  it("requests permission and sends a confirmation notification after enabling", async () => {
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

    await user.click(
      screen.getByRole("button", { name: /enable notifications/i })
    );

    await waitFor(() => {
      expect(mockRequestPermission).toHaveBeenCalledOnce();
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          tag: "welcome-notification",
        })
      );
    });
  });

  it("surfaces deployment reset guidance when runtime metadata becomes stale", async () => {
    mockUseNotifications.mockReturnValue({
      permission: "granted",
      isSupported: true,
      requestPermission: mockRequestPermission,
      showNotification: mockShowNotification,
      isLoading: false,
      error: new NotificationInstallationsApiError(
        "Notification runtime metadata changed; refresh bootstrap before retrying this installation update.",
        409,
        "NOTIFICATION_RUNTIME_STATE_INVALID"
      ),
    });

    await renderWithI18n(<NotificationPreferences />);

    expect(
      screen.getByText(/deployment's notification configuration changed/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /refresh secpal and enable notifications again if the browser prompts you/i
      )
    ).toBeInTheDocument();
  });

  it("asks the user to sign in again when backend sync requires re-authentication", async () => {
    mockUseNotifications.mockReturnValue({
      permission: "granted",
      isSupported: true,
      requestPermission: mockRequestPermission,
      showNotification: mockShowNotification,
      isLoading: false,
      error: new NotificationInstallationsApiError("Unauthenticated.", 401),
    });

    await renderWithI18n(<NotificationPreferences />);

    expect(
      screen.getByText(/sign in again before secpal can sync this browser/i)
    ).toBeInTheDocument();
  });

  it("makes deployment rollout limits explicit when web push is unavailable for the deployment", async () => {
    mockUseNotifications.mockReturnValue({
      permission: "granted",
      isSupported: true,
      requestPermission: mockRequestPermission,
      showNotification: mockShowNotification,
      isLoading: false,
      error: new NotificationDeploymentUnavailableError(),
    });

    await renderWithI18n(<NotificationPreferences />);

    expect(
      screen.getByText(
        /this deployment does not currently publish browser web push/i
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText(/selected deployment domain/i)).not.toHaveLength(
      0
    );
  });

  it("still lets the user send a test notification after browser delivery is enabled", async () => {
    mockShowNotification.mockResolvedValue(undefined);

    await renderWithI18n(<NotificationPreferences />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /send test/i }));

    await waitFor(() => {
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          tag: "test-notification",
          requireInteraction: false,
        })
      );
    });
  });
});
