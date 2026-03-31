// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NativeAuthBridge } from "./authTransport";
import { getAuthTransport, resolveAuthTransport } from "./authTransport";

const {
  mockBrowserLogin,
  mockBrowserLogout,
  mockBrowserLogoutAll,
  mockBrowserGetCurrentUser,
} = vi.hoisted(() => ({
  mockBrowserLogin: vi.fn(),
  mockBrowserLogout: vi.fn(),
  mockBrowserLogoutAll: vi.fn(),
  mockBrowserGetCurrentUser: vi.fn(),
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
        email: "browser@secpal.app",
        roles: ["Admin"],
        token: "should-not-leak",
      },
    });

    const transport = getAuthTransport();
    const result = await transport.login({
      email: "browser@secpal.app",
      password: "password123",
    });

    expect(transport.kind).toBe("browser-session");
    expect(mockBrowserLogin).toHaveBeenCalledWith({
      email: "browser@secpal.app",
      password: "password123",
    });
    expect(result).toEqual({
      user: {
        id: "1",
        name: "Browser User",
        email: "browser@secpal.app",
        roles: ["Admin"],
      },
    });
    expect(result.user).not.toHaveProperty("token");
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

  it("accepts a browser-session login payload with a UUID string id", async () => {
    mockBrowserLogin.mockResolvedValueOnce({
      user: {
        id: "019d30f1-767e-7210-bc31-2b8c1985bb61",
        name: "Browser User",
        email: "uuid.browser@secpal.dev",
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
      user: {
        id: "019d30f1-767e-7210-bc31-2b8c1985bb61",
        name: "Browser User",
        email: "uuid.browser@secpal.dev",
        hasOrganizationalScopes: false,
        hasCustomerAccess: false,
        hasSiteAccess: false,
      },
    });
  });

  it("uses a native bridge transport and strips raw token fields from auth state", async () => {
    const nativeBridge: NativeAuthBridge = {
      login: vi.fn().mockResolvedValue({
        user: {
          id: 7,
          name: "Native User",
          email: "native@secpal.app",
          permissions: ["profile.read"],
          token: "native-secret",
          refreshToken: "native-refresh-secret",
        },
      }),
      logout: vi.fn().mockResolvedValue(undefined),
      logoutAll: vi.fn().mockResolvedValue(undefined),
      getCurrentUser: vi.fn().mockResolvedValue({
        id: 7,
        name: "Native User",
        email: "native@secpal.app",
        permissions: ["profile.read"],
        token: "native-secret",
      }),
      isNetworkAvailable: vi.fn().mockResolvedValue(true),
    };

    const transport = resolveAuthTransport({ nativeBridge });
    const loginResult = await transport.login({
      email: "native@secpal.app",
      password: "password123",
    });
    const currentUser = await transport.getCurrentUser();

    expect(transport.kind).toBe("native-bridge");
    expect(nativeBridge.login).toHaveBeenCalledWith({
      email: "native@secpal.app",
      password: "password123",
    });
    expect(mockBrowserLogin).not.toHaveBeenCalled();
    expect(loginResult).toEqual({
      user: {
        id: "7",
        name: "Native User",
        email: "native@secpal.app",
        permissions: ["profile.read"],
      },
    });
    expect(loginResult.user).not.toHaveProperty("token");
    expect(currentUser).toEqual({
      id: "7",
      name: "Native User",
      email: "native@secpal.app",
      permissions: ["profile.read"],
    });
    expect(currentUser).not.toHaveProperty("token");
    await expect(transport.isNetworkAvailable()).resolves.toBe(true);
    expect(nativeBridge.isNetworkAvailable).toHaveBeenCalledOnce();
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
        email: "native@secpal.app",
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

  it("delegates browser-session logoutAll to the authApi", async () => {
    mockBrowserLogoutAll.mockResolvedValueOnce(undefined);

    const transport = getAuthTransport();
    await transport.logoutAll();

    expect(mockBrowserLogoutAll).toHaveBeenCalledOnce();
  });

  it("delegates browser-session getCurrentUser to the authApi and sanitizes the payload", async () => {
    mockBrowserGetCurrentUser.mockResolvedValueOnce({
      id: 2,
      name: "Session User",
      email: "session@secpal.app",
      roles: ["Viewer"],
      token: "should-not-leak",
    });

    const transport = getAuthTransport();
    const user = await transport.getCurrentUser();

    expect(mockBrowserGetCurrentUser).toHaveBeenCalledOnce();
    expect(user).toEqual({
      id: "2",
      name: "Session User",
      email: "session@secpal.app",
      roles: ["Viewer"],
    });
    expect(user).not.toHaveProperty("token");
  });

  it("accepts a browser-session current-user payload with a UUID string id", async () => {
    mockBrowserGetCurrentUser.mockResolvedValueOnce({
      id: "019d30f1-767e-7210-bc31-2b8c1985bb61",
      name: "Session User",
      email: "uuid.session@secpal.dev",
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
});
