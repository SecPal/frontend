// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

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
    const unsupportedStatus = screen
      .getByText(/browser cannot receive secpal web push notifications/i)
      .closest("div");
    const unsupportedText = screen.getByText(
      /browser cannot receive secpal web push notifications/i
    );
    expect(unsupportedStatus).toHaveClass(
      "border-amber-500/30",
      "bg-amber-500/10"
    );
    expect(unsupportedText).toHaveClass("text-foreground");
    expect(unsupportedText.className).not.toContain("text-amber-700");
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

    const blockedMessage = screen.getByText(
      /browser notifications are blocked for this site/i
    );
    expect(blockedMessage).toBeInTheDocument();
    expect(blockedMessage.closest('[data-slot="alert"]')).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );
  });

  it("shows the auth error message instead of blocked-browser guidance when permission is denied but a 401 error is present", async () => {
    mockUseNotifications.mockReturnValue({
      permission: "denied",
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
    expect(
      screen.queryByText(/browser notifications are blocked for this site/i)
    ).not.toBeInTheDocument();
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

    const pendingMessage = screen.getByText(
      /turn on notifications for this signed-in browser on the current secpal deployment/i
    );
    expect(pendingMessage).toBeInTheDocument();
    expect(pendingMessage.closest('[data-slot="alert"]')).toHaveClass(
      "border-primary/30",
      "bg-primary/10"
    );
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

  it("shows a generic sync message for unexpected registration errors", async () => {
    mockUseNotifications.mockReturnValue({
      permission: "granted",
      isSupported: true,
      requestPermission: mockRequestPermission,
      showNotification: mockShowNotification,
      isLoading: false,
      error: new Error("Unexpected push sync failure"),
    });

    await renderWithI18n(<NotificationPreferences />);

    expect(
      screen.getByText(
        /secpal could not sync this browser's notification registration with the server/i
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/unexpected push sync failure/i)
    ).not.toBeInTheDocument();
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

  it("does not crash when showNotification rejects after requestPermission succeeds", async () => {
    mockUseNotifications.mockReturnValue({
      permission: "default",
      isSupported: true,
      requestPermission: mockRequestPermission,
      showNotification: mockShowNotification,
      isLoading: false,
      error: null,
    });
    mockRequestPermission.mockResolvedValue("granted");
    mockShowNotification.mockRejectedValue(
      new Error("Service worker unavailable")
    );

    await renderWithI18n(<NotificationPreferences />);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: /enable notifications/i })
    );

    await waitFor(() => {
      expect(mockRequestPermission).toHaveBeenCalledOnce();
      expect(mockShowNotification).toHaveBeenCalledOnce();
    });
    // Component must remain rendered and not throw
    expect(
      screen.getByRole("heading", { name: /browser notifications/i })
    ).toBeInTheDocument();
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

  it("keeps notification preference surfaces on canonical theme tokens", async () => {
    await renderWithI18n(<NotificationPreferences />);

    const heading = screen.getByRole("heading", {
      name: /browser notifications/i,
    });
    const description = screen.getByText(
      /secpal only exposes backend-backed browser delivery state here/i
    );
    const sendTest = screen.getByRole("button", { name: /send test/i });
    const statusBox = screen
      .getByText(
        /browser notifications are enabled for this signed-in browser/i
      )
      .closest('[data-slot="alert"]');
    const rolloutBox = screen.getByRole("heading", {
      name: /rollout expectations/i,
    }).parentElement;
    const rolloutText = screen
      .getByText(/notifications are tied to this signed-in browser profile/i)
      .closest("ul");

    expect(rolloutText).not.toBeNull();
    expect(heading).toHaveClass("text-foreground");
    expect(description).toHaveClass("text-muted-foreground");
    expect(sendTest).toHaveClass("bg-background");
    expect(statusBox).toHaveClass("border-emerald-500/30", "bg-emerald-500/10");
    expect(statusBox).toHaveAttribute("data-slot", "alert");
    expect(rolloutBox).toHaveClass("border-border");
    expect(rolloutText).toHaveClass("text-muted-foreground");

    expect(heading.className).not.toContain("text-zinc-950");
    expect(description.className).not.toContain("text-zinc-500");
    expect(sendTest.className).not.toContain("bg-blue-600");
    expect(statusBox?.className).not.toContain("bg-green-50");
    expect(rolloutBox?.className).not.toContain("border-zinc-200");
    expect(rolloutText?.className).not.toContain("text-zinc-600");
  });
});
