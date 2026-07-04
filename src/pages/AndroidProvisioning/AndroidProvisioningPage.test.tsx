// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiConfig } from "../../config";
import type { UserCapabilities } from "../../lib/capabilities";
import AndroidProvisioningPage from "./AndroidProvisioningPage";
import { apiFetch } from "../../services/csrf";
import { ApiError } from "../../services/ApiError";
import * as capabilitiesHook from "../../hooks/useUserCapabilities";

vi.mock("../../services/csrf", () => ({ apiFetch: vi.fn() }));
vi.mock("../../hooks/useUserCapabilities");

const capabilities: UserCapabilities = {
  home: true,
  profile: true,
  settings: true,
  organization: true,
  customers: true,
  sites: true,
  employees: true,
  activityLogs: true,
  androidProvisioning: true,
  actions: {
    androidProvisioning: { create: true, revoke: true },
    customers: { create: true, update: true, delete: true },
    sites: { create: true, update: true, delete: true },
    employees: {
      create: true,
      update: true,
      delete: true,
      activate: true,
      confirmOnboarding: true,
      terminate: true,
    },
  },
};

function renderPage() {
  return render(
    <I18nProvider i18n={i18n}>
      <AndroidProvisioningPage />
    </I18nProvider>
  );
}

async function selectRadixOption(triggerName: RegExp, optionName: RegExp) {
  const trigger = screen.getByRole("combobox", { name: triggerName });
  fireEvent.pointerDown(trigger, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.pointerUp(trigger, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.click(trigger, { button: 0 });

  const option = await screen.findByRole("option", { name: optionName });
  expect(option).toHaveAttribute("data-value");
  fireEvent.pointerDown(option, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.pointerUp(option, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.click(option, { button: 0 });
}

describe("AndroidProvisioningPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");
    vi.mocked(capabilitiesHook.useUserCapabilities).mockReturnValue(
      capabilities
    );
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "session-1",
            device_label: "Front desk tablet",
            status: "pending",
            update_channel: "managed_device",
            bootstrap_token_expires_at: "2026-04-07T12:00:00Z",
            revoked_at: null,
            revocation_reason: null,
          },
        ],
      }),
    } as Response);
  });

  it("renders bootstrap token expiry with seconds included", async () => {
    renderPage();

    await screen.findByText("Front desk tablet");
    // Regression: seconds must not be silently dropped from expiry timestamps.
    // The fixture value is "2026-04-07T12:00:00Z"; the formatted output must
    // contain an HH:MM:SS segment regardless of locale's separator characters.
    // Using queryAllByText avoids a throw-on-miss that would mask the real
    // assertion failure when second: "2-digit" is accidentally removed.
    const expiries = screen.queryAllByText(/\d{2}:\d{2}:\d{2}/);
    expect(expiries.length).toBeGreaterThan(0);
  });

  it("loads and renders Android enrollment sessions", async () => {
    renderPage();

    expect(await screen.findByText("Front desk tablet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create enrollment session/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /update channel/i })
    ).toHaveAttribute("data-slot", "select-trigger");
    expect(apiFetch).toHaveBeenCalledWith(
      `${apiConfig.baseUrl}/v1/android-enrollment-sessions?per_page=15`,
      expect.objectContaining({ headers: expect.any(Headers) })
    );
    const [, init] = vi.mocked(apiFetch).mock.calls[0]!;
    expect((init!.headers as Headers).get("Accept")).toBe("application/json");
  });

  it("keeps the provisioning surfaces on canonical theme tokens", async () => {
    renderPage();

    const heading = await screen.findByRole("heading", {
      name: /android provisioning/i,
    });

    expect(heading).toHaveClass("text-foreground");
    expect(screen.getByText("Front desk tablet")).toHaveClass(
      "text-foreground"
    );
    expect(
      screen.getByText(
        "Use this QR code during Android setup before it expires."
      )
    ).toHaveClass("text-muted-foreground");

    const sessionsCard = screen
      .getByRole("heading", { name: /enrollment sessions/i })
      .closest('[data-slot="card"]');
    const sessionRow = screen
      .getByText("Front desk tablet")
      .closest("div.rounded-md");

    expect(sessionsCard).toHaveClass("bg-card", "text-card-foreground");
    expect(sessionRow).toHaveClass("border-border");
    expect(sessionRow).not.toHaveClass(
      "border-zinc-200",
      "dark:border-zinc-800"
    );
  });

  it("keeps the form and sessions heading visible while sessions initially load", () => {
    vi.mocked(apiFetch).mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(
      screen.getByRole("heading", { name: /android provisioning/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Device label")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /enrollment sessions/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /loading enrollment sessions/i })
    ).toBeInTheDocument();
  });

  it("keeps enrollment session status badges on canonical text tokens", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "session-pending",
            device_label: "Pending device",
            status: "pending",
            update_channel: "managed_device",
            bootstrap_token_expires_at: "2026-04-07T12:00:00Z",
            revoked_at: null,
            revocation_reason: null,
          },
          {
            id: "session-exchanged",
            device_label: "Exchanged device",
            status: "exchanged",
            update_channel: "managed_device",
            bootstrap_token_expires_at: "2026-04-07T12:00:00Z",
            revoked_at: null,
            revocation_reason: null,
          },
          {
            id: "session-revoked",
            device_label: "Revoked device",
            status: "revoked",
            update_channel: "managed_device",
            bootstrap_token_expires_at: "2026-04-07T12:00:00Z",
            revoked_at: "2026-04-06T09:00:00Z",
            revocation_reason: "Security review",
          },
          {
            id: "session-expired",
            device_label: "Expired device",
            status: "expired",
            update_channel: "managed_device",
            bootstrap_token_expires_at: "2026-04-05T12:00:00Z",
            revoked_at: null,
            revocation_reason: null,
          },
        ],
      }),
    } as Response);

    renderPage();

    const pending = await screen.findByText("Ready for setup");
    const exchanged = screen.getByText("Bootstrap completed");
    const revoked = screen
      .getAllByText("Revoked")
      .find((element) => element.className.includes("bg-rose-400/15"));
    const expired = screen.getByText("Expired");

    expect(revoked).toBeDefined();
    expect(pending).toHaveClass("bg-sky-500/15", "text-foreground");
    expect(exchanged).toHaveClass("bg-lime-400/20", "text-foreground");
    expect(revoked!).toHaveClass("bg-rose-400/15", "text-foreground");
    expect(expired).toHaveClass("bg-amber-400/20", "text-foreground");

    expect(pending.className).not.toContain("text-sky-700");
    expect(exchanged.className).not.toContain("text-lime-700");
    expect(revoked!.className).not.toContain("text-rose-700");
    expect(expired.className).not.toContain("text-amber-700");
  });

  it("renders human-readable session state and rollout guidance", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "session-1",
            device_label: "Front desk tablet",
            status: "pending",
            update_channel: "managed_device",
            bootstrap_token_expires_at: "2026-04-07T12:00:00Z",
            revoked_at: null,
            revocation_reason: null,
          },
          {
            id: "session-2",
            device_label: "Warehouse spare device",
            status: "revoked",
            update_channel: "github_release",
            bootstrap_token_expires_at: "2026-04-06T10:00:00Z",
            revoked_at: "2026-04-06T09:00:00Z",
            revocation_reason: "Token exposed",
          },
        ],
      }),
    } as Response);

    renderPage();

    expect(
      await screen.findAllByText("Managed device rollout")
    ).not.toHaveLength(0);
    expect(screen.getByText("Ready for setup")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Use this QR code during Android setup before it expires."
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText("GitHub Releases").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "This session was revoked and can no longer be used for device setup."
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Token exposed/)).toBeInTheDocument();
    expect(screen.queryByText("managed_device")).not.toBeInTheDocument();
    expect(screen.queryByText(/^pending$/i)).not.toBeInTheDocument();
  });

  it("renders exchanged and expired session guidance", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "session-1",
            device_label: "Reception kiosk",
            status: "exchanged",
            update_channel: "direct_apk",
            bootstrap_token_expires_at: "2026-04-07T12:00:00Z",
            revoked_at: null,
            revocation_reason: null,
          },
          {
            id: "session-2",
            device_label: null,
            status: "expired",
            update_channel: "obtainium",
            bootstrap_token_expires_at: "2026-04-06T10:00:00Z",
            revoked_at: null,
            revocation_reason: null,
          },
        ],
      }),
    } as Response);

    renderPage();

    expect(await screen.findByText("Direct APK sideload")).toBeInTheDocument();
    expect(screen.getByText("Bootstrap completed")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This session has already been used to complete device bootstrap."
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText("Obtainium").length).toBeGreaterThan(0);
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This session expired before setup completed. Create a new session to continue."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Unnamed Android enrollment session")
    ).toBeInTheDocument();
  });

  it("shows a load error when sessions cannot be fetched", async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error("network down"));

    renderPage();

    const loadError = await screen.findByText("network down");
    expect(loadError).toBeInTheDocument();
    expect(loadError).toHaveAttribute("data-slot", "alert-description");
    expect(loadError.closest('[data-slot="alert"]')).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );
    expect(loadError.closest('[data-slot="alert"]')).toHaveClass(
      "text-foreground"
    );
  });

  it("creates a session and renders the provisioning QR state", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            session: {
              id: "session-2",
              device_label: "Reception kiosk",
              status: "pending",
              update_channel: "managed_device",
              bootstrap_token_expires_at: "2026-04-07T13:00:00Z",
              revoked_at: null,
              revocation_reason: null,
            },
            provisioning_qr_payload: {
              "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME":
                "app.secpal/.SecPalDeviceAdminReceiver",
              "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
                bootstrap_token: "tok-abc",
                enrollment_session_id: "session-2",
              },
            },
          },
        }),
      } as Response);

    renderPage();

    expect(
      await screen.findByRole("button", { name: /create enrollment session/i })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Device label"), {
      target: { value: "Reception kiosk" },
    });
    await selectRadixOption(/update channel/i, /direct apk sideload/i);
    fireEvent.click(
      screen.getByRole("button", { name: /create enrollment session/i })
    );

    expect(await screen.findByText("Provisioning QR code")).toBeInTheDocument();
    expect(
      await screen.findByAltText("Android provisioning QR code")
    ).toBeInTheDocument();
    expect(screen.getAllByText("Reception kiosk")).toHaveLength(2);
    expect(apiFetch).toHaveBeenLastCalledWith(
      `${apiConfig.baseUrl}/v1/android-enrollment-sessions`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          device_label: "Reception kiosk",
          provisioning_profile: {
            kiosk_mode_enabled: true,
            lock_task_enabled: true,
            allow_phone: false,
            allow_sms: false,
            prefer_gesture_navigation: true,
            allowed_packages: ["app.secpal"],
          },
          update_channel: "direct_apk",
        }),
      })
    );
  });

  it("shows a submit error when creating a session fails", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response)
      .mockRejectedValueOnce(
        new ApiError("create failed", 422, {}, new Response())
      );

    renderPage();

    expect(
      await screen.findByRole("button", { name: /create enrollment session/i })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /create enrollment session/i })
    );

    const submitError = await screen.findByText("create failed");
    expect(submitError).toBeInTheDocument();
    expect(submitError).toHaveAttribute("data-slot", "alert-description");
    expect(submitError.closest('[data-slot="alert"]')).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );
    expect(submitError.closest('[data-slot="alert"]')).toHaveClass(
      "text-foreground"
    );
  });

  it("revokes a pending session when the user submits a revocation reason", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "session-1",
              device_label: "Front desk tablet",
              status: "pending",
              update_channel: "managed_device",
              bootstrap_token_expires_at: "2026-04-07T12:00:00Z",
              revoked_at: null,
              revocation_reason: null,
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: "session-1",
            device_label: "Front desk tablet",
            status: "revoked",
            update_channel: "managed_device",
            bootstrap_token_expires_at: "2026-04-07T12:00:00Z",
            revoked_at: "2026-04-06T12:00:00Z",
            revocation_reason: "Device retired",
          },
        }),
      } as Response);

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Revoke" }));
    expect(
      screen.getByRole("heading", { name: /revoke enrollment session/i })
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(/revocation reason/i),
      "Device retired"
    );
    await user.click(screen.getByRole("button", { name: /^revoke$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Device retired/)).toBeInTheDocument();
    });
    expect(apiFetch).toHaveBeenLastCalledWith(
      `${apiConfig.baseUrl}/v1/android-enrollment-sessions/session-1/revoke`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "Device retired" }),
      })
    );
  });

  it("does not revoke a session when no reason is provided", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Revoke" }));
    await user.click(screen.getByRole("button", { name: /^revoke$/i }));

    expect(
      await screen.findByText(/revocation reason is required/i)
    ).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("shows a fallback error when revoking a session fails unexpectedly", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "session-1",
              device_label: "Front desk tablet",
              status: "pending",
              update_channel: "managed_device",
              bootstrap_token_expires_at: "2026-04-07T12:00:00Z",
              revoked_at: null,
              revocation_reason: null,
            },
          ],
        }),
      } as Response)
      .mockRejectedValueOnce({});

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Revoke" }));
    await user.type(
      screen.getByLabelText(/revocation reason/i),
      "Device retired"
    );
    await user.click(screen.getByRole("button", { name: /^revoke$/i }));

    expect(
      await screen.findByText("Failed to revoke Android enrollment session")
    ).toBeInTheDocument();
    expect(screen.getByText("Front desk tablet")).toBeInTheDocument();
  });

  it("shows a read-only message when create permission is missing", async () => {
    vi.mocked(capabilitiesHook.useUserCapabilities).mockReturnValue({
      ...capabilities,
      actions: {
        ...capabilities.actions,
        androidProvisioning: { create: false, revoke: false },
      },
    });

    renderPage();

    expect(
      await screen.findByText(/write permission is required/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /create enrollment session/i })
    ).not.toBeInTheDocument();
  });

  it("renders defensive fallback labels for unknown channel and status values", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "session-future",
            device_label: "Future device",
            // Cast to bypass type checks: simulates a future API value this
            // client version doesn't know about yet.
            status: "future_status" as "pending",
            update_channel: "future_channel" as "managed_device",
            bootstrap_token_expires_at: "2026-04-07T12:00:00Z",
            revoked_at: null,
            revocation_reason: null,
          },
        ],
      }),
    } as Response);

    renderPage();

    expect(
      await screen.findByText("Unknown channel (future_channel)")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Unknown status (future_status)")
    ).toBeInTheDocument();
    // Unknown statuses produce no operator guidance text.
    expect(screen.queryByText(/use this qr code/i)).not.toBeInTheDocument();
  });
});
