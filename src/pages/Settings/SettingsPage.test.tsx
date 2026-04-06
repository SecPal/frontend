// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { SettingsPage } from "./SettingsPage";
import * as i18nModule from "../../i18n";
import * as authApi from "../../services/authApi";

vi.mock("../../components/MfaQrCode", () => ({
  MfaQrCode: ({ value, alt }: { value: string; alt: string }) => (
    <div data-testid="mfa-qr-code" aria-label={alt}>
      {value}
    </div>
  ),
}));

// Mock the i18n module
vi.mock("../../i18n", async () => {
  const actual = await vi.importActual("../../i18n");
  return {
    ...actual,
    activateLocale: vi.fn(),
    setLocalePreference: vi.fn(),
    locales: { en: "English", de: "Deutsch" },
  };
});

vi.mock("../../services/authApi", async () => {
  const actual = await vi.importActual("../../services/authApi");
  return {
    ...actual,
    deletePasskey: vi.fn(),
    getPasskeys: vi.fn(),
    getMfaStatus: vi.fn(),
    startTotpEnrollment: vi.fn(),
    confirmTotpEnrollment: vi.fn(),
    regenerateRecoveryCodes: vi.fn(),
    disableMfa: vi.fn(),
  };
});

// Helper to render with all required providers
const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>{component}</MemoryRouter>
    </I18nProvider>
  );
};

async function renderSettingsPage() {
  renderWithProviders(<SettingsPage />);
  await screen.findByText(/not enabled/i);
}

function createDisabledMfaStatusResponse() {
  return {
    data: {
      enabled: false,
      method: null,
      recovery_codes_remaining: 0,
      recovery_codes_generated_at: null,
      enrolled_at: null,
    },
  };
}

function createEnabledMfaStatusResponse() {
  return {
    data: {
      enabled: true,
      method: "totp" as const,
      recovery_codes_remaining: 10,
      recovery_codes_generated_at: "2026-04-01T09:12:00Z",
      enrolled_at: "2026-04-01T09:10:00Z",
    },
  };
}

function createRecoveryRevealResponse() {
  return {
    data: {
      status: createEnabledMfaStatusResponse().data,
      recovery_codes: {
        codes: [
          "B6F42Q8P",
          "F9LM7N2R",
          "HT4V3KQ1",
          "J8PW6CX5",
          "M2TR9DZ7",
          "Q4YS8LB2",
          "V7NK5HF9",
          "X3CE1RM6",
        ],
        generated_at: "2026-04-01T09:12:00Z",
      },
    },
  };
}

function createTotpEnrollmentPreparationResponse() {
  return {
    data: {
      issuer: "SecPal",
      account_name: "mfa@secpal.dev",
      manual_entry_key: "JBSWY3DPEHPK3PXP",
      otpauth_uri:
        "otpauth://totp/SecPal:mfa@secpal.dev?secret=JBSWY3DPEHPK3PXP&issuer=SecPal",
      expires_at: "2026-04-05T12:30:00Z",
    },
  };
}

function createPasskeyListResponse() {
  return {
    data: [
      {
        id: "credential-id",
        label: "Work MacBook Touch ID",
        created_at: "2026-04-06T09:12:00Z",
        last_used_at: null,
        transports: ["internal" as const],
      },
    ],
  };
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup i18n with English locale
    i18n.load("en", {});
    i18n.activate("en");
    vi.mocked(authApi.getMfaStatus).mockResolvedValue(
      createDisabledMfaStatusResponse()
    );
    vi.mocked(authApi.getPasskeys).mockResolvedValue(
      createPasskeyListResponse()
    );
    Object.defineProperty(window, "PublicKeyCredential", {
      configurable: true,
      writable: true,
      value: function PublicKeyCredential() {},
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
  });

  it("renders the settings page with heading", async () => {
    await renderSettingsPage();

    expect(
      screen.getByRole("heading", { name: /settings/i })
    ).toBeInTheDocument();
  });

  it("lists enrolled passkeys", async () => {
    await renderSettingsPage();

    expect(
      await screen.findByRole("heading", { name: /passkeys/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/work macbook touch id/i)
    ).toBeInTheDocument();
  });

  it("shows an empty passkey state when no credentials are enrolled", async () => {
    vi.mocked(authApi.getPasskeys).mockResolvedValueOnce({ data: [] });

    await renderSettingsPage();

    expect(
      await screen.findByText(/no passkeys enrolled yet/i)
    ).toBeInTheDocument();
  });

  it("shows passkey loading errors returned by the API", async () => {
    vi.mocked(authApi.getPasskeys).mockRejectedValueOnce(
      new authApi.AuthApiError("Failed to load passkeys.")
    );

    await renderSettingsPage();

    expect(
      await screen.findByText(/failed to load passkeys/i)
    ).toBeInTheDocument();
  });

  it("shows a fallback passkey loading error for unexpected failures", async () => {
    vi.mocked(authApi.getPasskeys).mockRejectedValueOnce("unexpected");

    await renderSettingsPage();

    expect(
      await screen.findByText(/failed to load passkeys/i)
    ).toBeInTheDocument();
  });

  it("shows an unsupported passkey message without hiding the enrolled list", async () => {
    Object.defineProperty(window, "PublicKeyCredential", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    await renderSettingsPage();

    expect(
      screen.getByText(/this browser does not support passkeys/i)
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/work macbook touch id/i)
    ).toBeInTheDocument();
  });

  it("removes an enrolled passkey and refreshes the list", async () => {
    vi.mocked(authApi.deletePasskey).mockResolvedValueOnce({
      message: "Passkey deleted successfully.",
      data: { remaining_passkeys: 0 },
    });
    vi.mocked(authApi.getPasskeys)
      .mockResolvedValueOnce(createPasskeyListResponse())
      .mockResolvedValueOnce({ data: [] });

    await renderSettingsPage();
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));

    await waitFor(() => {
      expect(authApi.deletePasskey).toHaveBeenCalledWith("credential-id");
      expect(authApi.getPasskeys).toHaveBeenCalledTimes(2);
    });

    expect(
      screen.queryByText(/work macbook touch id/i)
    ).not.toBeInTheDocument();
    expect(screen.getByText(/no passkeys enrolled yet/i)).toBeInTheDocument();
  });

  it("shows a busy state while passkey removal is in flight", async () => {
    let resolveDeletion:
      | ((value: {
          message: string;
          data: { remaining_passkeys: number };
        }) => void)
      | undefined;

    vi.mocked(authApi.deletePasskey).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDeletion = resolve;
        })
    );
    vi.mocked(authApi.getPasskeys)
      .mockResolvedValueOnce(createPasskeyListResponse())
      .mockResolvedValueOnce({ data: [] });

    await renderSettingsPage();

    fireEvent.click(screen.getByRole("button", { name: /remove/i }));

    expect(screen.getByRole("button", { name: /removing/i })).toBeDisabled();

    resolveDeletion?.({
      message: "Passkey deleted successfully.",
      data: { remaining_passkeys: 0 },
    });

    expect(
      await screen.findByText(/no passkeys enrolled yet/i)
    ).toBeInTheDocument();
  });

  it("shows generic Error removal failures inline", async () => {
    vi.mocked(authApi.deletePasskey).mockRejectedValueOnce(
      new Error("Deletion exploded.")
    );

    await renderSettingsPage();

    fireEvent.click(screen.getByRole("button", { name: /remove/i }));

    expect(await screen.findByText(/deletion exploded/i)).toBeInTheDocument();
  });

  it("shows fallback removal errors for unexpected failures", async () => {
    vi.mocked(authApi.deletePasskey).mockRejectedValueOnce("unexpected");

    await renderSettingsPage();

    fireEvent.click(screen.getByRole("button", { name: /remove/i }));

    expect(
      await screen.findByText(/failed to delete passkey/i)
    ).toBeInTheDocument();
  });

  it("shows passkey removal errors inline", async () => {
    vi.mocked(authApi.deletePasskey).mockRejectedValueOnce(
      new authApi.AuthApiError("Passkey deletion failed.")
    );

    await renderSettingsPage();

    fireEvent.click(screen.getByRole("button", { name: /remove/i }));

    expect(
      await screen.findByText(/passkey deletion failed/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/work macbook touch id/i)).toBeInTheDocument();
  });

  it("displays language selection section", async () => {
    await renderSettingsPage();

    // Language heading should exist
    expect(
      screen.getByRole("heading", { name: /language/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /select language/i })
    ).toBeInTheDocument();
  });

  it("shows current language as selected", async () => {
    await renderSettingsPage();

    const select = screen.getByRole("combobox", { name: /select language/i });
    expect(select).toHaveValue("en");
  });

  it("changes language when selection changes", async () => {
    const mockActivateLocale = vi.mocked(i18nModule.activateLocale);
    const mockSetLocalePreference = vi.mocked(i18nModule.setLocalePreference);
    mockActivateLocale.mockResolvedValueOnce(undefined);

    await renderSettingsPage();

    const select = screen.getByRole("combobox", { name: /select language/i });
    fireEvent.change(select, { target: { value: "de" } });

    await waitFor(() => {
      expect(mockActivateLocale).toHaveBeenCalledWith("de");
      expect(mockSetLocalePreference).toHaveBeenCalledWith("de");
    });
  });

  it("displays description text for language setting", async () => {
    await renderSettingsPage();

    expect(
      screen.getByText(/choose.*preferred.*language/i)
    ).toBeInTheDocument();
  });

  it("has proper heading hierarchy", async () => {
    await renderSettingsPage();

    // Main heading should be h1 (via Heading component)
    const mainHeading = screen.getByRole("heading", { name: /settings/i });
    expect(mainHeading.tagName).toBe("H1");

    // Language section heading should be h2
    const languageHeading = screen.getByRole("heading", { name: /language/i });
    expect(languageHeading.tagName).toBe("H2");
  });

  it("regenerates recovery codes for an enabled MFA account", async () => {
    vi.mocked(authApi.getMfaStatus).mockResolvedValueOnce(
      createEnabledMfaStatusResponse()
    );
    vi.mocked(authApi.regenerateRecoveryCodes).mockResolvedValueOnce(
      createRecoveryRevealResponse()
    );

    renderWithProviders(<SettingsPage />);

    await screen.findByText(/authenticator app/i);
    fireEvent.click(
      screen.getByRole("button", { name: /regenerate recovery codes/i })
    );

    await screen.findByRole("heading", {
      name: /regenerate recovery codes/i,
    });

    fireEvent.change(
      screen.getByRole("textbox", { name: /^authenticator code$/i }),
      {
        target: { value: "123456" },
      }
    );
    fireEvent.click(
      screen.getByRole("button", { name: /^regenerate codes$/i })
    );

    await waitFor(() => {
      expect(authApi.regenerateRecoveryCodes).toHaveBeenCalledWith({
        method: "totp",
        code: "123456",
      });
    });
    expect(
      await screen.findByRole("heading", {
        name: /store your recovery codes now/i,
      })
    ).toBeInTheDocument();
  });

  it("starts MFA enrollment for a disabled account and shows QR plus manual setup details", async () => {
    vi.mocked(authApi.startTotpEnrollment).mockResolvedValueOnce(
      createTotpEnrollmentPreparationResponse()
    );

    renderWithProviders(<SettingsPage />);

    await screen.findByText(/not enabled/i);
    fireEvent.click(screen.getByRole("button", { name: /set up mfa/i }));

    await waitFor(() => {
      expect(authApi.startTotpEnrollment).toHaveBeenCalledTimes(1);
    });

    expect(
      await screen.findByRole("heading", { name: /set up mfa/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("mfa-qr-code")).toHaveTextContent(
      /otpauth:\/\/totp/i
    );
    expect(screen.getByText(/manual setup key/i)).toBeInTheDocument();
    expect(screen.getAllByText(/jbswy3dpehpk3pxp/i)).toHaveLength(2);
  });

  it("confirms MFA enrollment and reveals recovery codes", async () => {
    vi.mocked(authApi.startTotpEnrollment).mockResolvedValueOnce(
      createTotpEnrollmentPreparationResponse()
    );
    vi.mocked(authApi.confirmTotpEnrollment).mockResolvedValueOnce(
      createRecoveryRevealResponse()
    );

    renderWithProviders(<SettingsPage />);

    await screen.findByText(/not enabled/i);
    fireEvent.click(screen.getByRole("button", { name: /set up mfa/i }));

    await screen.findByRole("heading", { name: /set up mfa/i });

    fireEvent.change(
      screen.getByRole("textbox", { name: /authenticator code/i }),
      {
        target: { value: "123456" },
      }
    );
    fireEvent.click(
      screen.getByRole("button", { name: /confirm and enable mfa/i })
    );

    await waitFor(() => {
      expect(authApi.confirmTotpEnrollment).toHaveBeenCalledWith({
        code: "123456",
      });
    });

    expect(
      await screen.findByRole("heading", {
        name: /store your recovery codes now/i,
      })
    ).toBeInTheDocument();
  });

  it("shows inline error when MFA enrollment confirmation fails", async () => {
    vi.mocked(authApi.startTotpEnrollment).mockResolvedValueOnce(
      createTotpEnrollmentPreparationResponse()
    );
    vi.mocked(authApi.confirmTotpEnrollment).mockRejectedValueOnce(
      new Error("Invalid authenticator code")
    );

    renderWithProviders(<SettingsPage />);

    await screen.findByText(/not enabled/i);
    fireEvent.click(screen.getByRole("button", { name: /set up mfa/i }));

    await screen.findByRole("heading", { name: /set up mfa/i });

    fireEvent.change(
      screen.getByRole("textbox", { name: /authenticator code/i }),
      {
        target: { value: "000000" },
      }
    );
    fireEvent.click(
      screen.getByRole("button", { name: /confirm and enable mfa/i })
    );

    expect(
      await screen.findByText(/invalid authenticator code/i)
    ).toBeInTheDocument();
  });

  it("shows enrollment preparation error and retries on demand", async () => {
    vi.mocked(authApi.startTotpEnrollment)
      .mockRejectedValueOnce(new Error("Service unavailable"))
      .mockResolvedValueOnce(createTotpEnrollmentPreparationResponse());

    renderWithProviders(<SettingsPage />);

    await screen.findByText(/not enabled/i);
    fireEvent.click(screen.getByRole("button", { name: /set up mfa/i }));

    expect(await screen.findByText(/service unavailable/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(
      await screen.findByRole("heading", { name: /set up mfa/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("mfa-qr-code")).toBeInTheDocument();
  });

  it("cancels the enrollment dialog without submitting", async () => {
    vi.mocked(authApi.startTotpEnrollment).mockResolvedValueOnce(
      createTotpEnrollmentPreparationResponse()
    );

    renderWithProviders(<SettingsPage />);

    await screen.findByText(/not enabled/i);
    fireEvent.click(screen.getByRole("button", { name: /set up mfa/i }));

    await screen.findByRole("heading", { name: /set up mfa/i });

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /set up mfa/i })
      ).not.toBeInTheDocument();
    });
    expect(authApi.confirmTotpEnrollment).not.toHaveBeenCalled();
  });

  it("disables MFA after code confirmation", async () => {
    vi.mocked(authApi.getMfaStatus).mockResolvedValueOnce(
      createEnabledMfaStatusResponse()
    );
    vi.mocked(authApi.disableMfa).mockResolvedValueOnce(
      createDisabledMfaStatusResponse()
    );

    renderWithProviders(<SettingsPage />);

    await screen.findByText(/authenticator app/i);
    fireEvent.click(screen.getByRole("button", { name: /disable mfa/i }));

    await screen.findByRole("heading", { name: /disable mfa/i });

    expect(
      screen.getByRole("textbox", { name: /^authenticator code$/i })
    ).toHaveAttribute("placeholder", "123456");

    fireEvent.change(
      screen.getByRole("textbox", { name: /^authenticator code$/i }),
      {
        target: { value: "123456" },
      }
    );
    fireEvent.click(screen.getByRole("button", { name: /^disable mfa$/i }));

    await waitFor(() => {
      expect(authApi.disableMfa).toHaveBeenCalledWith({
        method: "totp",
        code: "123456",
      });
    });
    expect(await screen.findByText(/not enabled/i)).toBeInTheDocument();
  });

  it("shows error message when MFA status fails to load", async () => {
    vi.mocked(authApi.getMfaStatus).mockRejectedValueOnce(
      new Error("Network error")
    );

    renderWithProviders(<SettingsPage />);

    expect(await screen.findByText(/network error/i)).toBeInTheDocument();
  });

  it("shows API error in dialog when disabling MFA fails", async () => {
    vi.mocked(authApi.getMfaStatus).mockResolvedValueOnce(
      createEnabledMfaStatusResponse()
    );
    vi.mocked(authApi.disableMfa).mockRejectedValueOnce(
      new Error("Invalid authenticator code")
    );

    renderWithProviders(<SettingsPage />);

    await screen.findByText(/authenticator app/i);
    fireEvent.click(screen.getByRole("button", { name: /disable mfa/i }));

    await screen.findByRole("heading", { name: /disable mfa/i });

    fireEvent.change(
      screen.getByRole("textbox", { name: /^authenticator code$/i }),
      { target: { value: "000000" } }
    );
    fireEvent.click(screen.getByRole("button", { name: /^disable mfa$/i }));

    expect(
      await screen.findByText(/invalid authenticator code/i)
    ).toBeInTheDocument();
  });

  it("shows the canonical raw recovery-code placeholder for sensitive MFA actions", async () => {
    vi.mocked(authApi.getMfaStatus).mockResolvedValueOnce(
      createEnabledMfaStatusResponse()
    );

    renderWithProviders(<SettingsPage />);

    await screen.findByText(/authenticator app/i);
    fireEvent.click(
      screen.getByRole("button", { name: /regenerate recovery codes/i })
    );

    await screen.findByRole("heading", { name: /regenerate recovery codes/i });
    fireEvent.click(screen.getByRole("radio", { name: /recovery code/i }));

    expect(
      screen.getByRole("textbox", { name: /^recovery code$/i })
    ).toHaveAttribute("placeholder", "B6F42Q8P");
  });

  it("requires acknowledgment before closing recovery codes dialog", async () => {
    vi.mocked(authApi.getMfaStatus).mockResolvedValueOnce(
      createEnabledMfaStatusResponse()
    );
    vi.mocked(authApi.regenerateRecoveryCodes).mockResolvedValueOnce(
      createRecoveryRevealResponse()
    );

    renderWithProviders(<SettingsPage />);

    await screen.findByText(/authenticator app/i);
    fireEvent.click(
      screen.getByRole("button", { name: /regenerate recovery codes/i })
    );

    await screen.findByRole("heading", { name: /regenerate recovery codes/i });

    fireEvent.change(
      screen.getByRole("textbox", { name: /^authenticator code$/i }),
      { target: { value: "123456" } }
    );
    fireEvent.click(
      screen.getByRole("button", { name: /^regenerate codes$/i })
    );

    await screen.findByRole("heading", {
      name: /store your recovery codes now/i,
    });

    const doneButton = screen.getByRole("button", { name: /^done$/i });
    expect(doneButton).toBeDisabled();

    const checkbox = screen.getByRole("checkbox", {
      name: /i stored these recovery codes/i,
    });
    fireEvent.click(checkbox);

    expect(doneButton).not.toBeDisabled();

    fireEvent.click(doneButton);

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", {
          name: /store your recovery codes now/i,
        })
      ).not.toBeInTheDocument();
    });
  });

  it("cancels the sensitive action dialog without submitting", async () => {
    vi.mocked(authApi.getMfaStatus).mockResolvedValueOnce(
      createEnabledMfaStatusResponse()
    );

    renderWithProviders(<SettingsPage />);

    await screen.findByText(/authenticator app/i);
    fireEvent.click(screen.getByRole("button", { name: /disable mfa/i }));

    await screen.findByRole("heading", { name: /disable mfa/i });

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /disable mfa/i })
      ).not.toBeInTheDocument();
    });
    expect(authApi.disableMfa).not.toHaveBeenCalled();
  });

  it("shows processing state while a sensitive action is submitting", async () => {
    vi.mocked(authApi.getMfaStatus).mockResolvedValueOnce(
      createEnabledMfaStatusResponse()
    );
    let resolveDisable!: (
      value: ReturnType<typeof createDisabledMfaStatusResponse>
    ) => void;
    vi.mocked(authApi.disableMfa).mockReturnValueOnce(
      new Promise<ReturnType<typeof createDisabledMfaStatusResponse>>((res) => {
        resolveDisable = res;
      })
    );

    renderWithProviders(<SettingsPage />);

    await screen.findByText(/authenticator app/i);
    fireEvent.click(screen.getByRole("button", { name: /disable mfa/i }));

    await screen.findByRole("heading", { name: /disable mfa/i });

    fireEvent.change(
      screen.getByRole("textbox", { name: /^authenticator code$/i }),
      { target: { value: "123456" } }
    );
    fireEvent.click(screen.getByRole("button", { name: /^disable mfa$/i }));

    expect(await screen.findByText(/processing\.\.\./i)).toBeInTheDocument();

    resolveDisable(createDisabledMfaStatusResponse());

    await waitFor(() => {
      expect(screen.queryByText(/processing\.\.\./i)).not.toBeInTheDocument();
    });
  });
});
