// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { SettingsPage } from "./SettingsPage";
import { messages as deMessages } from "../../locales/de/messages.mjs";
import { messages as enMessages } from "../../locales/en/messages.mjs";
import * as i18nModule from "../../i18n";
import * as authAccountApi from "../../services/authAccountApi";
import * as passkeyBrowser from "../../services/passkeyBrowser";

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

vi.mock("../../services/authAccountApi", async () => {
  const actual = await vi.importActual("../../services/authAccountApi");
  return {
    ...actual,
    deletePasskey: vi.fn(),
    getPasskeys: vi.fn(),
    startPasskeyRegistrationChallenge: vi.fn(),
    verifyPasskeyRegistrationChallenge: vi.fn(),
    getMfaStatus: vi.fn(),
    startTotpEnrollment: vi.fn(),
    confirmTotpEnrollment: vi.fn(),
    regenerateRecoveryCodes: vi.fn(),
    disableMfa: vi.fn(),
  };
});

vi.mock("../../services/passkeyBrowser", () => ({
  isBrowserPasskeyRegistrationSupported: vi.fn().mockReturnValue(false),
  isPasskeyRegistrationSupported: vi.fn(),
  getPasskeyAttestation: vi.fn(),
}));

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

async function selectLanguage(visibleName: string) {
  const trigger = screen.getByRole("combobox", { name: /select language/i });
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

  const option = await screen.findByRole("option", { name: visibleName });
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

function createPasskeyRegistrationChallengeResponse() {
  return {
    data: {
      challenge_id: "550e8400-e29b-41d4-a716-446655440099",
      public_key: {
        challenge: "Zm9vYmFy",
        rp: {
          id: "app.secpal.dev",
          name: "SecPal",
        },
        user: {
          id: "dXNlci1pZA",
          name: "test@secpal.dev",
          display_name: "Test User",
        },
        pub_key_cred_params: [{ type: "public-key" as const, alg: -7 }],
      },
    },
  };
}

function createPasskeyRegistrationVerificationResponse() {
  return {
    data: {
      credential: {
        id: "new-credential-id",
        label: "Security Key",
        created_at: "2026-04-06T09:12:00Z",
        last_used_at: null,
        transports: ["usb" as const],
      },
      total_passkeys: 2,
    },
  };
}

const textBytes = (value: string) => Uint8Array.from(Buffer.from(value)).buffer;

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Setup i18n with English locale
    i18n.load("en", {});
    i18n.activate("en");
    vi.mocked(passkeyBrowser.isPasskeyRegistrationSupported).mockReturnValue(
      true
    );
    vi.mocked(
      passkeyBrowser.isBrowserPasskeyRegistrationSupported
    ).mockReturnValue(true);
    vi.mocked(authAccountApi.getMfaStatus).mockResolvedValue(
      createDisabledMfaStatusResponse()
    );
    vi.mocked(authAccountApi.getPasskeys).mockResolvedValue(
      createPasskeyListResponse()
    );
  });

  it("renders the settings page with heading", async () => {
    await renderSettingsPage();

    expect(
      screen.getByRole("heading", { name: /settings/i })
    ).toBeInTheDocument();
  });

  it("keeps the settings shell, status rows, and recovery code surfaces on canonical theme tokens", async () => {
    vi.mocked(authAccountApi.getMfaStatus).mockResolvedValueOnce(
      createEnabledMfaStatusResponse()
    );
    vi.mocked(authAccountApi.regenerateRecoveryCodes).mockResolvedValueOnce(
      createRecoveryRevealResponse()
    );

    const { container } = renderWithProviders(<SettingsPage />);

    await screen.findByText(/authenticator app/i);

    const pageHeading = screen.getByRole("heading", { name: /settings/i });
    const pageDescription = screen.getByText(
      /manage your application preferences/i
    );
    const divider = container.querySelector("div.border-t");
    const statusTerm = screen.getByText("Status");
    const statusValue = screen.getByText("Authenticator app");
    const passkeyCard = screen
      .getByText(/work macbook touch id/i)
      .closest("div.rounded-2xl");

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
    await screen.findByRole("heading", {
      name: /store your recovery codes now/i,
    });

    const recoveryAlert = screen
      .getByText(/anyone with one of these recovery codes/i)
      .closest('[data-slot="alert"]');
    const recoveryAlertText = screen.getByText(
      /anyone with one of these recovery codes/i
    );
    const recoveryCode = screen.getByText("B6F42Q8P");
    const recoveryAcknowledgement = screen
      .getByText(/i stored these recovery codes securely/i)
      .closest("label");

    expect(pageHeading).toHaveClass("text-foreground");
    expect(pageDescription).toHaveClass("text-muted-foreground");
    expect(divider).toHaveClass("border-border");
    expect(statusTerm).toHaveClass("text-muted-foreground");
    expect(statusValue).toHaveClass("text-foreground");
    expect(passkeyCard).toHaveClass("border-border", "bg-muted");
    expect(recoveryAlert).toHaveClass("border-amber-500/30", "bg-amber-500/10");
    expect(recoveryAlertText).toHaveClass("text-foreground");
    expect(recoveryCode).toHaveClass(
      "border-border",
      "bg-muted",
      "text-foreground"
    );
    expect(recoveryAcknowledgement).toHaveClass(
      "border-border",
      "bg-card",
      "text-card-foreground"
    );

    expect(pageHeading.className).not.toContain("text-zinc-950");
    expect(pageDescription.className).not.toContain("text-zinc-600");
    expect(divider?.className).not.toContain("border-zinc-200");
    expect(statusTerm.className).not.toContain("text-zinc-500");
    expect(statusValue.className).not.toContain("text-zinc-950");
    expect(passkeyCard?.className).not.toContain("bg-zinc-50");
    expect(recoveryAlert?.className).not.toContain("border-amber-200");
    expect(recoveryAlertText.className).not.toContain("text-amber-700");
    expect(recoveryCode.className).not.toContain("bg-zinc-50");
    expect(recoveryAcknowledgement?.className).not.toContain("bg-white");
  });

  it("keeps settings sections and controls visible during initial MFA and passkey loads", () => {
    vi.mocked(authAccountApi.getMfaStatus).mockImplementation(
      () => new Promise(() => {})
    );
    vi.mocked(authAccountApi.getPasskeys).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders(<SettingsPage />);

    expect(
      screen.getByRole("heading", { name: /settings/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /multi-factor authentication/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /loading mfa status/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /passkeys/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/passkey label/i)).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /loading passkeys/i })
    ).toBeInTheDocument();
  });

  it("renders the MFA status fetch failure through the canonical alert surface", async () => {
    vi.mocked(authAccountApi.getMfaStatus).mockRejectedValueOnce(
      new Error("Service unavailable")
    );

    renderWithProviders(<SettingsPage />);

    const statusError = await screen.findByText(/service unavailable/i);
    const statusAlert = statusError.closest('[data-slot="alert"]');

    expect(statusAlert).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );
    expect(statusAlert).toHaveAttribute("data-slot", "alert");
    expect(statusError).toHaveClass("text-destructive");
  });

  it("loads the generated locale catalogs used by the passkey settings flow", () => {
    expect(Object.keys(deMessages).length).toBeGreaterThan(0);
    expect(Object.keys(enMessages).length).toBeGreaterThan(0);
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
    vi.mocked(authAccountApi.getPasskeys).mockResolvedValueOnce({ data: [] });

    await renderSettingsPage();

    expect(
      await screen.findByText(/no passkeys enrolled yet/i)
    ).toBeInTheDocument();
  });

  it("shows passkey loading errors returned by the API", async () => {
    vi.mocked(authAccountApi.getPasskeys).mockRejectedValueOnce(
      new authAccountApi.AuthApiError("Failed to load passkeys.")
    );

    await renderSettingsPage();

    const passkeyError = await screen.findByText(/failed to load passkeys/i);
    const passkeyAlert = passkeyError.closest('[data-slot="alert"]');
    expect(passkeyError).toBeInTheDocument();
    expect(passkeyAlert).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );
    expect(passkeyAlert).toHaveAttribute("data-slot", "alert");
  });

  it("shows a fallback passkey loading error for unexpected failures", async () => {
    vi.mocked(authAccountApi.getPasskeys).mockRejectedValueOnce("unexpected");

    await renderSettingsPage();

    expect(
      await screen.findByText(/failed to load passkeys/i)
    ).toBeInTheDocument();
  });

  it("shows an unsupported passkey message without hiding the enrolled list", async () => {
    vi.mocked(passkeyBrowser.isPasskeyRegistrationSupported).mockReturnValue(
      false
    );
    vi.mocked(
      passkeyBrowser.isBrowserPasskeyRegistrationSupported
    ).mockReturnValue(false);

    await renderSettingsPage();

    expect(
      screen.getByText(/this browser does not support passkeys/i)
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/work macbook touch id/i)
    ).toBeInTheDocument();
  });

  it("does not start native passkey registration when Android reports passkeys unavailable", async () => {
    vi.mocked(
      passkeyBrowser.isBrowserPasskeyRegistrationSupported
    ).mockReturnValue(false);
    const bridge = {
      getPasskeyCapabilities: vi.fn().mockResolvedValue({
        passkeysAvailable: false,
        reason: "PASSKEY_ANDROID_VERSION_UNSUPPORTED",
      }),
      createPasskeyAttestation: vi.fn(),
    };
    (
      globalThis as typeof globalThis & {
        SecPalNativeAuthBridge?: typeof bridge;
      }
    ).SecPalNativeAuthBridge = bridge;

    try {
      await renderSettingsPage();

      expect(
        await screen.findByText(/requires Android 14 or later/i)
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /add passkey/i })
      ).not.toBeInTheDocument();
      expect(bridge.createPasskeyAttestation).not.toHaveBeenCalled();
    } finally {
      delete (globalThis as { SecPalNativeAuthBridge?: unknown })
        .SecPalNativeAuthBridge;
    }
  });

  it("does not report passkeys unsupported while native capabilities are loading", async () => {
    const bridge = {
      getPasskeyCapabilities: vi.fn().mockReturnValue(new Promise(() => {})),
      createPasskeyAttestation: vi.fn(),
    };
    (
      globalThis as typeof globalThis & {
        SecPalNativeAuthBridge?: typeof bridge;
      }
    ).SecPalNativeAuthBridge = bridge;

    try {
      await renderSettingsPage();

      expect(screen.getByRole("status")).toHaveTextContent(
        /checking passkey availability/i
      );
      expect(
        screen.queryByText(/this browser does not support passkeys/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/requires Android 14 or later/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /add passkey/i })
      ).not.toBeInTheDocument();
    } finally {
      delete (globalThis as { SecPalNativeAuthBridge?: unknown })
        .SecPalNativeAuthBridge;
    }
  });

  it("shows device-neutral guidance when the native capability response is invalid", async () => {
    vi.mocked(
      passkeyBrowser.isBrowserPasskeyRegistrationSupported
    ).mockReturnValue(false);
    const bridge = {
      getPasskeyCapabilities: vi.fn().mockResolvedValue({}),
      createPasskeyAttestation: vi.fn(),
    };
    (
      globalThis as typeof globalThis & {
        SecPalNativeAuthBridge?: typeof bridge;
      }
    ).SecPalNativeAuthBridge = bridge;

    try {
      await renderSettingsPage();

      expect(
        await screen.findByText(
          /passkey registration is not available on this device/i
        )
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/this browser does not support passkeys/i)
      ).not.toBeInTheDocument();
    } finally {
      delete (globalThis as { SecPalNativeAuthBridge?: unknown })
        .SecPalNativeAuthBridge;
    }
  });

  it("registers a passkey and appends it to the enrolled list", async () => {
    vi.mocked(authAccountApi.getPasskeys)
      .mockResolvedValueOnce(createPasskeyListResponse())
      .mockResolvedValueOnce({
        data: [
          ...createPasskeyListResponse().data,
          createPasskeyRegistrationVerificationResponse().data.credential,
        ],
      });
    vi.mocked(
      authAccountApi.startPasskeyRegistrationChallenge
    ).mockResolvedValueOnce(createPasskeyRegistrationChallengeResponse());
    vi.mocked(passkeyBrowser.getPasskeyAttestation).mockResolvedValueOnce({
      id: "new-credential-id",
      raw_id: "bmV3LWNyZWRlbnRpYWwtaWQ",
      type: "public-key",
      response: {
        client_data_json: "Y2xpZW50",
        attestation_object: "YXR0ZXN0YXRpb24",
        transports: ["usb"],
      },
      client_extension_results: {},
    });
    vi.mocked(
      authAccountApi.verifyPasskeyRegistrationChallenge
    ).mockResolvedValueOnce(createPasskeyRegistrationVerificationResponse());

    await renderSettingsPage();

    fireEvent.change(screen.getByLabelText(/passkey label/i), {
      target: { value: "Security Key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add passkey/i }));

    await waitFor(() => {
      expect(
        authAccountApi.startPasskeyRegistrationChallenge
      ).toHaveBeenCalledTimes(1);
      expect(passkeyBrowser.getPasskeyAttestation).toHaveBeenCalledTimes(1);
      expect(
        authAccountApi.verifyPasskeyRegistrationChallenge
      ).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440099",
        expect.objectContaining({
          label: "Security Key",
          credential: expect.objectContaining({ id: "new-credential-id" }),
        })
      );
      expect(authAccountApi.getPasskeys).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText(/security key/i)).toBeInTheDocument();
  });

  it("keeps passkey rows visible while refreshing after registration", async () => {
    vi.mocked(authAccountApi.getPasskeys)
      .mockResolvedValueOnce(createPasskeyListResponse())
      .mockImplementationOnce(() => new Promise(() => {}));
    vi.mocked(
      authAccountApi.startPasskeyRegistrationChallenge
    ).mockResolvedValueOnce(createPasskeyRegistrationChallengeResponse());
    vi.mocked(passkeyBrowser.getPasskeyAttestation).mockResolvedValueOnce({
      id: "new-credential-id",
      raw_id: "bmV3LWNyZWRlbnRpYWwtaWQ",
      type: "public-key",
      response: {
        client_data_json: "Y2xpZW50",
        attestation_object: "YXR0ZXN0YXRpb24",
        transports: ["usb"],
      },
    });
    vi.mocked(
      authAccountApi.verifyPasskeyRegistrationChallenge
    ).mockResolvedValueOnce(createPasskeyRegistrationVerificationResponse());

    await renderSettingsPage();

    fireEvent.change(screen.getByLabelText(/passkey label/i), {
      target: { value: "Security Key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add passkey/i }));

    expect(await screen.findByText(/security key/i)).toBeInTheDocument();
    expect(screen.getByText(/work macbook touch id/i)).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /loading passkeys/i })
    ).toBeInTheDocument();
  });

  it("shows a browser-check prompt while waiting for the credential provider", async () => {
    vi.mocked(
      authAccountApi.startPasskeyRegistrationChallenge
    ).mockResolvedValueOnce(createPasskeyRegistrationChallengeResponse());

    let resolveAttestation!: (value: unknown) => void;
    vi.mocked(passkeyBrowser.getPasskeyAttestation).mockReturnValue(
      new Promise((resolve) => {
        resolveAttestation = resolve as (value: unknown) => void;
      })
    );

    await renderSettingsPage();

    fireEvent.change(screen.getByLabelText(/passkey label/i), {
      target: { value: "Security Key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add passkey/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /complete on your device/i })
      ).toBeInTheDocument();
    });

    // Resolve to avoid dangling promise.
    await act(async () => {
      resolveAttestation({
        id: "new-credential-id",
        raw_id: "bmV3LWNyZWRlbnRpYWwtaWQ",
        type: "public-key",
        response: {
          client_data_json: "Y2xpZW50",
          attestation_object: "YXR0ZXN0YXRpb24",
        },
        client_extension_results: {},
      });
    });
  });

  it("shows a saving prompt while the passkey registration is being verified", async () => {
    vi.mocked(
      authAccountApi.startPasskeyRegistrationChallenge
    ).mockResolvedValueOnce(createPasskeyRegistrationChallengeResponse());
    vi.mocked(passkeyBrowser.getPasskeyAttestation).mockResolvedValueOnce({
      id: "new-credential-id",
      raw_id: "bmV3LWNyZWRlbnRpYWwtaWQ",
      type: "public-key",
      response: {
        client_data_json: "Y2xpZW50",
        attestation_object: "YXR0ZXN0YXRpb24",
        transports: ["usb"],
      },
      client_extension_results: {},
    });

    let resolveVerification!: (
      value: ReturnType<typeof createPasskeyRegistrationVerificationResponse>
    ) => void;
    vi.mocked(
      authAccountApi.verifyPasskeyRegistrationChallenge
    ).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveVerification = resolve;
      })
    );

    await renderSettingsPage();

    fireEvent.change(screen.getByLabelText(/passkey label/i), {
      target: { value: "Security Key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add passkey/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /saving passkey/i })
      ).toBeInTheDocument();
    });

    await act(async () => {
      resolveVerification(createPasskeyRegistrationVerificationResponse());
    });

    expect(
      await screen.findByRole("button", { name: /add passkey/i })
    ).toBeInTheDocument();
  });

  it("shows passkey enrollment errors inline", async () => {
    vi.mocked(
      authAccountApi.startPasskeyRegistrationChallenge
    ).mockRejectedValueOnce(
      new authAccountApi.AuthApiError("Passkey registration failed.")
    );

    await renderSettingsPage();

    fireEvent.change(screen.getByLabelText(/passkey label/i), {
      target: { value: "Security Key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add passkey/i }));

    const passkeyError = await screen.findByText(
      /passkey registration failed/i
    );
    const passkeyAlert = passkeyError.closest('[data-slot="alert"]');
    expect(passkeyError).toBeInTheDocument();
    expect(passkeyAlert).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );
    expect(passkeyAlert).toHaveAttribute("data-slot", "alert");
  });

  it("shows cancellation message when user dismisses the browser passkey dialog", async () => {
    vi.mocked(
      authAccountApi.startPasskeyRegistrationChallenge
    ).mockResolvedValueOnce(createPasskeyRegistrationChallengeResponse());
    vi.mocked(passkeyBrowser.getPasskeyAttestation).mockRejectedValueOnce(
      new DOMException(
        "The operation either timed out or was not allowed.",
        "NotAllowedError"
      )
    );

    await renderSettingsPage();

    fireEvent.change(screen.getByLabelText(/passkey label/i), {
      target: { value: "Security Key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add passkey/i }));

    expect(
      await screen.findByText(/cancelled or not permitted/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add passkey/i })
    ).not.toBeDisabled();
  });

  it("shows timeout message when passkey registration is aborted", async () => {
    vi.mocked(
      authAccountApi.startPasskeyRegistrationChallenge
    ).mockResolvedValueOnce(createPasskeyRegistrationChallengeResponse());
    vi.mocked(passkeyBrowser.getPasskeyAttestation).mockRejectedValueOnce(
      new DOMException("The operation was aborted.", "AbortError")
    );

    await renderSettingsPage();

    fireEvent.change(screen.getByLabelText(/passkey label/i), {
      target: { value: "Security Key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add passkey/i }));

    expect(
      await screen.findByText(/passkey registration timed out/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add passkey/i })
    ).not.toBeDisabled();
  });

  it("shows generic error when browser attestation fails unexpectedly", async () => {
    vi.mocked(
      authAccountApi.startPasskeyRegistrationChallenge
    ).mockResolvedValueOnce(createPasskeyRegistrationChallengeResponse());
    vi.mocked(passkeyBrowser.getPasskeyAttestation).mockRejectedValueOnce(
      new Error("Unexpected credential error")
    );

    await renderSettingsPage();

    fireEvent.change(screen.getByLabelText(/passkey label/i), {
      target: { value: "Security Key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add passkey/i }));

    expect(
      await screen.findByText(/unexpected credential error/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add passkey/i })
    ).not.toBeDisabled();
  });

  it("shows credential provider guidance when the platform reports a credential manager error", async () => {
    vi.mocked(
      authAccountApi.startPasskeyRegistrationChallenge
    ).mockResolvedValueOnce(createPasskeyRegistrationChallengeResponse());
    vi.mocked(passkeyBrowser.getPasskeyAttestation).mockRejectedValueOnce(
      new Error(
        "An unknown error occurred while talking to the credential manager."
      )
    );

    await renderSettingsPage();

    fireEvent.change(screen.getByLabelText(/passkey label/i), {
      target: { value: "Security Key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add passkey/i }));

    expect(
      await screen.findByText(/no credential provider is available/i)
    ).toBeInTheDocument();
  });

  it("maps a real browser passkey attestation into the API payload", async () => {
    const actualPasskeyBrowser = await vi.importActual<
      typeof import("../../services/passkeyBrowser")
    >("../../services/passkeyBrowser");

    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: {
        get: vi.fn(),
        create: vi.fn().mockResolvedValue({
          id: "credential-id",
          rawId: textBytes("raw-id"),
          type: "public-key",
          response: {
            clientDataJSON: textBytes("client-data"),
            attestationObject: textBytes("attestation-object"),
            getTransports: () => ["internal"],
          },
          getClientExtensionResults: () => ({ credProps: { rk: true } }),
        }),
      },
    });

    await expect(
      actualPasskeyBrowser.getPasskeyAttestation(
        createPasskeyRegistrationChallengeResponse().data.public_key
      )
    ).resolves.toEqual(
      expect.objectContaining({
        raw_id: "cmF3LWlk",
        response: expect.objectContaining({
          client_data_json: "Y2xpZW50LWRhdGE",
          attestation_object: "YXR0ZXN0YXRpb24tb2JqZWN0",
          transports: ["internal"],
        }),
      })
    );
  });

  it("removes an enrolled passkey and refreshes the list", async () => {
    vi.mocked(authAccountApi.deletePasskey).mockResolvedValueOnce({
      message: "Passkey deleted successfully.",
      data: { remaining_passkeys: 0 },
    });
    vi.mocked(authAccountApi.getPasskeys)
      .mockResolvedValueOnce(createPasskeyListResponse())
      .mockResolvedValueOnce({ data: [] });

    await renderSettingsPage();
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));

    await waitFor(() => {
      expect(authAccountApi.deletePasskey).toHaveBeenCalledWith(
        "credential-id"
      );
      expect(authAccountApi.getPasskeys).toHaveBeenCalledTimes(2);
      expect(
        screen.queryByText(/work macbook touch id/i)
      ).not.toBeInTheDocument();
      expect(screen.getByText(/no passkeys enrolled yet/i)).toBeInTheDocument();
    });
  });

  it("disables all remove buttons while any removal is in flight", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    let resolveDeletion:
      | ((value: {
          message: string;
          data: { remaining_passkeys: number };
        }) => void)
      | undefined;

    vi.mocked(authAccountApi.deletePasskey).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDeletion = resolve;
        })
    );
    vi.mocked(authAccountApi.getPasskeys).mockResolvedValueOnce({
      data: [
        {
          id: "credential-id",
          label: "Work MacBook Touch ID",
          created_at: "2026-04-06T09:12:00Z",
          last_used_at: null,
          transports: ["internal" as const],
        },
        {
          id: "credential-id-2",
          label: "iPhone Face ID",
          created_at: "2026-04-07T09:12:00Z",
          last_used_at: null,
          transports: ["internal" as const],
        },
      ],
    });

    await renderSettingsPage();

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    expect(removeButtons).toHaveLength(2);
    fireEvent.click(removeButtons[0]!);

    // ALL remove buttons must be disabled while any deletion is in flight
    for (const button of screen.getAllByRole("button", {
      name: /remove|removing/i,
    })) {
      expect(button).toBeDisabled();
    }

    try {
      await act(async () => {
        resolveDeletion?.({
          message: "Passkey deleted successfully.",
          data: { remaining_passkeys: 1 },
        });
      });

      await waitFor(() => {
        expect(authAccountApi.getPasskeys).toHaveBeenCalledTimes(2);
        expect(screen.getAllByRole("button", { name: /remove/i })).toHaveLength(
          1
        );
      });

      expect(
        consoleErrorSpy.mock.calls.some(([message]) =>
          String(message).includes("not wrapped in act")
        )
      ).toBe(false);

      const unexpectedErrors = consoleErrorSpy.mock.calls.filter(
        ([message]) => !String(message).includes("not wrapped in act")
      );
      expect(unexpectedErrors).toHaveLength(0);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("shows a busy state while passkey removal is in flight", async () => {
    let resolveDeletion:
      | ((value: {
          message: string;
          data: { remaining_passkeys: number };
        }) => void)
      | undefined;

    vi.mocked(authAccountApi.deletePasskey).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDeletion = resolve;
        })
    );
    vi.mocked(authAccountApi.getPasskeys)
      .mockResolvedValueOnce(createPasskeyListResponse())
      .mockResolvedValueOnce({ data: [] });

    await renderSettingsPage();

    fireEvent.click(await screen.findByRole("button", { name: /remove/i }));

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
    vi.mocked(authAccountApi.deletePasskey).mockRejectedValueOnce(
      new Error("Deletion exploded.")
    );

    await renderSettingsPage();

    fireEvent.click(await screen.findByRole("button", { name: /remove/i }));

    expect(await screen.findByText(/deletion exploded/i)).toBeInTheDocument();
  });

  it("shows fallback removal errors for unexpected failures", async () => {
    vi.mocked(authAccountApi.deletePasskey).mockRejectedValueOnce("unexpected");

    await renderSettingsPage();

    fireEvent.click(await screen.findByRole("button", { name: /remove/i }));

    expect(
      await screen.findByText(/failed to delete passkey/i)
    ).toBeInTheDocument();
  });

  it("shows passkey removal errors inline", async () => {
    vi.mocked(authAccountApi.deletePasskey).mockRejectedValueOnce(
      new authAccountApi.AuthApiError("Passkey deletion failed.")
    );

    await renderSettingsPage();

    fireEvent.click(await screen.findByRole("button", { name: /remove/i }));

    const passkeyError = await screen.findByText(/passkey deletion failed/i);
    const passkeyAlert = passkeyError.closest('[data-slot="alert"]');
    expect(passkeyError).toBeInTheDocument();
    expect(passkeyAlert).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );
    expect(passkeyAlert).toHaveAttribute("data-slot", "alert");
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
    expect(select).toHaveTextContent("English");
    expect(select).toHaveAttribute("data-slot", "select-trigger");
  });

  it("changes language when selection changes", async () => {
    const mockActivateLocale = vi.mocked(i18nModule.activateLocale);
    const mockSetLocalePreference = vi.mocked(i18nModule.setLocalePreference);
    mockActivateLocale.mockResolvedValueOnce(undefined);

    await renderSettingsPage();

    await selectLanguage("Deutsch");

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
    vi.mocked(authAccountApi.getMfaStatus).mockResolvedValueOnce(
      createEnabledMfaStatusResponse()
    );
    vi.mocked(authAccountApi.regenerateRecoveryCodes).mockResolvedValueOnce(
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
      expect(authAccountApi.regenerateRecoveryCodes).toHaveBeenCalledWith({
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
    vi.mocked(authAccountApi.startTotpEnrollment).mockResolvedValueOnce(
      createTotpEnrollmentPreparationResponse()
    );

    renderWithProviders(<SettingsPage />);

    await screen.findByText(/not enabled/i);
    fireEvent.click(screen.getByRole("button", { name: /set up mfa/i }));

    await waitFor(() => {
      expect(authAccountApi.startTotpEnrollment).toHaveBeenCalledTimes(1);
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
    vi.mocked(authAccountApi.startTotpEnrollment).mockResolvedValueOnce(
      createTotpEnrollmentPreparationResponse()
    );
    vi.mocked(authAccountApi.confirmTotpEnrollment).mockResolvedValueOnce(
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
      expect(authAccountApi.confirmTotpEnrollment).toHaveBeenCalledWith({
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
    vi.mocked(authAccountApi.startTotpEnrollment).mockResolvedValueOnce(
      createTotpEnrollmentPreparationResponse()
    );
    vi.mocked(authAccountApi.confirmTotpEnrollment).mockRejectedValueOnce(
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
    vi.mocked(authAccountApi.startTotpEnrollment)
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

  it("keeps MFA enrollment alerts, setup key cards, and sensitive-action choices on canonical theme tokens", async () => {
    vi.mocked(authAccountApi.startTotpEnrollment)
      .mockRejectedValueOnce(new Error("Service unavailable"))
      .mockResolvedValueOnce(createTotpEnrollmentPreparationResponse());

    const { unmount } = renderWithProviders(<SettingsPage />);

    await screen.findByText(/not enabled/i);
    fireEvent.click(screen.getByRole("button", { name: /set up mfa/i }));

    const enrollmentError = await screen.findByText(/service unavailable/i);
    expect(enrollmentError.closest('[data-slot="alert"]')).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await screen.findByRole("heading", { name: /set up mfa/i });
    const manualSetupCard = screen
      .getByText(/manual setup key/i)
      .closest("div");
    const setupKey = screen.getAllByText(/jbswy3dpehpk3pxp/i)[1];
    const expiryCard = screen
      .getByText(/this setup expires at/i)
      .closest("div.rounded-2xl");

    expect(manualSetupCard).toHaveClass("border-border", "bg-muted");
    expect(setupKey).toHaveClass(
      "border-border",
      "bg-background",
      "text-foreground"
    );
    expect(expiryCard).toHaveClass("border-border", "bg-muted");

    unmount();
    vi.mocked(authAccountApi.getMfaStatus).mockResolvedValueOnce(
      createEnabledMfaStatusResponse()
    );

    renderWithProviders(<SettingsPage />);
    await screen.findByText(/authenticator app/i);
    fireEvent.click(
      screen.getByRole("button", { name: /regenerate recovery codes/i })
    );
    await screen.findByRole("heading", { name: /regenerate recovery codes/i });

    const verificationLegend = screen.getByText(/verification method/i);
    const recoveryChoice = screen
      .getByRole("radio", { name: /^recovery code$/i })
      .closest("label");

    expect(verificationLegend).toHaveClass("text-foreground");
    expect(recoveryChoice).toHaveClass(
      "border-border",
      "bg-card",
      "text-card-foreground"
    );
  });

  it("cancels the enrollment dialog without submitting", async () => {
    vi.mocked(authAccountApi.startTotpEnrollment).mockResolvedValueOnce(
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
    expect(authAccountApi.confirmTotpEnrollment).not.toHaveBeenCalled();
  });

  it("disables MFA after code confirmation", async () => {
    vi.mocked(authAccountApi.getMfaStatus).mockResolvedValueOnce(
      createEnabledMfaStatusResponse()
    );
    vi.mocked(authAccountApi.disableMfa).mockResolvedValueOnce(
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
      expect(authAccountApi.disableMfa).toHaveBeenCalledWith({
        method: "totp",
        code: "123456",
      });
    });
    expect(await screen.findByText(/not enabled/i)).toBeInTheDocument();
  });

  it("shows error message when MFA status fails to load", async () => {
    vi.mocked(authAccountApi.getMfaStatus).mockRejectedValueOnce(
      new Error("Network error")
    );

    renderWithProviders(<SettingsPage />);

    expect(await screen.findByText(/network error/i)).toBeInTheDocument();
  });

  it("shows API error in dialog when disabling MFA fails", async () => {
    vi.mocked(authAccountApi.getMfaStatus).mockResolvedValueOnce(
      createEnabledMfaStatusResponse()
    );
    vi.mocked(authAccountApi.disableMfa).mockRejectedValueOnce(
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
    vi.mocked(authAccountApi.getMfaStatus).mockResolvedValueOnce(
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
    vi.mocked(authAccountApi.getMfaStatus).mockResolvedValueOnce(
      createEnabledMfaStatusResponse()
    );
    vi.mocked(authAccountApi.regenerateRecoveryCodes).mockResolvedValueOnce(
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
    vi.mocked(authAccountApi.getMfaStatus).mockResolvedValueOnce(
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
    expect(authAccountApi.disableMfa).not.toHaveBeenCalled();
  });

  it("shows processing state while a sensitive action is submitting", async () => {
    vi.mocked(authAccountApi.getMfaStatus).mockResolvedValueOnce(
      createEnabledMfaStatusResponse()
    );
    let resolveDisable!: (
      value: ReturnType<typeof createDisabledMfaStatusResponse>
    ) => void;
    vi.mocked(authAccountApi.disableMfa).mockReturnValueOnce(
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
