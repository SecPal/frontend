// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiConfig } from "../../config";
import type { UserCapabilities } from "../../lib/capabilities";
import AndroidProvisioningPage from "./AndroidProvisioningPage";
import { apiFetch } from "../../services/csrf";
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
    render(
      <I18nProvider i18n={i18n}>
        <AndroidProvisioningPage />
      </I18nProvider>
    );

    expect(await screen.findByText("Front desk tablet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create enrollment session/i })
    ).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith(
      `${apiConfig.baseUrl}/v1/admin/android-enrollment-sessions?per_page=15`,
      expect.objectContaining({ headers: { Accept: "application/json" } })
    );
  });
});
