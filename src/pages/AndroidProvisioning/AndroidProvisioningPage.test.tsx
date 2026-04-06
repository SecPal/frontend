// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("loads and renders Android enrollment sessions", async () => {
    renderPage();

    expect(await screen.findByText("Front desk tablet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create enrollment session/i })
    ).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith(
      `${apiConfig.baseUrl}/v1/admin/android-enrollment-sessions?per_page=15`,
      expect.objectContaining({ headers: { Accept: "application/json" } })
    );
  });

  it("shows a load error when sessions cannot be fetched", async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error("network down"));

    renderPage();

    expect(await screen.findByText("network down")).toBeInTheDocument();
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
            provisioning_qr_payload: "qr-payload",
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
    fireEvent.click(
      screen.getByRole("button", { name: /create enrollment session/i })
    );

    expect(await screen.findByText("Provisioning QR code")).toBeInTheDocument();
    expect(
      await screen.findByAltText("Android provisioning QR code")
    ).toBeInTheDocument();
    expect(screen.getAllByText("Reception kiosk")).toHaveLength(2);
    expect(apiFetch).toHaveBeenLastCalledWith(
      `${apiConfig.baseUrl}/v1/admin/android-enrollment-sessions`,
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
          update_channel: "managed_device",
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

    expect(await screen.findByText("create failed")).toBeInTheDocument();
  });

  it("revokes a pending session when the user confirms a reason", async () => {
    const promptSpy = vi
      .spyOn(window, "prompt")
      .mockReturnValue("Device retired");

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

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));

    await waitFor(() => {
      expect(screen.getByText(/Device retired/)).toBeInTheDocument();
    });
    expect(promptSpy).toHaveBeenCalled();
    promptSpy.mockRestore();
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
});
