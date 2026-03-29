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
  const authTransportGlobal = globalThis as {
    SecPalNativeAuthBridge?: NativeAuthBridge;
  };
  const originalNativeBridge = authTransportGlobal.SecPalNativeAuthBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    delete authTransportGlobal.SecPalNativeAuthBridge;
  });

  afterEach(() => {
    if (originalNativeBridge) {
      authTransportGlobal.SecPalNativeAuthBridge = originalNativeBridge;
      return;
    }

    delete authTransportGlobal.SecPalNativeAuthBridge;
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
        id: 1,
        name: "Browser User",
        email: "browser@secpal.app",
        roles: ["Admin"],
      },
    });
    expect(result.user).not.toHaveProperty("token");
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
        id: 7,
        name: "Native User",
        email: "native@secpal.app",
        permissions: ["profile.read"],
      },
    });
    expect(loginResult.user).not.toHaveProperty("token");
    expect(currentUser).toEqual({
      id: 7,
      name: "Native User",
      email: "native@secpal.app",
      permissions: ["profile.read"],
    });
    expect(currentUser).not.toHaveProperty("token");
  });

  it("rejects invalid native payloads before they can become auth state", async () => {
    const nativeBridge: NativeAuthBridge = {
      login: vi.fn().mockResolvedValue({ token: "native-secret" }),
      logout: vi.fn().mockResolvedValue(undefined),
      logoutAll: vi.fn().mockResolvedValue(undefined),
      getCurrentUser: vi.fn().mockResolvedValue({ token: "native-secret" }),
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
});
