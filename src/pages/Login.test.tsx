// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { MemoryRouter } from "react-router-dom";
import type { AuthenticatedUser, MfaVerificationMethod } from "@/types/api";
import { messages as deMessages } from "../locales/de/messages.mjs";
import { messages as enMessages } from "../locales/en/messages.mjs";
import { Login } from "./Login";
import { AuthProvider } from "../contexts/AuthContext";
import * as authApi from "../services/authApi";
import * as healthApi from "../services/healthApi";
import * as passkeyBrowser from "../services/passkeyBrowser";
import { authStorage } from "../services/storage";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import * as i18nModule from "../i18n";

// Mock only the API functions, not AuthApiError class
vi.mock("../services/authApi", async () => {
  const actual = await vi.importActual("../services/authApi");
  return {
    ...actual,
    login: vi.fn(),
    getCurrentUser: vi.fn(),
    startPasskeyAuthenticationChallenge: vi.fn(),
    verifyPasskeyAuthenticationChallenge: vi.fn(),
    verifyMfaChallenge: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
  };
});

// Mock health API
vi.mock("../services/healthApi", async () => {
  const actual = await vi.importActual("../services/healthApi");
  return {
    ...actual,
    checkHealth: vi.fn(),
  };
});

// Mock useOnlineStatus hook
vi.mock("../hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(),
}));

vi.mock("../services/passkeyBrowser", () => ({
  isPasskeySupported: vi.fn(),
  getPasskeyAssertion: vi.fn(),
}));

vi.mock("../i18n", async () => {
  const actual = await vi.importActual("../i18n");
  return {
    ...actual,
    activateLocale: vi.fn(),
    setLocalePreference: vi.fn(),
  };
});

const renderLogin = () => {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <I18nProvider i18n={i18n}>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </I18nProvider>
    </MemoryRouter>
  );
};

// Helper to create a healthy response
const createHealthyResponse = (): healthApi.HealthStatus => ({
  status: "ready",
  checks: {
    database: "ok",
    tenant_keys: "ok",
    kek_file: "ok",
  },
  timestamp: "2025-11-29T10:00:00Z",
});

// Helper to create an unhealthy response
const createUnhealthyResponse = (): healthApi.HealthStatus => ({
  status: "not_ready",
  checks: {
    database: "ok",
    tenant_keys: "missing",
    kek_file: "ok",
  },
  timestamp: "2025-11-29T10:00:00Z",
});

const createAuthUser = (overrides?: Partial<AuthenticatedUser>) => ({
  id: "1",
  name: "Test User",
  email: "test@secpal.dev",
  emailVerified: true,
  roles: [],
  permissions: [],
  hasOrganizationalScopes: false,
  hasCustomerAccess: false,
  hasSiteAccess: false,
  ...overrides,
});

const mfaChallengeFixture = {
  id: "550e8400-e29b-41d4-a716-446655440099",
  purpose: "login" as const,
  login_context: "session" as const,
  primary_method: "totp" as const,
  available_methods: ["totp", "recovery_code"] as MfaVerificationMethod[],
  expires_at: "2026-04-01T09:30:00Z",
};

const textBytes = (value: string) =>
  Uint8Array.from(new TextEncoder().encode(value)).buffer;
const loadPasskeyBrowser = () =>
  vi.importActual<typeof import("../services/passkeyBrowser")>(
    "../services/passkeyBrowser"
  );

async function openMfaDialog() {
  vi.mocked(authApi.login).mockResolvedValueOnce({
    challenge: mfaChallengeFixture,
  });
  renderLogin();
  await screen.findByRole("button", { name: /log in/i });
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: "test@secpal.dev" },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: "password123" },
  });
  fireEvent.click(screen.getByRole("button", { name: /log in/i }));
  await screen.findByRole("heading", { name: /second factor required/i });
}

function getTotpInput(): HTMLInputElement {
  return screen.getByLabelText(/authenticator code/i, {
    selector: '[autocomplete="one-time-code"]',
  }) as HTMLInputElement;
}

function enterTotpCode(code: string) {
  fireEvent.change(getTotpInput(), { target: { value: code } });
}

function getRecoveryCodeInput(): HTMLInputElement {
  // The recovery-code input is the `input-otp` hidden input (always
  // `data-input-otp`), regardless of its `autocomplete` value — the
  // alphanumeric path opts out of `one-time-code` so browsers do not
  // mis-suggest SMS codes for the alphanumeric backup field, so the
  // `[autocomplete="one-time-code"]` selector no longer matches here.
  return screen.getByLabelText(/recovery code/i, {
    selector: "[data-input-otp]",
  }) as HTMLInputElement;
}

function enterRecoveryCode(code: string) {
  fireEvent.change(getRecoveryCodeInput(), { target: { value: code } });
}

function switchToRecoveryCodeMode() {
  fireEvent.click(screen.getByRole("button", { name: /authenticator app/i }));
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

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, "", "/login");
    i18n.load("en", enMessages);
    i18n.load("de", deMessages);
    i18n.activate("en");
    // Default: health check passes
    vi.mocked(healthApi.checkHealth).mockResolvedValue(createHealthyResponse());
    // Default: user is online
    vi.mocked(useOnlineStatus).mockReturnValue(true);
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders login form", async () => {
    renderLogin();

    expect(
      screen.getByRole("heading", { name: /secpal/i })
    ).toBeInTheDocument();
    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

    // Wait for health check to complete
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });
  });

  it("submits login form with email and password", async () => {
    const mockLogin = vi.mocked(authApi.login);
    const mockResponse = {
      user: createAuthUser(),
    };
    mockLogin.mockResolvedValueOnce(mockResponse);

    renderLogin();

    // Wait for health check to complete
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /log in/i });

    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });

    fireEvent.change(emailInput, { target: { value: "test@secpal.dev" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: "test@secpal.dev",
        password: "password123",
      });
    });
  });

  it("shows an MFA challenge dialog when the backend requires a second factor", async () => {
    const mockLogin = vi.mocked(authApi.login);
    mockLogin.mockResolvedValueOnce({
      challenge: {
        id: "550e8400-e29b-41d4-a716-446655440099",
        purpose: "login",
        login_context: "session",
        primary_method: "totp",
        available_methods: ["totp", "recovery_code"],
        expires_at: "2026-04-01T09:30:00Z",
      },
    });

    renderLogin();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@secpal.dev" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(
      await screen.findByRole("heading", { name: /second factor required/i })
    ).toBeInTheDocument();
    const totpInput = getTotpInput();
    expect(totpInput).toBeInTheDocument();
    expect(totpInput).toHaveAttribute("inputmode", "numeric");
    expect(
      document.querySelectorAll('[data-slot="login-input-otp-slot"]')
    ).toHaveLength(6);
    // The recovery-code fallback is now an inline toggle button below the
    // OTP input (mirrors the shadcn `input-otp` "Form" example) instead of
    // a radio-group method picker.
    expect(
      screen.getByRole("button", { name: /authenticator app/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeDisabled();
    expect(screen.getByLabelText(/password/i)).toBeDisabled();
    expect(
      document.querySelector(
        'form[aria-label="Login form"] button[type="submit"]'
      )
    ).toBeDisabled();
  });

  it("shows a passkey sign-in action when the browser supports passkeys", async () => {
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(true);

    renderLogin();

    const passkeyButton = await screen.findByRole("button", {
      name: /sign in with passkey/i,
    });

    expect(passkeyButton).toBeInTheDocument();
    expect(passkeyButton.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(
      screen.queryByRole("button", { name: /continue with (apple|google)/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/or continue with/i)).not.toBeInTheDocument();
  });

  it("routes passkey sign-in through the native auth bridge without forwarding the typed email", async () => {
    const authGlobal = globalThis as {
      SecPalNativeAuthBridge?: {
        login: ReturnType<typeof vi.fn>;
        loginWithPasskey?: ReturnType<typeof vi.fn>;
        logout: ReturnType<typeof vi.fn>;
        getCurrentUser: ReturnType<typeof vi.fn>;
      };
    };
    const originalNativeBridge = authGlobal.SecPalNativeAuthBridge;
    const nativeBridge = {
      login: vi.fn(),
      loginWithPasskey: vi.fn().mockResolvedValue({
        user: createAuthUser({ name: "Native Passkey User" }),
      }),
      logout: vi.fn(),
      getCurrentUser: vi
        .fn()
        .mockResolvedValue(createAuthUser({ name: "Canonical Native User" })),
    };

    authGlobal.SecPalNativeAuthBridge = nativeBridge;
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(false);

    try {
      renderLogin();

      fireEvent.change(await screen.findByLabelText(/email/i), {
        target: { value: " TEST@SECPAL.DEV " },
      });
      fireEvent.click(
        await screen.findByRole("button", { name: /sign in with passkey/i })
      );

      await waitFor(() => {
        expect(nativeBridge.loginWithPasskey).toHaveBeenCalledTimes(1);
      });

      expect(nativeBridge.loginWithPasskey).toHaveBeenCalledWith();
      expect(
        authApi.startPasskeyAuthenticationChallenge
      ).not.toHaveBeenCalled();
      expect(passkeyBrowser.getPasskeyAssertion).not.toHaveBeenCalled();
      expect(
        authApi.verifyPasskeyAuthenticationChallenge
      ).not.toHaveBeenCalled();
    } finally {
      if (originalNativeBridge === undefined) {
        delete authGlobal.SecPalNativeAuthBridge;
      } else {
        authGlobal.SecPalNativeAuthBridge = originalNativeBridge;
      }
    }
  });

  it("shows a native-device prompt while waiting for native passkey sign-in", async () => {
    const authGlobal = globalThis as {
      SecPalNativeAuthBridge?: {
        login: ReturnType<typeof vi.fn>;
        loginWithPasskey?: ReturnType<typeof vi.fn>;
        logout: ReturnType<typeof vi.fn>;
        getCurrentUser: ReturnType<typeof vi.fn>;
      };
    };
    const originalNativeBridge = authGlobal.SecPalNativeAuthBridge;
    let resolvePasskeyLogin!: (value: unknown) => void;
    const nativeBridge = {
      login: vi.fn(),
      loginWithPasskey: vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolvePasskeyLogin = resolve;
        })
      ),
      logout: vi.fn(),
      getCurrentUser: vi
        .fn()
        .mockResolvedValue(createAuthUser({ name: "Canonical Native User" })),
    };

    authGlobal.SecPalNativeAuthBridge = nativeBridge;
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(false);

    try {
      renderLogin();

      fireEvent.click(
        await screen.findByRole("button", { name: /sign in with passkey/i })
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /check your device/i })
        ).toBeInTheDocument();
      });

      await act(async () => {
        resolvePasskeyLogin({ user: createAuthUser() });
      });
    } finally {
      if (originalNativeBridge === undefined) {
        delete authGlobal.SecPalNativeAuthBridge;
      } else {
        authGlobal.SecPalNativeAuthBridge = originalNativeBridge;
      }
    }
  });

  it("shows native passkey AuthApiError messages inline", async () => {
    const authGlobal = globalThis as {
      SecPalNativeAuthBridge?: {
        login: ReturnType<typeof vi.fn>;
        loginWithPasskey?: ReturnType<typeof vi.fn>;
        logout: ReturnType<typeof vi.fn>;
        getCurrentUser: ReturnType<typeof vi.fn>;
      };
    };
    const originalNativeBridge = authGlobal.SecPalNativeAuthBridge;
    const nativeBridge = {
      login: vi.fn(),
      loginWithPasskey: vi
        .fn()
        .mockRejectedValue(new authApi.AuthApiError("Native passkey failed.")),
      logout: vi.fn(),
      getCurrentUser: vi.fn(),
    };

    authGlobal.SecPalNativeAuthBridge = nativeBridge;
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(false);

    try {
      renderLogin();

      fireEvent.click(
        await screen.findByRole("button", { name: /sign in with passkey/i })
      );

      expect(
        await screen.findByText(/native passkey failed/i)
      ).toBeInTheDocument();
    } finally {
      if (originalNativeBridge === undefined) {
        delete authGlobal.SecPalNativeAuthBridge;
      } else {
        authGlobal.SecPalNativeAuthBridge = originalNativeBridge;
      }
    }
  });

  it("shows unexpected native passkey Error messages inline", async () => {
    const authGlobal = globalThis as {
      SecPalNativeAuthBridge?: {
        login: ReturnType<typeof vi.fn>;
        loginWithPasskey?: ReturnType<typeof vi.fn>;
        logout: ReturnType<typeof vi.fn>;
        getCurrentUser: ReturnType<typeof vi.fn>;
      };
    };
    const originalNativeBridge = authGlobal.SecPalNativeAuthBridge;
    const nativeBridge = {
      login: vi.fn(),
      loginWithPasskey: vi
        .fn()
        .mockRejectedValue(new Error("Native passkey crashed.")),
      logout: vi.fn(),
      getCurrentUser: vi.fn(),
    };

    authGlobal.SecPalNativeAuthBridge = nativeBridge;
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(false);

    try {
      renderLogin();

      fireEvent.click(
        await screen.findByRole("button", { name: /sign in with passkey/i })
      );

      expect(
        await screen.findByText(/native passkey crashed/i)
      ).toBeInTheDocument();
    } finally {
      if (originalNativeBridge === undefined) {
        delete authGlobal.SecPalNativeAuthBridge;
      } else {
        authGlobal.SecPalNativeAuthBridge = originalNativeBridge;
      }
    }
  });

  it("localizes native passkey cancellation errors with the active locale", async () => {
    const authGlobal = globalThis as {
      SecPalNativeAuthBridge?: {
        login: ReturnType<typeof vi.fn>;
        loginWithPasskey?: ReturnType<typeof vi.fn>;
        logout: ReturnType<typeof vi.fn>;
        getCurrentUser: ReturnType<typeof vi.fn>;
      };
    };
    const originalNativeBridge = authGlobal.SecPalNativeAuthBridge;
    const nativeBridge = {
      login: vi.fn(),
      loginWithPasskey: vi
        .fn()
        .mockRejectedValue(new Error("Passkey sign-in was cancelled.")),
      logout: vi.fn(),
      getCurrentUser: vi.fn(),
    };

    authGlobal.SecPalNativeAuthBridge = nativeBridge;
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(false);

    try {
      act(() => {
        i18n.activate("de");
      });

      renderLogin();

      fireEvent.click(
        await screen.findByRole("button", { name: /mit passkey anmelden/i })
      );

      expect(
        await screen.findByText(/die passkey-anmeldung wurde abgebrochen/i)
      ).toBeInTheDocument();
    } finally {
      act(() => {
        i18n.activate("en");
      });

      if (originalNativeBridge === undefined) {
        delete authGlobal.SecPalNativeAuthBridge;
      } else {
        authGlobal.SecPalNativeAuthBridge = originalNativeBridge;
      }
    }
  });

  it("localizes the short invalid-credentials backend message with the active locale", async () => {
    const mockLogin = vi.mocked(authApi.login);
    mockLogin.mockRejectedValue(
      new authApi.AuthApiError("Invalid credentials")
    );

    act(() => {
      i18n.activate("de");
    });

    renderLogin();

    fireEvent.change(await screen.findByLabelText(/e-mail-adresse/i), {
      target: { value: "test@secpal.dev" },
    });
    fireEvent.change(screen.getByLabelText(/passwort/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /einloggen/i }));

    expect(
      await screen.findByText(/die angegebenen zugangsdaten sind falsch/i)
    ).toBeInTheDocument();

    act(() => {
      i18n.activate("en");
    });
  });

  it("shows a localized message for interrupted native passkey flows", async () => {
    const authGlobal = globalThis as {
      SecPalNativeAuthBridge?: {
        login: ReturnType<typeof vi.fn>;
        loginWithPasskey?: ReturnType<typeof vi.fn>;
        logout: ReturnType<typeof vi.fn>;
        getCurrentUser: ReturnType<typeof vi.fn>;
      };
    };
    const originalNativeBridge = authGlobal.SecPalNativeAuthBridge;
    const nativeBridge = {
      login: vi.fn(),
      loginWithPasskey: vi
        .fn()
        .mockRejectedValue(new Error("Passkey sign-in was interrupted.")),
      logout: vi.fn(),
      getCurrentUser: vi.fn(),
    };

    authGlobal.SecPalNativeAuthBridge = nativeBridge;
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(false);

    try {
      renderLogin();

      fireEvent.click(
        await screen.findByRole("button", { name: /sign in with passkey/i })
      );

      expect(
        await screen.findByText(/passkey sign-in was interrupted/i)
      ).toBeInTheDocument();
    } finally {
      if (originalNativeBridge === undefined) {
        delete authGlobal.SecPalNativeAuthBridge;
      } else {
        authGlobal.SecPalNativeAuthBridge = originalNativeBridge;
      }
    }
  });

  it("shows provider guidance for native passkey provider-unavailable errors", async () => {
    const authGlobal = globalThis as {
      SecPalNativeAuthBridge?: {
        login: ReturnType<typeof vi.fn>;
        loginWithPasskey?: ReturnType<typeof vi.fn>;
        logout: ReturnType<typeof vi.fn>;
        getCurrentUser: ReturnType<typeof vi.fn>;
      };
    };
    const originalNativeBridge = authGlobal.SecPalNativeAuthBridge;
    const nativeBridge = {
      login: vi.fn(),
      loginWithPasskey: vi
        .fn()
        .mockRejectedValue(
          new Error("No credential provider is available on this device.")
        ),
      logout: vi.fn(),
      getCurrentUser: vi.fn(),
    };

    authGlobal.SecPalNativeAuthBridge = nativeBridge;
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(false);

    try {
      renderLogin();

      fireEvent.click(
        await screen.findByRole("button", { name: /sign in with passkey/i })
      );

      expect(
        await screen.findByText(/no credential provider is available/i)
      ).toBeInTheDocument();
    } finally {
      if (originalNativeBridge === undefined) {
        delete authGlobal.SecPalNativeAuthBridge;
      } else {
        authGlobal.SecPalNativeAuthBridge = originalNativeBridge;
      }
    }
  });

  it("shows a fallback message for non-Error native passkey failures", async () => {
    const authGlobal = globalThis as {
      SecPalNativeAuthBridge?: {
        login: ReturnType<typeof vi.fn>;
        loginWithPasskey?: ReturnType<typeof vi.fn>;
        logout: ReturnType<typeof vi.fn>;
        getCurrentUser: ReturnType<typeof vi.fn>;
      };
    };
    const originalNativeBridge = authGlobal.SecPalNativeAuthBridge;
    const nativeBridge = {
      login: vi.fn(),
      loginWithPasskey: vi.fn().mockRejectedValue("unexpected-native-failure"),
      logout: vi.fn(),
      getCurrentUser: vi.fn(),
    };

    authGlobal.SecPalNativeAuthBridge = nativeBridge;
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(false);

    try {
      renderLogin();

      fireEvent.click(
        await screen.findByRole("button", { name: /sign in with passkey/i })
      );

      expect(
        await screen.findByText(/an unexpected passkey sign-in error occurred/i)
      ).toBeInTheDocument();
    } finally {
      if (originalNativeBridge === undefined) {
        delete authGlobal.SecPalNativeAuthBridge;
      } else {
        authGlobal.SecPalNativeAuthBridge = originalNativeBridge;
      }
    }
  });

  it("maps real browser passkey assertions into the API payload", async () => {
    const actualPasskeyBrowser = await loadPasskeyBrowser();

    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: vi.fn() },
    });

    await expect(
      actualPasskeyBrowser.getPasskeyAssertion(
        { challenge: "Zm9vYmFy", rp_id: "app.secpal.dev" },
        "conditional"
      )
    ).rejects.toThrow("Passkeys are not available in this browser.");

    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: {
        get: vi.fn().mockResolvedValue({
          id: "credential-id",
          rawId: textBytes("raw-id"),
          response: {
            clientDataJSON: textBytes("client-data"),
            authenticatorData: textBytes("authenticator-data"),
            signature: textBytes("signature"),
            userHandle: textBytes("user-handle"),
          },
          getClientExtensionResults: () => ({ credProps: { rk: true } }),
        }),
      },
    });

    await expect(
      actualPasskeyBrowser.getPasskeyAssertion(
        {
          challenge: "Zm9vYmFy",
          rp_id: "app.secpal.dev",
        },
        "conditional"
      )
    ).resolves.toEqual(
      expect.objectContaining({
        raw_id: "cmF3LWlk",
        response: expect.objectContaining({
          client_data_json: "Y2xpZW50LWRhdGE",
          authenticator_data: "YXV0aGVudGljYXRvci1kYXRh",
          signature: "c2lnbmF0dXJl",
          user_handle: "dXNlci1oYW5kbGU",
        }),
      })
    );
  });

  it("completes passkey sign-in with the browser WebAuthn flow", async () => {
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(true);
    vi.mocked(
      authApi.startPasskeyAuthenticationChallenge
    ).mockResolvedValueOnce({
      data: {
        challenge_id: "550e8400-e29b-41d4-a716-446655440099",
        public_key: {
          challenge: "Zm9vYmFy",
          rp_id: "app.secpal.dev",
          timeout: 60000,
          user_verification: "preferred",
        },
        mediation: "conditional",
        expires_at: "2026-04-06T12:00:00Z",
      },
    });
    vi.mocked(passkeyBrowser.getPasskeyAssertion).mockResolvedValueOnce({
      id: "credential-id",
      raw_id: "credential-id",
      type: "public-key",
      response: {
        client_data_json: "Y2xpZW50",
        authenticator_data: "YXV0aA",
        signature: "c2lnbmF0dXJl",
      },
      client_extension_results: {},
    });
    vi.mocked(
      authApi.verifyPasskeyAuthenticationChallenge
    ).mockResolvedValueOnce({
      user: createAuthUser(),
      authentication: {
        mode: "session",
        method: "passkey",
        mfa_completed: true,
      },
    });

    renderLogin();

    fireEvent.click(
      await screen.findByRole("button", { name: /sign in with passkey/i })
    );

    await waitFor(() => {
      expect(authApi.startPasskeyAuthenticationChallenge).toHaveBeenCalledTimes(
        1
      );
      expect(passkeyBrowser.getPasskeyAssertion).toHaveBeenCalledTimes(1);
      expect(authApi.verifyPasskeyAuthenticationChallenge).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440099",
        expect.objectContaining({
          credential: expect.objectContaining({
            id: "credential-id",
          }),
        })
      );
    });
  });

  it("always uses optional mediation for an explicit button click even when the API returns conditional", async () => {
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(true);
    vi.mocked(
      authApi.startPasskeyAuthenticationChallenge
    ).mockResolvedValueOnce({
      data: {
        challenge_id: "550e8400-e29b-41d4-a716-446655440099",
        public_key: {
          challenge: "Zm9vYmFy",
          rp_id: "app.secpal.dev",
          timeout: 60000,
          user_verification: "preferred",
        },
        mediation: "conditional",
        expires_at: "2026-04-06T12:00:00Z",
      },
    });
    vi.mocked(passkeyBrowser.getPasskeyAssertion).mockResolvedValueOnce({
      id: "credential-id",
      raw_id: "credential-id",
      type: "public-key",
      response: {
        client_data_json: "Y2xpZW50",
        authenticator_data: "YXV0aA",
        signature: "c2lnbmF0dXJl",
      },
      client_extension_results: {},
    });
    vi.mocked(
      authApi.verifyPasskeyAuthenticationChallenge
    ).mockResolvedValueOnce({
      user: createAuthUser(),
      authentication: {
        mode: "session",
        method: "passkey",
        mfa_completed: true,
      },
    });

    renderLogin();

    fireEvent.click(
      await screen.findByRole("button", { name: /sign in with passkey/i })
    );

    await waitFor(() => {
      expect(passkeyBrowser.getPasskeyAssertion).toHaveBeenCalledWith(
        expect.anything(),
        "optional"
      );
    });
  });

  it("starts passkey sign-in with a discoverable challenge even when the email field is filled", async () => {
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(true);
    vi.mocked(
      authApi.startPasskeyAuthenticationChallenge
    ).mockResolvedValueOnce({
      data: {
        challenge_id: "550e8400-e29b-41d4-a716-446655440100",
        public_key: {
          challenge: "YmFyZm9v",
          rp_id: "app.secpal.dev",
          timeout: 60000,
          user_verification: "preferred",
        },
        mediation: "optional",
        expires_at: "2026-04-06T12:00:00Z",
      },
    });
    vi.mocked(passkeyBrowser.getPasskeyAssertion).mockResolvedValueOnce({
      id: "credential-id",
      raw_id: "credential-id",
      type: "public-key",
      response: {
        client_data_json: "Y2xpZW50",
        authenticator_data: "YXV0aA",
        signature: "c2lnbmF0dXJl",
      },
      client_extension_results: {},
    });
    vi.mocked(
      authApi.verifyPasskeyAuthenticationChallenge
    ).mockResolvedValueOnce({
      user: createAuthUser(),
      authentication: {
        mode: "session",
        method: "passkey",
        mfa_completed: true,
      },
    });

    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@secpal.dev" },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: /sign in with passkey/i })
    );

    await waitFor(() => {
      expect(authApi.startPasskeyAuthenticationChallenge).toHaveBeenCalledTimes(
        1
      );
    });

    expect(authApi.startPasskeyAuthenticationChallenge).toHaveBeenCalledWith();
    expect(authApi.verifyPasskeyAuthenticationChallenge).toHaveBeenCalledWith(
      "550e8400-e29b-41d4-a716-446655440100",
      expect.anything()
    );
  });

  it("shows passkey sign-in errors inline when the passkey flow fails", async () => {
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(true);
    vi.mocked(
      authApi.startPasskeyAuthenticationChallenge
    ).mockRejectedValueOnce(
      new authApi.AuthApiError("Passkey sign-in is temporarily unavailable.")
    );

    renderLogin();

    fireEvent.click(
      await screen.findByRole("button", { name: /sign in with passkey/i })
    );

    expect(
      await screen.findByText(/passkey sign-in is temporarily unavailable/i)
    ).toBeInTheDocument();
  });

  it("shows a cancelled message when passkey sign-in is rejected with NotAllowedError", async () => {
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(true);
    vi.mocked(
      authApi.startPasskeyAuthenticationChallenge
    ).mockResolvedValueOnce({
      data: {
        challenge_id: "550e8400-e29b-41d4-a716-446655440099",
        public_key: {
          challenge: "Zm9vYmFy",
          rp_id: "app.secpal.dev",
          timeout: 60000,
          user_verification: "preferred",
        },
        mediation: "optional",
        expires_at: "2026-04-06T12:00:00Z",
      },
    });
    const notAllowed = new DOMException(
      "The operation is not allowed.",
      "NotAllowedError"
    );
    vi.mocked(passkeyBrowser.getPasskeyAssertion).mockRejectedValueOnce(
      notAllowed
    );

    renderLogin();

    fireEvent.click(
      await screen.findByRole("button", { name: /sign in with passkey/i })
    );

    expect(
      await screen.findByText(
        /passkey sign-in was cancelled or not permitted by the browser/i
      )
    ).toBeInTheDocument();
  });

  it("shows a timeout message when passkey sign-in is aborted", async () => {
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(true);
    vi.mocked(
      authApi.startPasskeyAuthenticationChallenge
    ).mockResolvedValueOnce({
      data: {
        challenge_id: "550e8400-e29b-41d4-a716-446655440099",
        public_key: {
          challenge: "Zm9vYmFy",
          rp_id: "app.secpal.dev",
          timeout: 60000,
          user_verification: "preferred",
        },
        mediation: "optional",
        expires_at: "2026-04-06T12:00:00Z",
      },
    });
    const abortError = new DOMException(
      "The operation was aborted.",
      "AbortError"
    );
    vi.mocked(passkeyBrowser.getPasskeyAssertion).mockRejectedValueOnce(
      abortError
    );

    renderLogin();

    fireEvent.click(
      await screen.findByRole("button", { name: /sign in with passkey/i })
    );

    expect(
      await screen.findByText(/passkey sign-in timed out/i)
    ).toBeInTheDocument();
  });

  it("shows credential provider guidance when the platform reports a credential manager error", async () => {
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(true);
    vi.mocked(
      authApi.startPasskeyAuthenticationChallenge
    ).mockResolvedValueOnce({
      data: {
        challenge_id: "550e8400-e29b-41d4-a716-446655440099",
        public_key: {
          challenge: "Zm9vYmFy",
          rp_id: "app.secpal.dev",
          timeout: 60000,
          user_verification: "preferred",
        },
        mediation: "optional",
        expires_at: "2026-04-06T12:00:00Z",
      },
    });
    vi.mocked(passkeyBrowser.getPasskeyAssertion).mockRejectedValueOnce(
      new Error(
        "An unknown error occurred while talking to the credential manager."
      )
    );

    renderLogin();

    fireEvent.click(
      await screen.findByRole("button", { name: /sign in with passkey/i })
    );

    expect(
      await screen.findByText(/no credential provider is available/i)
    ).toBeInTheDocument();
  });

  it("surfaces resident-credential errors instead of retrying with an email-scoped challenge", async () => {
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(true);
    vi.mocked(
      authApi.startPasskeyAuthenticationChallenge
    ).mockResolvedValueOnce({
      data: {
        challenge_id: "550e8400-e29b-41d4-a716-446655440099",
        public_key: {
          challenge: "Zm9vYmFy",
          rp_id: "app.secpal.dev",
          timeout: 60000,
          user_verification: "preferred",
        },
        mediation: "optional",
        expires_at: "2026-04-06T12:00:00Z",
      },
    });
    vi.mocked(passkeyBrowser.getPasskeyAssertion).mockRejectedValueOnce(
      new Error(
        "Resident credentials or empty allowCredentials lists are not supported"
      )
    );

    renderLogin();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@secpal.dev" },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: /sign in with passkey/i })
    );

    expect(
      await screen.findByText(/resident credentials/i)
    ).toBeInTheDocument();

    expect(authApi.startPasskeyAuthenticationChallenge).toHaveBeenCalledTimes(
      1
    );
    expect(authApi.startPasskeyAuthenticationChallenge).toHaveBeenCalledWith();
  });

  it("shows a browser-check prompt while waiting for the WebAuthn credential", async () => {
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(true);
    vi.mocked(
      authApi.startPasskeyAuthenticationChallenge
    ).mockResolvedValueOnce({
      data: {
        challenge_id: "550e8400-e29b-41d4-a716-446655440099",
        public_key: {
          challenge: "Zm9vYmFy",
          rp_id: "app.secpal.dev",
          timeout: 60000,
          user_verification: "preferred",
        },
        mediation: "conditional",
        expires_at: "2026-04-06T12:00:00Z",
      },
    });

    let rejectAssertion!: (reason?: unknown) => void;
    vi.mocked(passkeyBrowser.getPasskeyAssertion).mockReturnValue(
      new Promise((_, reject) => {
        rejectAssertion = reject as (reason?: unknown) => void;
      })
    );

    renderLogin();

    fireEvent.click(
      await screen.findByRole("button", { name: /sign in with passkey/i })
    );

    // While waiting for WebAuthn, the button should tell the user to check their browser
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /check your browser/i })
      ).toBeInTheDocument();
    });

    await act(async () => {
      rejectAssertion(
        new DOMException("The operation was aborted.", "AbortError")
      );
    });

    expect(
      await screen.findByText(/passkey sign-in timed out/i)
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /sign in with passkey/i })
    ).toBeInTheDocument();
  });

  it("shows a verifying prompt while the passkey verify request is in progress", async () => {
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(true);
    vi.mocked(
      authApi.startPasskeyAuthenticationChallenge
    ).mockResolvedValueOnce({
      data: {
        challenge_id: "550e8400-e29b-41d4-a716-446655440099",
        public_key: {
          challenge: "Zm9vYmFy",
          rp_id: "app.secpal.dev",
          timeout: 60000,
          user_verification: "preferred",
        },
        mediation: "conditional",
        expires_at: "2026-04-06T12:00:00Z",
      },
    });
    vi.mocked(passkeyBrowser.getPasskeyAssertion).mockResolvedValueOnce({
      id: "credential-id",
      raw_id: "credential-id",
      type: "public-key",
      response: {
        client_data_json: "Y2xpZW50",
        authenticator_data: "YXV0aA",
        signature: "c2lnbmF0dXJl",
      },
      client_extension_results: {},
    });

    let resolveVerify!: (value: unknown) => void;
    vi.mocked(authApi.verifyPasskeyAuthenticationChallenge).mockReturnValue(
      new Promise((resolve) => {
        resolveVerify = resolve as (value: unknown) => void;
      })
    );
    vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(createAuthUser());

    renderLogin();

    fireEvent.click(
      await screen.findByRole("button", { name: /sign in with passkey/i })
    );

    // After WebAuthn succeeds, should show verifying
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /verifying passkey/i })
      ).toBeInTheDocument();
    });

    await act(async () => {
      resolveVerify({
        user: createAuthUser(),
        authentication: {
          mode: "session",
          method: "passkey",
          mfa_completed: true,
        },
      });
    });

    expect(authApi.verifyPasskeyAuthenticationChallenge).toHaveBeenCalledTimes(
      1
    );
  });

  it("completes browser passkey login without a separate session confirmation fetch", async () => {
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(true);
    vi.mocked(
      authApi.startPasskeyAuthenticationChallenge
    ).mockResolvedValueOnce({
      data: {
        challenge_id: "550e8400-e29b-41d4-a716-446655440099",
        public_key: {
          challenge: "Zm9vYmFy",
          rp_id: "app.secpal.dev",
          timeout: 60000,
          user_verification: "preferred",
        },
        mediation: "conditional",
        expires_at: "2026-04-06T12:00:00Z",
      },
    });
    vi.mocked(passkeyBrowser.getPasskeyAssertion).mockResolvedValueOnce({
      id: "credential-id",
      raw_id: "credential-id",
      type: "public-key",
      response: {
        client_data_json: "Y2xpZW50",
        authenticator_data: "YXV0aA",
        signature: "c2lnbmF0dXJl",
      },
      client_extension_results: {},
    });
    vi.mocked(
      authApi.verifyPasskeyAuthenticationChallenge
    ).mockResolvedValueOnce({
      user: createAuthUser(),
      authentication: {
        mode: "session",
        method: "passkey",
        mfa_completed: true,
      },
    });
    renderLogin();

    await waitFor(() => {
      expect(authApi.getCurrentUser).toHaveBeenCalledTimes(1);
    });

    const bootstrapGetCurrentUserCalls = vi.mocked(authApi.getCurrentUser).mock
      .calls.length;

    fireEvent.click(
      await screen.findByRole("button", { name: /sign in with passkey/i })
    );

    await waitFor(() => {
      expect(
        authApi.verifyPasskeyAuthenticationChallenge
      ).toHaveBeenCalledTimes(1);
    });

    expect(authApi.getCurrentUser).toHaveBeenCalledTimes(
      bootstrapGetCurrentUserCalls
    );
  });

  it("clears the browser passkey loading state after verify succeeds", async () => {
    vi.mocked(passkeyBrowser.isPasskeySupported).mockReturnValue(true);
    vi.mocked(
      authApi.startPasskeyAuthenticationChallenge
    ).mockResolvedValueOnce({
      data: {
        challenge_id: "550e8400-e29b-41d4-a716-446655440099",
        public_key: {
          challenge: "Zm9vYmFy",
          rp_id: "app.secpal.dev",
          timeout: 60000,
          user_verification: "preferred",
        },
        mediation: "conditional",
        expires_at: "2026-04-06T12:00:00Z",
      },
    });
    vi.mocked(passkeyBrowser.getPasskeyAssertion).mockResolvedValueOnce({
      id: "credential-id",
      raw_id: "credential-id",
      type: "public-key",
      response: {
        client_data_json: "Y2xpZW50",
        authenticator_data: "YXV0aA",
        signature: "c2lnbmF0dXJl",
      },
      client_extension_results: {},
    });
    vi.mocked(
      authApi.verifyPasskeyAuthenticationChallenge
    ).mockResolvedValueOnce({
      user: createAuthUser(),
      authentication: {
        mode: "session",
        method: "passkey",
        mfa_completed: true,
      },
    });
    renderLogin();

    await waitFor(() => {
      expect(authApi.getCurrentUser).toHaveBeenCalledTimes(1);
    });

    const bootstrapGetCurrentUserCalls = vi.mocked(authApi.getCurrentUser).mock
      .calls.length;

    fireEvent.click(
      await screen.findByRole("button", { name: /sign in with passkey/i })
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /signing in with passkey/i })
      ).not.toBeInTheDocument();
    });

    expect(authApi.getCurrentUser).toHaveBeenCalledTimes(
      bootstrapGetCurrentUserCalls
    );
  });

  it("verifies an MFA challenge and continues the session login flow", async () => {
    const mockLogin = vi.mocked(authApi.login);
    const mockVerifyMfaChallenge = vi.mocked(authApi.verifyMfaChallenge);

    mockLogin.mockResolvedValueOnce({
      challenge: {
        id: "550e8400-e29b-41d4-a716-446655440099",
        purpose: "login",
        login_context: "session",
        primary_method: "totp",
        available_methods: ["totp", "recovery_code"],
        expires_at: "2026-04-01T09:30:00Z",
      },
    });
    mockVerifyMfaChallenge.mockResolvedValueOnce({
      user: createAuthUser(),
      authentication: {
        mode: "session",
        mfa_completed: true,
      },
    });

    renderLogin();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@secpal.dev" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await screen.findByRole("heading", { name: /second factor required/i });

    enterTotpCode("123456");
    fireEvent.click(
      screen.getByRole("button", { name: /verify and continue/i })
    );

    await waitFor(() => {
      expect(mockVerifyMfaChallenge).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440099",
        {
          method: "totp",
          code: "123456",
        }
      );
    });

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /second factor required/i })
      ).not.toBeInTheDocument();
    });
  });

  it("shows the shadcn Empty/Spinner completion state and hides the login form after a successful MFA verify", async () => {
    const mockLogin = vi.mocked(authApi.login);
    const mockVerifyMfaChallenge = vi.mocked(authApi.verifyMfaChallenge);

    mockLogin.mockResolvedValueOnce({
      challenge: mfaChallengeFixture,
    });
    mockVerifyMfaChallenge.mockResolvedValueOnce({
      user: createAuthUser(),
      authentication: {
        mode: "session",
        mfa_completed: true,
      },
    });

    renderLogin();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@secpal.dev" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await screen.findByRole("heading", { name: /second factor required/i });

    enterTotpCode("123456");
    fireEvent.click(
      screen.getByRole("button", { name: /verify and continue/i })
    );

    const completing = await screen.findByTestId("login-completing");
    expect(completing).not.toHaveAttribute("aria-busy");
    expect(completing).not.toHaveAttribute("aria-live");

    // AT announcements are scoped to the LoginSpinner's role="status", not the
    // wider container (which also holds static heading text).
    expect(
      screen.getByRole("status", { name: /loading/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/completing sign-in/i)).toBeInTheDocument();
    expect(screen.getByText(/please wait/i)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /log in/i })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /email/i })).toBeDisabled();

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /second factor required/i })
      ).not.toBeInTheDocument();
    });

    // After the MFA verify settles successfully and the dialog has closed,
    // the completion spinner must remain mounted until route change unmounts
    // the page. If `handleVerifyMfa`'s finally block tore the spinner down
    // on success (the original implementation did this via
    // `if (shouldSurfaceLoginError) setIsCompletingLogin(false)`), the
    // credential card would briefly flash back into view between the dialog
    // close and the unmount commit. Pin the corrected behavior: the progress
    // overlay is still here and credentials are mounted but disabled.
    expect(screen.getByTestId("login-completing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /email/i })).toBeDisabled();
  });

  it("keeps TOTP verification digits-only in the MFA challenge dialog", async () => {
    const mockLogin = vi.mocked(authApi.login);
    const mockVerifyMfaChallenge = vi.mocked(authApi.verifyMfaChallenge);

    mockLogin.mockResolvedValueOnce({
      challenge: mfaChallengeFixture,
    });
    mockVerifyMfaChallenge.mockResolvedValueOnce({
      user: createAuthUser(),
      authentication: {
        mode: "session",
        mfa_completed: true,
      },
    });

    renderLogin();

    await screen.findByRole("button", { name: /log in/i });

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@secpal.dev" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await screen.findByRole("heading", { name: /second factor required/i });

    enterTotpCode("12a 34-56");

    expect(getTotpInput()).toHaveValue("");
    expect(
      screen.getByRole("button", { name: /verify and continue/i })
    ).toBeDisabled();

    enterTotpCode("123456");
    fireEvent.click(
      screen.getByRole("button", { name: /verify and continue/i })
    );

    await waitFor(() => {
      expect(mockVerifyMfaChallenge).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440099",
        {
          method: "totp",
          code: "123456",
        }
      );
    });
  });

  it("shows MFA verification errors inline inside the challenge dialog", async () => {
    const mockLogin = vi.mocked(authApi.login);
    const mockVerifyMfaChallenge = vi.mocked(authApi.verifyMfaChallenge);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mockLogin.mockResolvedValueOnce({
      challenge: {
        id: "550e8400-e29b-41d4-a716-446655440099",
        purpose: "login",
        login_context: "session",
        primary_method: "totp",
        available_methods: ["totp", "recovery_code"],
        expires_at: "2026-04-01T09:30:00Z",
      },
    });
    mockVerifyMfaChallenge.mockRejectedValueOnce(
      new authApi.AuthApiError("The login challenge has expired.")
    );

    renderLogin();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@secpal.dev" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await screen.findByRole("heading", { name: /second factor required/i });

    enterTotpCode("123456");
    fireEvent.click(
      screen.getByRole("button", { name: /verify and continue/i })
    );

    expect(
      await screen.findByText(/the login challenge has expired/i)
    ).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it("shows a login-form error if session finalization fails after MFA succeeds", async () => {
    const mockVerifyMfaChallenge = vi.mocked(authApi.verifyMfaChallenge);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    vi.spyOn(authStorage, "setUser").mockRejectedValueOnce(
      new Error("Failed to persist authenticated session.")
    );
    mockVerifyMfaChallenge.mockResolvedValueOnce({
      user: createAuthUser(),
      authentication: {
        mode: "session",
        mfa_completed: true,
      },
    });

    await openMfaDialog();
    enterTotpCode("123456");
    fireEvent.click(
      screen.getByRole("button", { name: /verify and continue/i })
    );

    expect(
      await screen.findByText(/failed to persist authenticated session/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /second factor required/i })
      ).not.toBeInTheDocument();
    });

    // isCompletingLogin must be reset: the "Completing sign-in" overlay must
    // be gone and the credential form must be re-accessible so the user can
    // retry without reloading the page.
    expect(screen.queryByTestId("login-completing")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it("localizes known MFA verification failures with the active locale", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    vi.mocked(authApi.verifyMfaChallenge).mockRejectedValueOnce(
      new authApi.AuthApiError("MFA verification failed")
    );

    await openMfaDialog();
    enterTotpCode("123456");

    act(() => {
      i18n.activate("de");
    });

    fireEvent.click(screen.getByRole("button", { name: /prüfen/i }));

    expect(
      await screen.findByText(/mfa-verifizierung fehlgeschlagen/i)
    ).toBeInTheDocument();

    act(() => {
      i18n.activate("en");
    });
    consoleErrorSpy.mockRestore();
  });

  it("localizes the backend 'multi-factor authentication code is invalid' wording", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    vi.mocked(authApi.verifyMfaChallenge).mockRejectedValueOnce(
      new authApi.AuthApiError(
        "The provided multi-factor authentication code is invalid."
      )
    );

    await openMfaDialog();
    enterTotpCode("123456");

    act(() => {
      i18n.activate("de");
    });

    fireEvent.click(screen.getByRole("button", { name: /prüfen/i }));

    expect(
      await screen.findByText(/mfa-verifizierung fehlgeschlagen/i)
    ).toBeInTheDocument();

    act(() => {
      i18n.activate("en");
    });
    consoleErrorSpy.mockRestore();
  });

  it("marks every OTP slot aria-invalid when the MFA verify fails so the red border styling applies", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    vi.mocked(authApi.verifyMfaChallenge).mockRejectedValueOnce(
      new authApi.AuthApiError(
        "The provided multi-factor authentication code is invalid."
      )
    );

    await openMfaDialog();
    enterTotpCode("123456");
    fireEvent.click(
      screen.getByRole("button", { name: /verify and continue/i })
    );

    await screen.findByText(
      /mfa verification failed\. please check your code\./i
    );

    const slots = document.querySelectorAll<HTMLDivElement>(
      '[data-slot="login-input-otp-slot"]'
    );
    expect(slots).toHaveLength(6);
    slots.forEach((slot) => {
      expect(slot).toHaveAttribute("aria-invalid", "true");
    });

    consoleErrorSpy.mockRestore();
  });

  it("closes the MFA dialog when the cancel button is clicked", async () => {
    await openMfaDialog();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /second factor required/i })
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("switches to the recovery code input when the user clicks the lost-device toggle", async () => {
    await openMfaDialog();

    switchToRecoveryCodeMode();

    // The recovery-code input is an alphanumeric input-otp split 4-separator-4
    // (mirrors the shadcn `input-otp` "Pattern" example): 8 slots and a
    // single visual separator.
    expect(
      document.querySelectorAll('[data-slot="login-input-otp-slot"]')
    ).toHaveLength(8);
    expect(
      document.querySelectorAll('[data-slot="login-input-otp-separator"]')
    ).toHaveLength(1);

    const recoveryInput = getRecoveryCodeInput();
    expect(recoveryInput).toHaveAttribute("inputmode", "text");
    expect(recoveryInput).toHaveAttribute("maxlength", "8");

    // The toggle now offers switching back to TOTP.
    expect(
      screen.getByRole("button", { name: /use authenticator code/i })
    ).toBeInTheDocument();
  });

  it("verifies an MFA challenge with a recovery code fallback", async () => {
    const mockVerifyMfaChallenge = vi.mocked(authApi.verifyMfaChallenge);
    mockVerifyMfaChallenge.mockResolvedValueOnce({
      user: createAuthUser(),
      authentication: {
        mode: "session",
        mfa_completed: true,
      },
    });

    await openMfaDialog();
    switchToRecoveryCodeMode();
    // Input-otp accepts lowercase letters too; `textTransform="uppercase"`
    // normalizes them so the backend never sees mixed-case codes.
    enterRecoveryCode("b6f42q8p");
    fireEvent.click(
      screen.getByRole("button", { name: /verify and continue/i })
    );

    await waitFor(() => {
      expect(mockVerifyMfaChallenge).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440099",
        {
          method: "recovery_code",
          code: "B6F42Q8P",
        }
      );
    });
  });

  it("closes the MFA dialog and surfaces an expiry error when the challenge has been invalidated (404)", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // After a failed verification, the backend invalidates the challenge
    // id (one-shot pattern). The next submit on the same id returns a 404
    // with a generic body — "Ressource nicht gefunden." in German — that
    // would otherwise leak through the MFA dialog as the user's only
    // feedback. We close the dialog and surface a localized, actionable
    // expiry message on the password form instead.
    vi.mocked(authApi.verifyMfaChallenge).mockRejectedValueOnce(
      new authApi.AuthApiError(
        "Ressource nicht gefunden.",
        undefined,
        404,
        undefined
      )
    );

    await openMfaDialog();
    enterTotpCode("123456");
    fireEvent.click(
      screen.getByRole("button", { name: /verify and continue/i })
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /second factor required/i })
      ).not.toBeInTheDocument();
    });

    expect(
      await screen.findByText(/your verification session expired/i)
    ).toBeInTheDocument();
    // The generic 404 body must NOT leak to the user.
    expect(
      screen.queryByText(/ressource nicht gefunden/i)
    ).not.toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it("shows an error when MFA challenge response has an unexpected mode", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    vi.mocked(authApi.verifyMfaChallenge).mockResolvedValueOnce({
      user: createAuthUser(),
      authentication: {
        mode: "token" as unknown as "session",
        mfa_completed: true,
      },
    });
    await openMfaDialog();
    enterTotpCode("123456");
    fireEvent.click(
      screen.getByRole("button", { name: /verify and continue/i })
    );
    expect(
      await screen.findByText(
        /the mfa challenge completed with an unsupported login mode/i
      )
    ).toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });

  it("displays error message on login failure", async () => {
    const mockLogin = vi.mocked(authApi.login);
    const testError = new authApi.AuthApiError(
      "The provided credentials are incorrect."
    );
    // Keep rejection active for every invocation in this test flow
    // (e.g., rerenders/retries), so the failure path remains deterministic.
    mockLogin.mockRejectedValue(testError);

    renderLogin();

    // Wait for health check to complete
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /log in/i });

    fireEvent.change(emailInput, { target: { value: "wrong@secpal.dev" } });
    fireEvent.change(passwordInput, { target: { value: "wrongpass" } });
    fireEvent.click(submitButton);

    // Wait for the error to appear with explicit screen query
    const errorElement = await screen.findByText(
      /the provided credentials are incorrect/i,
      {},
      { timeout: 3000 }
    );
    expect(errorElement).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInvalid();
    expect(screen.getByLabelText(/password/i)).toBeInvalid();
    expect(screen.getByLabelText(/email/i)).toHaveAccessibleDescription(
      /the provided credentials are incorrect/i
    );
  });

  it("localizes invalid-credentials login errors with the active locale", async () => {
    const mockLogin = vi.mocked(authApi.login);
    mockLogin.mockRejectedValue(
      new authApi.AuthApiError("The provided credentials are incorrect.")
    );

    act(() => {
      i18n.activate("de");
    });

    renderLogin();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in|einloggen|anmelden/i })
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/e-?mail|email/i), {
      target: { value: "wrong@secpal.dev" },
    });
    fireEvent.change(screen.getByLabelText(/passwort|password/i), {
      target: { value: "wrongpass" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /log in|einloggen|anmelden/i })
    );

    expect(
      await screen.findByText(/angegebenen zugangsdaten.*falsch/i)
    ).toBeInTheDocument();

    act(() => {
      i18n.activate("en");
    });
  });

  it("replaces raw 5xx login errors with a controlled temporary-unavailable message", async () => {
    const mockLogin = vi.mocked(authApi.login);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mockLogin.mockRejectedValueOnce(
      new authApi.AuthApiError("Server Error", undefined, 500)
    );

    renderLogin();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@secpal.dev" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(
      await screen.findByText(
        /login is temporarily unavailable\. please try again later\./i
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/^server error$/i)).not.toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Login error:",
      expect.any(authApi.AuthApiError)
    );

    consoleErrorSpy.mockRestore();
  });

  it("displays generic error message for non-AuthApiError", async () => {
    const mockLogin = vi.mocked(authApi.login);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockLogin.mockRejectedValueOnce(new Error("Network error"));

    renderLogin();

    // Wait for health check to complete
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /log in/i });

    fireEvent.change(emailInput, { target: { value: "test@secpal.dev" } });
    fireEvent.change(passwordInput, { target: { value: "password" } });
    fireEvent.click(submitButton);

    const errorElement = await screen.findByText(/network error/i);
    expect(errorElement).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Login error:",
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it("displays fallback error message for unknown error types", async () => {
    const mockLogin = vi.mocked(authApi.login);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockLogin.mockRejectedValueOnce("string error");

    renderLogin();

    // Wait for health check to complete
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /log in/i });

    fireEvent.change(emailInput, { target: { value: "test@secpal.dev" } });
    fireEvent.change(passwordInput, { target: { value: "password" } });
    fireEvent.click(submitButton);

    const errorElement = await screen.findByText(
      /an unexpected error occurred.*try again.*contact support/i
    );
    expect(errorElement).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  describe("credential aria-invalid scoping", () => {
    // `aria-invalid` on the email/password inputs must reflect only failures
    // caused by the typed values themselves (401/403/422 + opaque network
    // errors after a credential submit). Server outages, rate-limit
    // lockouts, passkey failures, and post-credential MFA expiry set the
    // top-level `error` text but say nothing about the inputs; flagging the
    // fields invalid in those cases misleads assistive technology users.

    async function getCredentialInputs() {
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });
      return {
        email: screen.getByLabelText(/email/i),
        password: screen.getByLabelText(/password/i),
        submit: screen.getByRole("button", { name: /log in/i }),
      };
    }

    it("marks the credential inputs invalid after a 401 rejection", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.mocked(authApi.login).mockRejectedValueOnce(
        new authApi.AuthApiError("Invalid email or password.", undefined, 401)
      );

      renderLogin();
      const { email, password, submit } = await getCredentialInputs();

      fireEvent.change(email, { target: { value: "wrong@secpal.dev" } });
      fireEvent.change(password, { target: { value: "wrong-password" } });
      fireEvent.click(submit);

      await waitFor(() => {
        expect(email).toHaveAttribute("aria-invalid", "true");
        expect(password).toHaveAttribute("aria-invalid", "true");
      });

      consoleErrorSpy.mockRestore();
    });

    it("does NOT mark the credential inputs invalid on a 5xx server outage", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.mocked(authApi.login).mockRejectedValueOnce(
        new authApi.AuthApiError("Internal Server Error", undefined, 500)
      );

      renderLogin();
      const { email, password, submit } = await getCredentialInputs();

      fireEvent.change(email, { target: { value: "ok@secpal.dev" } });
      fireEvent.change(password, { target: { value: "ok-password" } });
      fireEvent.click(submit);

      await screen.findByText(/login is temporarily unavailable/i);
      expect(email).not.toHaveAttribute("aria-invalid");
      expect(password).not.toHaveAttribute("aria-invalid");

      consoleErrorSpy.mockRestore();
    });

    it("does NOT mark the credential inputs invalid on a 429 lockout", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.mocked(authApi.login).mockRejectedValueOnce(
        new authApi.AuthApiError(
          "Too many login attempts. Please try again later.",
          undefined,
          429,
          undefined,
          30
        )
      );

      renderLogin();
      const { email, password, submit } = await getCredentialInputs();

      fireEvent.change(email, { target: { value: "ok@secpal.dev" } });
      fireEvent.change(password, { target: { value: "ok-password" } });
      fireEvent.click(submit);

      await screen.findByText(/too many login attempts/i);
      expect(email).not.toHaveAttribute("aria-invalid");
      expect(password).not.toHaveAttribute("aria-invalid");

      consoleErrorSpy.mockRestore();
    });

    it("clears aria-invalid when the user starts editing the credentials again", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.mocked(authApi.login).mockRejectedValueOnce(
        new authApi.AuthApiError("Invalid email or password.", undefined, 401)
      );

      renderLogin();
      const { email, password, submit } = await getCredentialInputs();

      fireEvent.change(email, { target: { value: "wrong@secpal.dev" } });
      fireEvent.change(password, { target: { value: "wrong-password" } });
      fireEvent.click(submit);

      await waitFor(() => {
        expect(email).toHaveAttribute("aria-invalid", "true");
      });

      // Single keystroke in either field clears the invalid flag — the user
      // is correcting the value and is no longer being told the prior input
      // is wrong.
      fireEvent.change(email, { target: { value: "right@secpal.dev" } });
      expect(email).not.toHaveAttribute("aria-invalid");
      expect(password).not.toHaveAttribute("aria-invalid");

      consoleErrorSpy.mockRestore();
    });
  });

  it("disables submit button while submitting", async () => {
    const mockLogin = vi.mocked(authApi.login);
    mockLogin.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    renderLogin();

    // Wait for health check to complete
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /log in/i });

    fireEvent.change(emailInput, { target: { value: "test@secpal.dev" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/logging in/i)).toBeInTheDocument();
  });

  it("clears error message on new submission", async () => {
    const mockLogin = vi.mocked(authApi.login);

    // First call: error
    mockLogin.mockRejectedValueOnce(new authApi.AuthApiError("First error"));

    renderLogin();

    // Wait for health check to complete
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /log in/i });
    fireEvent.change(emailInput, { target: { value: "test@secpal.dev" } });
    fireEvent.change(passwordInput, { target: { value: "wrong" } });
    fireEvent.click(submitButton);

    // Wait for error to appear
    const errorElement = await screen.findByText(
      /first error/i,
      {},
      { timeout: 3000 }
    );
    expect(errorElement).toBeInTheDocument();

    // Second call: success
    mockLogin.mockResolvedValueOnce({
      user: createAuthUser({ name: "Test" }),
    });

    // Second submission should clear error
    fireEvent.change(passwordInput, { target: { value: "correct" } });
    fireEvent.click(submitButton);

    // Wait for error to disappear
    await waitFor(() => {
      expect(screen.queryByText(/first error/i)).not.toBeInTheDocument();
    });
  });

  it("requires email and password fields", async () => {
    renderLogin();

    // Wait for health check to complete
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
  });

  it("uses email input type for email field", async () => {
    renderLogin();

    // Wait for health check to complete to avoid act() warnings
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toHaveAttribute("type", "email");
  });

  it("uses password input type for password field", async () => {
    renderLogin();

    // Wait for health check to complete to avoid act() warnings
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  describe("Health Check Integration", () => {
    it("enables login when health check passes", async () => {
      vi.mocked(healthApi.checkHealth).mockResolvedValue(
        createHealthyResponse()
      );

      renderLogin();

      // Wait for health check to complete
      await waitFor(() => {
        const submitButton = screen.getByRole("button", { name: /log in/i });
        expect(submitButton).not.toBeDisabled();
      });

      // No warning should be displayed
      expect(screen.queryByText(/system not ready/i)).not.toBeInTheDocument();
    });

    it("disables login and shows warning when health check returns not_ready", async () => {
      vi.mocked(healthApi.checkHealth).mockResolvedValue(
        createUnhealthyResponse()
      );

      renderLogin();

      // Wait for health check to complete and warning to appear
      await waitFor(() => {
        expect(screen.getByText(/system not ready/i)).toBeInTheDocument();
      });

      // Button should be disabled
      const submitButton = screen.getByRole("button", { name: /log in/i });
      expect(submitButton).toBeDisabled();

      // Input fields should be disabled
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
    });

    it("keeps login enabled and hides the warning when health check fails with a transport error", async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(healthApi.checkHealth).mockRejectedValue(
          new healthApi.HealthCheckError("Network error")
        );

        renderLogin();

        await act(async () => {
          await vi.runAllTimersAsync();
        });

        expect(vi.mocked(healthApi.checkHealth)).toHaveBeenCalledTimes(3);
        expect(screen.queryByText(/system not ready/i)).not.toBeInTheDocument();

        const submitButton = screen.getByRole("button", { name: /log in/i });
        const emailInput = screen.getByLabelText(/email/i);
        const passwordInput = screen.getByLabelText(/password/i);

        expect(submitButton).toBeEnabled();
        expect(emailInput).toBeEnabled();
        expect(passwordInput).toBeEnabled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("shows 'Checking system...' while health check is in progress", async () => {
      // Create a promise that we can control
      let resolveHealthCheck: (value: healthApi.HealthStatus) => void;
      const healthCheckPromise = new Promise<healthApi.HealthStatus>(
        (resolve) => {
          resolveHealthCheck = resolve;
        }
      );
      vi.mocked(healthApi.checkHealth).mockReturnValue(healthCheckPromise);

      renderLogin();

      // Should show "Checking system..." while loading
      expect(screen.getByText(/checking system/i)).toBeInTheDocument();

      // Resolve the health check
      resolveHealthCheck!(createHealthyResponse());

      // Wait for the button text to change
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });
    });

    it("displays administrator contact message when system not ready", async () => {
      vi.mocked(healthApi.checkHealth).mockResolvedValue(
        createUnhealthyResponse()
      );

      renderLogin();

      await waitFor(() => {
        expect(
          screen.getByText(/contact your administrator/i)
        ).toBeInTheDocument();
      });
    });

    it("has accessible warning with proper ARIA attributes", async () => {
      vi.mocked(healthApi.checkHealth).mockResolvedValue(
        createUnhealthyResponse()
      );

      renderLogin();

      await waitFor(() => {
        const warning = document.getElementById("health-warning");
        expect(warning).toBeInTheDocument();
        expect(warning).toHaveAttribute("role", "alert");
        expect(warning).toHaveAttribute("aria-live", "assertive");
      });
    });

    it("retries transient health-check failures before showing the warning", async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(healthApi.checkHealth)
          .mockRejectedValueOnce(
            new healthApi.HealthCheckError("Network error")
          )
          .mockResolvedValueOnce(createHealthyResponse());

        renderLogin();

        // Flush the retry backoff timer(s) and React updates without waiting in real time.
        await act(async () => {
          await vi.runAllTimersAsync();
        });

        expect(vi.mocked(healthApi.checkHealth)).toHaveBeenCalledTimes(2);
        expect(screen.queryByText(/system not ready/i)).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /log in/i })).toBeEnabled();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("login rate limiting", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("records failed login attempts", async () => {
      const mockLogin = vi.mocked(authApi.login);
      mockLogin.mockRejectedValue(
        new authApi.AuthApiError("Invalid credentials")
      );

      renderLogin();

      // Wait for health check to complete
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", { name: /log in/i });

      // First failed attempt
      fireEvent.change(emailInput, { target: { value: "test@secpal.dev" } });
      fireEvent.change(passwordInput, { target: { value: "wrong" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/provided credentials are incorrect/i)
        ).toBeInTheDocument();
      });

      // Check localStorage has recorded the attempt
      const stored = localStorage.getItem("login_rate_limit");
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.attempts).toBe(1);
    });

    it("shows remaining attempts warning after 3 failed attempts", async () => {
      // Pre-set 2 failed attempts in localStorage
      const initialState = {
        attempts: 2,
        lockoutEndTime: null,
        lastAttemptTime: Date.now(),
      };
      localStorage.setItem("login_rate_limit", JSON.stringify(initialState));

      const mockLogin = vi.mocked(authApi.login);
      mockLogin.mockRejectedValue(
        new authApi.AuthApiError("Invalid credentials")
      );

      renderLogin();

      // Wait for health check to complete
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", { name: /log in/i });

      // Third failed attempt - should show warning
      fireEvent.change(emailInput, { target: { value: "test@secpal.dev" } });
      fireEvent.change(passwordInput, { target: { value: "wrong" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/attempt\(s\) remaining/i)).toBeInTheDocument();
      });
    });

    it("locks user out after 5 failed attempts", async () => {
      // Pre-set 4 failed attempts in localStorage
      const initialState = {
        attempts: 4,
        lockoutEndTime: null,
        lastAttemptTime: Date.now(),
      };
      localStorage.setItem("login_rate_limit", JSON.stringify(initialState));

      const mockLogin = vi.mocked(authApi.login);
      mockLogin.mockRejectedValue(
        new authApi.AuthApiError("Invalid credentials")
      );

      renderLogin();

      // Wait for health check to complete
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", { name: /log in/i });

      // Fifth failed attempt - should trigger lockout
      fireEvent.change(emailInput, { target: { value: "test@secpal.dev" } });
      fireEvent.change(passwordInput, { target: { value: "wrong" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/too many failed attempts/i)
        ).toBeInTheDocument();
      });
    });

    it("applies a server-authoritative lockout when login returns 429 with retry-after", async () => {
      const mockLogin = vi.mocked(authApi.login);
      mockLogin.mockRejectedValueOnce(
        new authApi.AuthApiError(
          "Too many login attempts. Please try again later.",
          undefined,
          429,
          undefined,
          120
        )
      );

      renderLogin();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "test@secpal.dev" },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: "wrong" },
      });
      fireEvent.click(screen.getByRole("button", { name: /log in/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/too many failed attempts/i)
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText(/too many login attempts\. please try again later\./i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /locked \(\d+s\)/i })
      ).toBeDisabled();

      const stored = JSON.parse(
        localStorage.getItem("login_rate_limit") || "{}"
      );
      expect(stored.attempts).toBe(5);
    });

    it("does not lock out when login returns 429 with Retry-After: 0", async () => {
      const mockLogin = vi.mocked(authApi.login);
      mockLogin.mockRejectedValueOnce(
        new authApi.AuthApiError(
          "Too many login attempts. Please try again later.",
          undefined,
          429,
          undefined,
          0
        )
      );

      renderLogin();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "test@secpal.dev" },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: "wrong" },
      });
      fireEvent.click(screen.getByRole("button", { name: /log in/i }));

      await waitFor(() => {
        expect(
          screen.getByText(
            /too many login attempts\. please try again later\./i
          )
        ).toBeInTheDocument();
      });

      // Retry-After: 0 means retry immediately — form must remain enabled
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).not.toBeDisabled();
      expect(screen.getByLabelText(/email/i)).not.toBeDisabled();
    });

    it("disables form inputs and button during lockout", async () => {
      // Pre-set lockout state in localStorage
      const futureTime = Date.now() + 30000; // 30 seconds in future
      const lockedState = {
        attempts: 5,
        lockoutEndTime: futureTime,
        lastAttemptTime: Date.now(),
      };
      localStorage.setItem("login_rate_limit", JSON.stringify(lockedState));

      renderLogin();

      // Wait for health check to complete
      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeDisabled();
      });

      expect(screen.getByLabelText(/password/i)).toBeDisabled();
      expect(screen.getByRole("button", { name: /locked/i })).toBeDisabled();
    });

    it("shows countdown timer during lockout", async () => {
      // Pre-set lockout state in localStorage
      const futureTime = Date.now() + 30000; // 30 seconds in future
      const lockedState = {
        attempts: 5,
        lockoutEndTime: futureTime,
        lastAttemptTime: Date.now(),
      };
      localStorage.setItem("login_rate_limit", JSON.stringify(lockedState));

      renderLogin();

      await waitFor(() => {
        // Button should show remaining seconds
        expect(
          screen.getByRole("button", { name: /locked/i })
        ).toBeInTheDocument();
      });
    });

    it("resets rate limit state on successful login", async () => {
      // Pre-set some failed attempts
      const initialState = {
        attempts: 2,
        lockoutEndTime: null,
        lastAttemptTime: Date.now(),
      };
      localStorage.setItem("login_rate_limit", JSON.stringify(initialState));

      const mockLogin = vi.mocked(authApi.login);
      mockLogin.mockResolvedValueOnce({
        user: createAuthUser({ name: "Test" }),
      });

      renderLogin();

      // Wait for health check to complete
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", { name: /log in/i });

      fireEvent.change(emailInput, { target: { value: "test@secpal.dev" } });
      fireEvent.change(passwordInput, { target: { value: "correct" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        // After successful login, localStorage should be cleared
        expect(localStorage.getItem("login_rate_limit")).toBeNull();
      });
    });
  });

  describe("Offline Behavior", () => {
    beforeEach(() => {
      vi.mocked(useOnlineStatus).mockReturnValue(false);
    });

    it("shows offline warning when user is offline", async () => {
      renderLogin();

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByText(/no internet connection/i)).toBeInTheDocument();
      });

      expect(
        screen.getByText(/login requires an internet connection/i)
      ).toBeInTheDocument();
    });

    it("disables login form fields when offline", async () => {
      renderLogin();

      // Wait for health check to complete
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", { name: /log in/i });

      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(submitButton).toBeDisabled();
    });

    it("does not show system not ready warning when offline", async () => {
      // Even if health check would fail, we should only show offline warning
      vi.mocked(healthApi.checkHealth).mockRejectedValue(
        new healthApi.HealthCheckError("Network error")
      );

      renderLogin();

      await waitFor(() => {
        expect(screen.getByText(/no internet connection/i)).toBeInTheDocument();
      });

      // System not ready warning should NOT appear
      expect(screen.queryByText(/system not ready/i)).not.toBeInTheDocument();
    });

    it("has accessible offline warning with proper ARIA attributes", async () => {
      renderLogin();

      await waitFor(() => {
        const warning = document.getElementById("offline-warning");
        expect(warning).toBeInTheDocument();
        expect(warning).toHaveAttribute("role", "alert");
        expect(warning).toHaveAttribute("aria-live", "assertive");
      });
    });

    it("prevents login when offline", async () => {
      const mockLogin = vi.mocked(authApi.login);

      renderLogin();

      // Wait for health check to complete
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });

      const submitButton = screen.getByRole("button", { name: /log in/i });

      // Submit button should be disabled
      expect(submitButton).toBeDisabled();

      // Even if we try to click it, login should not be called
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).not.toHaveBeenCalled();
      });
    });

    it("shows offline warning immediately when offline", async () => {
      // Start offline - health check should not run
      vi.mocked(useOnlineStatus).mockReturnValue(false);
      const mockCheckHealth = vi.mocked(healthApi.checkHealth);
      mockCheckHealth.mockResolvedValue(createHealthyResponse());

      renderLogin();

      // Offline warning should appear immediately
      await waitFor(() => {
        expect(screen.getByText(/no internet connection/i)).toBeInTheDocument();
      });

      // Health check should NOT have been called
      expect(mockCheckHealth).not.toHaveBeenCalled();

      // Form should be disabled and button should say "Log in" (not "Checking system...")
      const submitButton = screen.getByRole("button", {
        name: /log in/i,
      });
      expect(submitButton).toBeDisabled();
    });

    it("switches from system not ready to offline warning when going offline", async () => {
      // Start online with unhealthy system
      vi.mocked(useOnlineStatus).mockReturnValue(true);
      vi.mocked(healthApi.checkHealth).mockResolvedValue(
        createUnhealthyResponse()
      );

      const { rerender } = renderLogin();

      // Wait for system not ready warning
      await waitFor(() => {
        expect(screen.getByText(/system not ready/i)).toBeInTheDocument();
      });

      // Now go offline
      vi.mocked(useOnlineStatus).mockReturnValue(false);

      // Re-render
      rerender(
        <MemoryRouter initialEntries={["/login"]}>
          <I18nProvider i18n={i18n}>
            <AuthProvider>
              <Login />
            </AuthProvider>
          </I18nProvider>
        </MemoryRouter>
      );

      // Should now show offline warning instead
      await waitFor(() => {
        expect(screen.getByText(/no internet connection/i)).toBeInTheDocument();
      });

      // System not ready warning should be gone
      expect(screen.queryByText(/system not ready/i)).not.toBeInTheDocument();
    });

    it("retries health check when coming back online", async () => {
      // Start offline
      vi.mocked(useOnlineStatus).mockReturnValue(false);
      const mockCheckHealth = vi.mocked(healthApi.checkHealth);
      mockCheckHealth.mockResolvedValue(createHealthyResponse());

      const { rerender } = renderLogin();

      // Should show offline warning
      await waitFor(() => {
        expect(screen.getByText(/no internet connection/i)).toBeInTheDocument();
      });

      // Health check should NOT have been called when offline
      expect(mockCheckHealth).not.toHaveBeenCalled();

      // Now go online
      vi.mocked(useOnlineStatus).mockReturnValue(true);

      // Re-render to trigger online status change
      rerender(
        <MemoryRouter initialEntries={["/login"]}>
          <I18nProvider i18n={i18n}>
            <AuthProvider>
              <Login />
            </AuthProvider>
          </I18nProvider>
        </MemoryRouter>
      );

      // Should retry health check now that we're online
      await waitFor(() => {
        expect(mockCheckHealth).toHaveBeenCalled();
      });

      // Should show ready state (no warnings)
      await waitFor(() => {
        expect(
          screen.queryByText(/no internet connection/i)
        ).not.toBeInTheDocument();
        expect(screen.queryByText(/system not ready/i)).not.toBeInTheDocument();
      });

      // Login button should be enabled
      const submitButton = screen.getByRole("button", { name: /log in/i });
      expect(submitButton).not.toBeDisabled();
    });

    it("keeps login enabled if the health check transport fails after coming online", async () => {
      // Start offline
      vi.mocked(useOnlineStatus).mockReturnValue(false);
      const mockCheckHealth = vi.mocked(healthApi.checkHealth);

      const { rerender } = renderLogin();

      await screen.findByText(/no internet connection/i);

      vi.useFakeTimers();
      try {
        // Now go online but the readiness probe keeps failing in transport.
        vi.mocked(useOnlineStatus).mockReturnValue(true);
        mockCheckHealth.mockRejectedValue(
          new healthApi.HealthCheckError("Network error")
        );

        rerender(
          <MemoryRouter initialEntries={["/login"]}>
            <I18nProvider i18n={i18n}>
              <AuthProvider>
                <Login />
              </AuthProvider>
            </I18nProvider>
          </MemoryRouter>
        );

        await act(async () => {
          await vi.runAllTimersAsync();
        });

        expect(mockCheckHealth).toHaveBeenCalledTimes(3);
        expect(screen.queryByText(/system not ready/i)).not.toBeInTheDocument();

        const submitButton = screen.getByRole("button", { name: /log in/i });
        expect(submitButton).toBeEnabled();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("language switcher", () => {
    it("switches translated login status and MFA dialog copy after selecting German", async () => {
      vi.mocked(i18nModule.activateLocale).mockImplementationOnce(
        async (locale) => {
          i18n.activate(locale);
        }
      );
      vi.mocked(authApi.login)
        .mockRejectedValueOnce(new authApi.AuthApiError("Invalid credentials"))
        .mockResolvedValueOnce({
          challenge: mfaChallengeFixture,
        });

      renderLogin();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });

      await selectLanguage("Deutsch");

      await waitFor(() => {
        expect(i18nModule.setLocalePreference).toHaveBeenCalledWith("de");
      });
      expect(screen.getByLabelText(/e-mail-adresse/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /einloggen/i })
      ).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/e-mail-adresse/i), {
        target: { value: "wrong@secpal.dev" },
      });
      fireEvent.change(screen.getByLabelText(/passwort/i), {
        target: { value: "wrong-password" },
      });
      fireEvent.click(screen.getByRole("button", { name: /einloggen/i }));

      expect(
        await screen.findByText(/die angegebenen zugangsdaten sind falsch/i)
      ).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/passwort/i), {
        target: { value: "correct-password" },
      });
      fireEvent.click(screen.getByRole("button", { name: /einloggen/i }));

      expect(
        await screen.findByRole("heading", {
          name: /zweiter faktor erforderlich/i,
        })
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/authenticator-code/i)).toHaveAttribute(
        "inputmode",
        "numeric"
      );
      expect(
        screen.getByRole("button", { name: /überprüfen und fortfahren/i })
      ).toBeDisabled();

      act(() => {
        i18n.activate("en");
      });
    });

    it("shows the localized fallback error message when locale activation fails", async () => {
      vi.mocked(i18nModule.activateLocale).mockRejectedValueOnce(
        new Error("Failed to fetch chunk /assets/de-abc123.js")
      );

      renderLogin();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });

      await selectLanguage("Deutsch");

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /failed to change language/i
      );

      expect(
        screen.queryByText(/failed to fetch chunk/i)
      ).not.toBeInTheDocument();
    });

    it("does not show an error when locale activation succeeds", async () => {
      vi.mocked(i18nModule.activateLocale).mockResolvedValueOnce(undefined);

      renderLogin();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });

      await selectLanguage("Deutsch");

      await waitFor(() => {
        expect(i18nModule.setLocalePreference).toHaveBeenCalledWith("de");
      });

      expect(
        screen.queryByRole("alert", { name: /failed to change language/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("footer", () => {
    it("places the legal footer below the centered credential card in normal flow", async () => {
      renderLogin();

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });

      // The shell is a `flex-col` container, NOT vertically centered. The
      // centered-card region is the first flex-1 child; the footer follows
      // it in normal flow. This guarantees the footer never overlaps the
      // credential card on short landscape viewports (≈320px tall), where
      // an `absolute`-positioned footer with `pb-32` could collide.
      const shell = screen.getByRole("main");
      expect(shell).toHaveClass("min-h-dvh", "flex", "flex-col");
      expect(shell).not.toHaveClass("justify-center");

      const footer = screen.getByRole("contentinfo");
      expect(footer).not.toHaveClass("absolute");

      const card = screen
        .getByRole("button", { name: /log in/i })
        .closest("section");
      expect(card).not.toBeNull();
      // The card lives inside the flex-1 wrapper; the footer is a sibling of
      // that wrapper, which puts it strictly after the card in document order.
      // `compareDocumentPosition` returns FOLLOWING (4) when `card` precedes
      // `footer` in the DOM.
      expect(card!.compareDocumentPosition(footer)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    });

    it("renders footer with license and source code links", async () => {
      renderLogin();

      // Wait for initial render
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });

      // Check for license link
      const licenseLink = screen.getByRole("link", { name: /agpl v3\+/i });
      expect(licenseLink).toBeInTheDocument();
      expect(licenseLink).toHaveAttribute(
        "href",
        "https://www.gnu.org/licenses/agpl-3.0.html"
      );
      expect(licenseLink).toHaveAttribute("target", "_blank");

      // Check for source code link
      const sourceLink = screen.getByRole("link", { name: /source code/i });
      expect(sourceLink).toBeInTheDocument();
      expect(sourceLink).toHaveAttribute("href", "https://github.com/SecPal");
      expect(sourceLink).toHaveAttribute("target", "_blank");
    });

    it("renders footer with SecPal slogan", async () => {
      renderLogin();

      await waitFor(() => {
        expect(
          screen.getByRole("link", {
            name: "Powered by SecPal – A guard's best friend",
          })
        ).toBeInTheDocument();
      });
    });
  });
});
