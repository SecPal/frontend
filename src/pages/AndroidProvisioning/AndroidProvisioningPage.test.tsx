// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import type {
  AndroidEnrollmentSession,
  AndroidEnrollmentSessionListResponse,
} from "@/types/api";
import AndroidProvisioningPage from "./AndroidProvisioningPage";
import * as androidEnrollmentApi from "../../services/androidEnrollmentApi";

const { mockUseUserCapabilities } = vi.hoisted(() => ({
  mockUseUserCapabilities: vi.fn(),
}));

vi.mock("../../services/androidEnrollmentApi");
vi.mock("../../hooks/useUserCapabilities", () => ({
  useUserCapabilities: mockUseUserCapabilities,
}));
vi.mock("../../components/MfaQrCode", () => ({
  MfaQrCode: ({ value, alt }: { value: string; alt: string }) => (
    <div aria-label={alt} data-testid="android-provisioning-qr">
      {value}
    </div>
  ),
}));

const QUERY_TIMEOUT = 15000;

const mockSession: AndroidEnrollmentSession = {
  id: "session-1",
  device_label: "Front desk tablet",
  status: "pending",
  enrollment_mode: "device_owner",
  update_channel: "managed_device",
  release_metadata_url: "https://apk.secpal.app/android/channels/managed_device/latest.json",
  provisioning_profile: {
    kiosk_mode_enabled: true,
    lock_task_enabled: true,
    allow_phone: false,
    allow_sms: false,
    prefer_gesture_navigation: true,
    allowed_packages: ["app.secpal"],
  },
  bootstrap_token_expires_at: "2026-04-06T13:00:00Z",
  bootstrap_token_last_eight: "ABCDEF12",
  exchanged_at: null,
  revoked_at: null,
  revocation_reason: null,
  notes: "Lobby enrollment",
  created_at: "2026-04-06T12:45:00Z",
  updated_at: "2026-04-06T12:45:00Z",
};

const mockListResponse: AndroidEnrollmentSessionListResponse = {
  data: [mockSession],
  links: {
    first: null,
    last: null,
    prev: null,
    next: null,
  },
  meta: {
    current_page: 1,
    from: 1,
    last_page: 1,
    path: "/v1/admin/android-enrollment-sessions",
    per_page: 15,
    to: 1,
    total: 1,
  },
};

const createdSession: AndroidEnrollmentSession = {
  ...mockSession,
  id: "session-2",
  device_label: "Warehouse tablet",
  bootstrap_token_last_eight: "ZXCVBN12",
};

const renderWithProviders = () => {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>
        <AndroidProvisioningPage />
      </MemoryRouter>
    </I18nProvider>
  );
};

describe("AndroidProvisioningPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");

    vi.mocked(androidEnrollmentApi.listAndroidEnrollmentSessions).mockResolvedValue(
      mockListResponse
    );
    vi.mocked(
      androidEnrollmentApi.createAndroidEnrollmentSession
    ).mockResolvedValue({
      session: createdSession,
      provisioning_qr_payload:
        "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE=bootstrap",
    });
    vi.mocked(
      androidEnrollmentApi.revokeAndroidEnrollmentSession
    ).mockResolvedValue(mockSession);

    mockUseUserCapabilities.mockReturnValue({
      androidProvisioning: true,
      actions: {
        androidProvisioning: { create: true, revoke: true },
      },
    });
  });

  it("renders the enrollment session list for authorized users", async () => {
    renderWithProviders();

    expect(
      await screen.findByText("Front desk tablet", undefined, {
        timeout: QUERY_TIMEOUT,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create enrollment session/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/pending/i).length).toBeGreaterThan(0);
  });

  it("hides create and revoke actions for read-only users", async () => {
    mockUseUserCapabilities.mockReturnValue({
      androidProvisioning: true,
      actions: {
        androidProvisioning: { create: false, revoke: false },
      },
    });

    renderWithProviders();

    expect(
      await screen.findByText("Front desk tablet", undefined, {
        timeout: QUERY_TIMEOUT,
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /create enrollment session/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /revoke/i })
    ).not.toBeInTheDocument();
  });

  it("creates an enrollment session and displays its QR payload", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await screen.findByText("Front desk tablet", undefined, {
      timeout: QUERY_TIMEOUT,
    });

    await user.clear(screen.getByLabelText(/device label/i));
    await user.type(screen.getByLabelText(/device label/i), "Warehouse tablet");
    await user.click(
      screen.getByRole("button", { name: /create enrollment session/i })
    );

    await waitFor(() => {
      expect(
        androidEnrollmentApi.createAndroidEnrollmentSession
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          device_label: "Warehouse tablet",
          update_channel: "managed_device",
        })
      );
    });

    expect(
      await screen.findByRole("heading", { name: /provisioning qr code/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("android-provisioning-qr")).toHaveTextContent(
      "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE=bootstrap"
    );
  });

  it("revokes a pending enrollment session", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await screen.findByText("Front desk tablet", undefined, {
      timeout: QUERY_TIMEOUT,
    });

    await user.click(screen.getByRole("button", { name: /revoke/i }));
    await user.type(
      screen.getByLabelText(/revocation reason/i),
      "Device replaced"
    );
    await user.click(screen.getByRole("button", { name: /confirm revoke/i }));

    await waitFor(() => {
      expect(
        androidEnrollmentApi.revokeAndroidEnrollmentSession
      ).toHaveBeenCalledWith("session-1", {
        reason: "Device replaced",
      });
    });
  });
});
