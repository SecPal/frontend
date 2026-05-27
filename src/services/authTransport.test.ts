// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NativeAuthBridge } from "./authTransport";
import {
  AuthApiError,
  getAuthTransport,
  resolveAuthTransport,
} from "./authTransport";

const {
  mockBrowserLogin,
  mockBrowserLogout,
  mockBrowserLogoutAll,
  mockBrowserGetCurrentUser,
  mockRevokeBrowserNotificationInstallation,
  mockPeekBrowserPushInstallationId,
  mockClearBrowserPushInstallationId,
} = vi.hoisted(() => ({
  mockBrowserLogin: vi.fn(),
  mockBrowserLogout: vi.fn(),
  mockBrowserLogoutAll: vi.fn(),
  mockBrowserGetCurrentUser: vi.fn(),
  mockRevokeBrowserNotificationInstallation: vi.fn(),
  mockPeekBrowserPushInstallationId: vi.fn(),
  mockClearBrowserPushInstallationId: vi.fn(),
}));

vi.mock("./authApi", async () => {
  const actual = await vi.importActual("./authApi");

  return {
    ...actual,
    login: mockBrowserLogin,
    logout: mockBrowserLogout,
    logoutAll: mockBrowserLogoutAll,
    getCurrentUser: mockBrowserGetCurrentUser,
  };
});

vi.mock("./notificationInstallationsApi", () => ({
  revokeBrowserNotificationInstallation:
    mockRevokeBrowserNotificationInstallation,
}));

vi.mock("../lib/browserPushState", async () => {
  const actual = await vi.importActual("../lib/browserPushState");

  return {
    ...actual,
    peekBrowserPushInstallationId: mockPeekBrowserPushInstallationId,
    clearBrowserPushInstallationId: mockClearBrowserPushInstallationId,
  };
});

describe("authTransport", () => {
  const authTransportGlobal = globalThis as Record<string, unknown>;
  const hadNativeBridge = "SecPalNativeAuthBridge" in authTransportGlobal;
  const originalNativeBridge = authTransportGlobal.SecPalNativeAuthBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    delete authTransportGlobal.SecPalNativeAuthBridge;
  });

  afterEach(() => {
    if (hadNativeBridge) {
      authTransportGlobal.SecPalNativeAuthBridge = originalNativeBridge;
    } else {
      delete authTransportGlobal.SecPalNativeAuthBridge;
    }
  });

  it("defaults to the browser-session transport when no native bridge is present", async () => {
    mockBrowserLogin.mockResolvedValueOnce({
      user: {
        id: 1,
        name: "Browser User",
        email: "browser@secpal.dev",
        emailVerified: true,
        token: "should-not-leak",
      },
    });

    const transport = getAuthTransport();
    const result = await transport.login({
      email: "browser@secpal.dev",
      password: "password123",
    });

    expect(transport.kind).toBe("browser-session");
    expect(mockBrowserLogin).toHaveBeenCalledWith({
      email: "browser@secpal.dev",
      password: "password123",
    });
    expect(result).toEqual({
      status: "authenticated",
      user: {
        id: "1",
        name: "Browser User",
        email: "browser@secpal.dev",
        emailVerified: true,
      },
    });
    expect(result.status).toBe("authenticated");
    if (result.status === "authenticated") {
      expect(result.user).not.toHaveProperty("token");
    }
  });

  it("prefers the canonical current-user payload after a browser-session login", async () => {
    mockBrowserLogin.mockResolvedValueOnce({
      user: {
        id: 1,
        name: "Customer User",
        email: "customer@secpal.dev",
        emailVerified: true,
        hasCustomerAccess: true,
      },
    });
    mockBrowserGetCurrentUser.mockResolvedValueOnce({
      id: 1,
      name: "Manager User",
      email: "manager@secpal.dev",
      emailVerified: true,
      permissions: ["employees.read", "activity_log.read"],
      hasOrganizationalScopes: true,
      hasCustomerAccess: true,
      hasSiteAccess: true,
    });

    const transport = getAuthTransport();
    const result = await transport.login({
      email: "customer@secpal.dev",
      password: "password123",
    });

    expect(mockBrowserLogin).toHaveBeenCalledWith({
      email: "customer@secpal.dev",
      password: "password123",
    });
    expect(mockBrowserGetCurrentUser).toHaveBeenCalledOnce();
    expect(result).toEqual({
      status: "authenticated",
      user: {
        id: "1",
        name: "Manager User",
        email: "manager@secpal.dev",
        emailVerified: true,
        permissions: ["employees.read", "activity_log.read"],
        hasOrganizationalScopes: true,
        hasCustomerAccess: true,
        hasSiteAccess: true,
      },
    });
  });

  it("falls back to the login payload when the current-user fetch fails", async () => {
    mockBrowserLogin.mockResolvedValueOnce({
      user: {
        id: 1,
        name: "Login User",
        email: "user@secpal.dev",
        emailVerified: true,
      },
    });
    mockBrowserGetCurrentUser.mockRejectedValueOnce(
      new AuthApiError("Unauthorized")
    );

    const transport = getAuthTransport();
    const result = await transport.login({
      email: "user@secpal.dev",
      password: "password123",
    });

    expect(mockBrowserGetCurrentUser).toHaveBeenCalledOnce();
    expect(result).toEqual({
      status: "authenticated",
      user: {
        id: "1",
        name: "Login User",
        email: "user@secpal.dev",
        emailVerified: true,
      },
    });
  });

  it("reports browser network availability from navigator.onLine", async () => {
    const onLineSpy = vi
      .spyOn(window.navigator, "onLine", "get")
      .mockReturnValue(false);

    try {
      const transport = getAuthTransport();

      await expect(transport.isNetworkAvailable()).resolves.toBe(false);
    } finally {
      onLineSpy.mockRestore();
    }
  });

  it("reports that the browser-session transport does not support transport-managed passkey login", async () => {
    const transport = getAuthTransport();

    expect(transport.supportsPasskeyLogin()).toBe(false);
    await expect(transport.loginWithPasskey()).rejects.toThrow(
      "Browser-session transport does not support transport-managed passkey sign-in"
    );
  });

  it("surfaces an MFA challenge from the browser-session transport", async () => {
    const mfaChallenge = {
      id: "550e8400-e29b-41d4-a716-446655440099",
      purpose: "login",
      login_context: "session",
      primary_method: "totp",
      available_methods: ["totp", "recovery_code"],
      expires_at: "2026-04-01T09:30:00Z",
    };

    mockBrowserLogin.mockResolvedValueOnce({ challenge: mfaChallenge });

    const transport = getAuthTransport();
    const result = await transport.login({
      email: "mfa@secpal.dev",
      password: "password123",
    });

    expect(result).toEqual({ status: "mfa_required", challenge: mfaChallenge });
  });

  it("accepts a browser-session login payload with a UUID string id", async () => {
    mockBrowserLogin.mockResolvedValueOnce({
      user: {
        id: "019d30f1-767e-7210-bc31-2b8c1985bb61",
        name: "Browser User",
        email: "uuid.browser@secpal.dev",
        emailVerified: false,
        roles: [],
        permissions: [],
        hasOrganizationalScopes: false,
        hasCustomerAccess: false,
        hasSiteAccess: false,
      },
    });

    const transport = getAuthTransport();
    const result = await transport.login({
      email: "uuid.browser@secpal.dev",
      password: "password123",
    });

    expect(result).toEqual({
      status: "authenticated",
      user: {
        id: "019d30f1-767e-7210-bc31-2b8c1985bb61",
        name: "Browser User",
        email: "uuid.browser@secpal.dev",
        emailVerified: false,
        hasOrganizationalScopes: false,
        hasCustomerAccess: false,
        hasSiteAccess: false,
      },
    });
  });

  it("prefers the canonical current-user payload after a native login", async () => {
    const nativeBridge: NativeAuthBridge = {
      login: vi.fn().mockResolvedValue({
        user: {
          id: 7,
          name: "Customer User",
          email: "customer@secpal.dev",
          hasCustomerAccess: true,
          token: "native-secret",
          refreshToken: "native-refresh-secret",
        },
      }),
      logout: vi.fn().mockResolvedValue(undefined),
      logoutAll: vi.fn().mockResolvedValue(undefined),
      getCurrentUser: vi.fn().mockResolvedValue({
        id: 7,
        name: "Native Manager",
        email: "manager@secpal.dev",
        emailVerified: true,
        permissions: ["employees.read", "activity_log.read"],
        hasOrganizationalScopes: true,
        hasCustomerAccess: true,
        hasSiteAccess: true,
        token: "native-secret",
      }),
      isNetworkAvailable: vi.fn().mockResolvedValue(true),
    };

    const transport = resolveAuthTransport({ nativeBridge });
    const loginResult = await transport.login({
      email: "native@secpal.dev",
      password: "password123",
    });
    const currentUser = await transport.getCurrentUser();

    expect(transport.kind).toBe("native-bridge");
    expect(nativeBridge.login).toHaveBeenCalledWith({
      email: "native@secpal.dev",
      password: "password123",
    });
    expect(nativeBridge.getCurrentUser).toHaveBeenCalledTimes(2);
    expect(mockBrowserLogin).not.toHaveBeenCalled();
    expect(loginResult).toEqual({
      status: "authenticated",
      user: {
        id: "7",
        name: "Native Manager",
        email: "manager@secpal.dev",
        emailVerified: true,
        permissions: ["employees.read", "activity_log.read"],
        hasOrganizationalScopes: true,
        hasCustomerAccess: true,
        hasSiteAccess: true,
      },
    });
    expect(loginResult.status).toBe("authenticated");
    if (loginResult.status === "authenticated") {
      expect(loginResult.user).not.toHaveProperty("token");
    }
    expect(currentUser).toEqual({
      id: "7",
      name: "Native Manager",
      email: "manager@secpal.dev",
      emailVerified: true,
      permissions: ["employees.read", "activity_log.read"],
      hasOrganizationalScopes: true,
      hasCustomerAccess: true,
      hasSiteAccess: true,
    });
    expect(currentUser).not.toHaveProperty("token");
    await expect(transport.isNetworkAvailable()).resolves.toBe(true);
    expect(nativeBridge.isNetworkAvailable).toHaveBeenCalledOnce();
  });

  it("falls back to the native login payload when the canonical current-user fetch fails", async () => {
    const nativeBridge: NativeAuthBridge = {
      login: vi.fn().mockResolvedValue({
        user: {
          id: 7,
          name: "Native User",
          email: "native@secpal.dev",
          permissions: ["profile.read"],
          token: "native-secret",
        },
      }),
      logout: vi.fn().mockResolvedValue(undefined),
      logoutAll: vi.fn().mockResolvedValue(undefined),
      getCurrentUser: vi
        .fn()
        .mockRejectedValue(new AuthApiError("Unauthorized")),
      isNetworkAvailable: vi.fn().mockResolvedValue(true),
    };

    const transport = resolveAuthTransport({ nativeBridge });
    const result = await transport.login({
      email: "native@secpal.dev",
      password: "password123",
    });

    expect(nativeBridge.getCurrentUser).toHaveBeenCalledOnce();
    expect(result).toEqual({
      status: "authenticated",
      user: {
        id: "7",
        name: "Native User",
        email: "native@secpal.dev",
        emailVerified: false,
        permissions: ["profile.read"],
      },
    });
  });

  it("passes browser-session MFA challenges through without sanitizing them as users", async () => {
    mockBrowserLogin.mockResolvedValueOnce({
      challenge: {
        id: "550e8400-e29b-41d4-a716-446655440099",
        purpose: "login",
        login_context: "session",
        primary_method: "totp",
        available_methods: ["totp", "recovery_code"],
        expires_at: "2026-04-01T09:30:00Z",
      },
    });

    const transport = getAuthTransport();
    const result = await transport.login({
      email: "mfa@secpal.dev",
      password: "password123",
    });

    expect(result).toEqual({
      status: "mfa_required",
      challenge: {
        id: "550e8400-e29b-41d4-a716-446655440099",
        purpose: "login",
        login_context: "session",
        primary_method: "totp",
        available_methods: ["totp", "recovery_code"],
        expires_at: "2026-04-01T09:30:00Z",
      },
    });
  });

  it("rejects invalid native payloads before they can become auth state", async () => {
    const nativeBridge: NativeAuthBridge = {
      login: vi.fn().mockResolvedValue({ token: "native-secret" }),
      logout: vi.fn().mockResolvedValue(undefined),
      logoutAll: vi.fn().mockResolvedValue(undefined),
      getCurrentUser: vi.fn().mockResolvedValue({ token: "native-secret" }),
      isNetworkAvailable: vi.fn().mockResolvedValue(true),
    };

    const transport = resolveAuthTransport({ nativeBridge });

    await expect(
      transport.login({
        email: "native@secpal.dev",
        password: "password123",
      })
    ).rejects.toThrow(
      "Native auth login returned an invalid or unsafe auth user payload"
    );
  });

  it("rejects invalid native getCurrentUser payloads before they enter auth state", async () => {
    const nativeBridge: NativeAuthBridge = {
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      getCurrentUser: vi.fn().mockResolvedValue({ token: "native-secret" }),
      isNetworkAvailable: vi.fn().mockResolvedValue(true),
    };

    const transport = resolveAuthTransport({ nativeBridge });

    await expect(transport.getCurrentUser()).rejects.toThrow(
      "Native auth current-user fetch returned an invalid or unsafe auth user payload"
    );
  });

  it("delegates browser-session logout to the authApi", async () => {
    mockBrowserLogout.mockResolvedValueOnce(undefined);

    const transport = getAuthTransport();
    await transport.logout();

    expect(mockBrowserLogout).toHaveBeenCalledOnce();
  });

  it("revokes the browser push installation before browser-session logout", async () => {
    mockPeekBrowserPushInstallationId.mockReturnValueOnce("installation-1");
    mockRevokeBrowserNotificationInstallation.mockResolvedValueOnce({
      installation_id: "installation-1",
      channel: "web_push",
    });
    mockBrowserLogout.mockResolvedValueOnce(undefined);

    const transport = getAuthTransport();
    await transport.logout();

    expect(mockRevokeBrowserNotificationInstallation).toHaveBeenCalledWith(
      "installation-1"
    );
    expect(mockClearBrowserPushInstallationId).toHaveBeenCalledOnce();
    expect(mockBrowserLogout).toHaveBeenCalledOnce();

    const revokeCallOrder =
      mockRevokeBrowserNotificationInstallation.mock.invocationCallOrder[0];
    const logoutCallOrder = mockBrowserLogout.mock.invocationCallOrder[0];

    expect(revokeCallOrder).toBeDefined();
    expect(logoutCallOrder).toBeDefined();
    expect(revokeCallOrder ?? 0).toBeLessThan(logoutCallOrder ?? 0);
  });

  it("continues browser-session logout when push revocation fails", async () => {
    const revokeError = new Error("Push revoke failed");
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockPeekBrowserPushInstallationId.mockReturnValueOnce("installation-1");
    mockRevokeBrowserNotificationInstallation.mockRejectedValueOnce(
      revokeError
    );
    mockBrowserLogout.mockResolvedValueOnce(undefined);

    try {
      const transport = getAuthTransport();

      await expect(transport.logout()).resolves.toBeUndefined();
      expect(consoleWarn).toHaveBeenCalledWith(
        "Failed to revoke browser push installation during logout:",
        revokeError
      );
    } finally {
      consoleWarn.mockRestore();
    }

    expect(mockRevokeBrowserNotificationInstallation).toHaveBeenCalledWith(
      "installation-1"
    );
    expect(mockClearBrowserPushInstallationId).toHaveBeenCalledOnce();
    expect(mockBrowserLogout).toHaveBeenCalledOnce();
  });

  it("does not block browser-session logout when push revocation stalls", async () => {
    mockPeekBrowserPushInstallationId.mockReturnValueOnce("installation-1");
    mockRevokeBrowserNotificationInstallation.mockImplementationOnce(
      () => new Promise(() => {})
    );
    mockBrowserLogout.mockResolvedValueOnce(undefined);

    vi.useFakeTimers();

    try {
      let logoutResolved = false;

      const transport = getAuthTransport();
      const logoutPromise = transport.logout().then(() => {
        logoutResolved = true;
      });

      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();

      expect(mockBrowserLogout).toHaveBeenCalledOnce();
      expect(logoutResolved).toBe(true);

      await logoutPromise;
    } finally {
      vi.useRealTimers();
    }
  });

  it("delegates browser-session logoutAll to the authApi", async () => {
    mockBrowserLogoutAll.mockResolvedValueOnce(undefined);

    const transport = getAuthTransport();
    await transport.logoutAll();

    expect(mockBrowserLogoutAll).toHaveBeenCalledOnce();
  });

  it("revokes the browser push installation before browser-session logoutAll", async () => {
    mockPeekBrowserPushInstallationId.mockReturnValueOnce("installation-2");
    mockRevokeBrowserNotificationInstallation.mockResolvedValueOnce({
      installation_id: "installation-2",
      channel: "web_push",
    });
    mockBrowserLogoutAll.mockResolvedValueOnce(undefined);

    const transport = getAuthTransport();
    await transport.logoutAll();

    expect(mockRevokeBrowserNotificationInstallation).toHaveBeenCalledWith(
      "installation-2"
    );
    expect(mockClearBrowserPushInstallationId).toHaveBeenCalledOnce();
    expect(mockBrowserLogoutAll).toHaveBeenCalledOnce();

    const revokeCallOrder =
      mockRevokeBrowserNotificationInstallation.mock.invocationCallOrder[0];
    const logoutAllCallOrder = mockBrowserLogoutAll.mock.invocationCallOrder[0];

    expect(revokeCallOrder).toBeDefined();
    expect(logoutAllCallOrder).toBeDefined();
    expect(revokeCallOrder ?? 0).toBeLessThan(logoutAllCallOrder ?? 0);
  });

  it("continues browser-session logoutAll when push revocation fails", async () => {
    const revokeError = new Error("Push revoke failed");
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockPeekBrowserPushInstallationId.mockReturnValueOnce("installation-2");
    mockRevokeBrowserNotificationInstallation.mockRejectedValueOnce(
      revokeError
    );
    mockBrowserLogoutAll.mockResolvedValueOnce(undefined);

    try {
      const transport = getAuthTransport();

      await expect(transport.logoutAll()).resolves.toBeUndefined();
      expect(consoleWarn).toHaveBeenCalledWith(
        "Failed to revoke browser push installation during logout:",
        revokeError
      );
    } finally {
      consoleWarn.mockRestore();
    }

    expect(mockRevokeBrowserNotificationInstallation).toHaveBeenCalledWith(
      "installation-2"
    );
    expect(mockClearBrowserPushInstallationId).toHaveBeenCalledOnce();
    expect(mockBrowserLogoutAll).toHaveBeenCalledOnce();
  });

  it("delegates browser-session getCurrentUser to the authApi and sanitizes the payload", async () => {
    mockBrowserGetCurrentUser.mockResolvedValueOnce({
      id: 2,
      name: "Session User",
      email: "session@secpal.dev",
      emailVerified: true,
      roles: ["Viewer"],
      token: "should-not-leak",
    });

    const transport = getAuthTransport();
    const user = await transport.getCurrentUser();

    expect(mockBrowserGetCurrentUser).toHaveBeenCalledOnce();
    expect(user).toEqual({
      id: "2",
      name: "Session User",
      email: "session@secpal.dev",
      emailVerified: true,
      roles: ["Viewer"],
    });
    expect(user).not.toHaveProperty("token");
  });

  it("accepts a browser-session current-user payload with a UUID string id", async () => {
    mockBrowserGetCurrentUser.mockResolvedValueOnce({
      id: "019d30f1-767e-7210-bc31-2b8c1985bb61",
      name: "Session User",
      email: "uuid.session@secpal.dev",
      emailVerified: false,
      roles: [],
      permissions: [],
      hasOrganizationalScopes: false,
      hasCustomerAccess: false,
      hasSiteAccess: false,
    });

    const transport = getAuthTransport();
    const user = await transport.getCurrentUser();

    expect(user).toEqual({
      id: "019d30f1-767e-7210-bc31-2b8c1985bb61",
      name: "Session User",
      email: "uuid.session@secpal.dev",
      emailVerified: false,
      hasOrganizationalScopes: false,
      hasCustomerAccess: false,
      hasSiteAccess: false,
    });
  });

  it("delegates native bridge logout to the bridge", async () => {
    const nativeBridge: NativeAuthBridge = {
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      logoutAll: vi.fn().mockResolvedValue(undefined),
      getCurrentUser: vi.fn().mockResolvedValue(undefined),
      isNetworkAvailable: vi.fn().mockResolvedValue(true),
    };

    const transport = resolveAuthTransport({ nativeBridge });
    await transport.logout();

    expect(nativeBridge.logout).toHaveBeenCalledOnce();
    expect(mockBrowserLogout).not.toHaveBeenCalled();
  });

  it("delegates native bridge logoutAll to the bridge when supported", async () => {
    const nativeBridge: NativeAuthBridge = {
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      logoutAll: vi.fn().mockResolvedValue(undefined),
      getCurrentUser: vi.fn().mockResolvedValue(undefined),
      isNetworkAvailable: vi.fn().mockResolvedValue(true),
    };

    const transport = resolveAuthTransport({ nativeBridge });
    await transport.logoutAll();

    expect(nativeBridge.logoutAll).toHaveBeenCalledOnce();
    expect(mockBrowserLogoutAll).not.toHaveBeenCalled();
  });

  it("throws when native bridge logoutAll is not implemented", async () => {
    const nativeBridge: NativeAuthBridge = {
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      getCurrentUser: vi.fn().mockResolvedValue(undefined),
    };

    const transport = resolveAuthTransport({ nativeBridge });

    await expect(transport.logoutAll()).rejects.toThrow(
      "Native auth transport does not support logout-all"
    );
  });

  it("falls back to navigator.onLine when a native bridge does not expose connectivity status", async () => {
    const nativeBridge: NativeAuthBridge = {
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      getCurrentUser: vi.fn().mockResolvedValue(undefined),
    };
    const onLineSpy = vi
      .spyOn(window.navigator, "onLine", "get")
      .mockReturnValue(false);

    try {
      const transport = resolveAuthTransport({ nativeBridge });

      await expect(transport.isNetworkAvailable()).resolves.toBe(false);
    } finally {
      onLineSpy.mockRestore();
    }
  });

  it("reports passkey support when the native bridge exposes passkey login", () => {
    const nativeBridge: NativeAuthBridge = {
      login: vi.fn().mockResolvedValue(undefined),
      loginWithPasskey: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      getCurrentUser: vi.fn().mockResolvedValue(undefined),
    };

    const transport = resolveAuthTransport({ nativeBridge });

    expect(transport.supportsPasskeyLogin()).toBe(true);
  });

  it("delegates native passkey login to the native bridge without forwarding any email and sanitizes the canonical user", async () => {
    const nativeBridge: NativeAuthBridge = {
      login: vi.fn().mockResolvedValue(undefined),
      loginWithPasskey: vi.fn().mockResolvedValue({
        user: {
          id: 9,
          name: "Passkey User",
          email: "passkey@secpal.dev",
          token: "native-secret",
        },
      }),
      logout: vi.fn().mockResolvedValue(undefined),
      getCurrentUser: vi.fn().mockResolvedValue({
        id: 9,
        name: "Canonical Passkey User",
        email: "canonical@secpal.dev",
        emailVerified: true,
        roles: ["Employee"],
        permissions: ["profile.read"],
        hasOrganizationalScopes: false,
        hasCustomerAccess: false,
        hasSiteAccess: false,
      }),
    };

    const transport = resolveAuthTransport({ nativeBridge });
    const result = await transport.loginWithPasskey();

    expect(nativeBridge.loginWithPasskey).toHaveBeenCalledTimes(1);
    expect(vi.mocked(nativeBridge.loginWithPasskey!).mock.calls[0]).toEqual([]);
    expect(result).toEqual({
      status: "authenticated",
      user: {
        id: "9",
        name: "Canonical Passkey User",
        email: "canonical@secpal.dev",
        emailVerified: true,
        roles: ["Employee"],
        permissions: ["profile.read"],
        hasOrganizationalScopes: false,
        hasCustomerAccess: false,
        hasSiteAccess: false,
      },
    });
  });

  it("throws when native passkey login is unavailable on the bridge", async () => {
    const nativeBridge: NativeAuthBridge = {
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      getCurrentUser: vi.fn().mockResolvedValue(undefined),
    };

    const transport = resolveAuthTransport({ nativeBridge });

    await expect(transport.loginWithPasskey()).rejects.toThrow(
      "Native auth transport does not support passkey sign-in"
    );
  });
});
