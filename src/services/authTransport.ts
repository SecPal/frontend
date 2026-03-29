// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { User } from "../contexts/auth-context";
import {
  AuthApiError,
  getCurrentUser as getBrowserSessionCurrentUser,
  login as loginWithBrowserSession,
  logout as logoutBrowserSession,
  logoutAll as logoutAllBrowserSessions,
} from "./authApi";
import { sanitizeAuthUser } from "./authState";

export { AuthApiError } from "./authApi";

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthLoginResult {
  user: User;
}

export type AuthTransportKind = "browser-session" | "native-bridge";

export interface NativeAuthBridge {
  login(credentials: AuthCredentials): Promise<unknown>;
  logout(): Promise<void>;
  logoutAll?(): Promise<void>;
  getCurrentUser(): Promise<unknown>;
}

export interface AuthTransport {
  readonly kind: AuthTransportKind;
  login(credentials: AuthCredentials): Promise<AuthLoginResult>;
  logout(): Promise<void>;
  logoutAll(): Promise<void>;
  getCurrentUser(): Promise<User>;
}

function sanitizeAuthPayload(payload: unknown, operation: string): User {
  const candidate =
    typeof payload === "object" && payload !== null && "user" in payload
      ? (payload as Record<string, unknown>).user
      : payload;

  const sanitizedUser = sanitizeAuthUser(candidate);

  if (!sanitizedUser) {
    throw new AuthApiError(
      `${operation} returned an invalid or unsafe auth user payload`
    );
  }

  return sanitizedUser;
}

const browserSessionAuthTransport: AuthTransport = {
  kind: "browser-session",
  async login(credentials): Promise<AuthLoginResult> {
    const result = await loginWithBrowserSession(credentials);

    return {
      user: sanitizeAuthPayload(result, "Browser-session login"),
    };
  },
  async logout(): Promise<void> {
    await logoutBrowserSession();
  },
  async logoutAll(): Promise<void> {
    await logoutAllBrowserSessions();
  },
  async getCurrentUser(): Promise<User> {
    const user = await getBrowserSessionCurrentUser();

    return sanitizeAuthPayload(user, "Browser-session current-user fetch");
  },
};

function createNativeBridgeAuthTransport(
  nativeAuthBridge: NativeAuthBridge
): AuthTransport {
  return {
    kind: "native-bridge",
    async login(credentials): Promise<AuthLoginResult> {
      const result = await nativeAuthBridge.login(credentials);

      return {
        user: sanitizeAuthPayload(result, "Native auth login"),
      };
    },
    async logout(): Promise<void> {
      await nativeAuthBridge.logout();
    },
    async logoutAll(): Promise<void> {
      if (typeof nativeAuthBridge.logoutAll !== "function") {
        throw new AuthApiError(
          "Native auth transport does not support logout-all"
        );
      }

      await nativeAuthBridge.logoutAll();
    },
    async getCurrentUser(): Promise<User> {
      const user = await nativeAuthBridge.getCurrentUser();

      return sanitizeAuthPayload(user, "Native auth current-user fetch");
    },
  };
}

function isNativeAuthBridge(value: unknown): value is NativeAuthBridge {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.login === "function" &&
    typeof candidate.logout === "function" &&
    typeof candidate.getCurrentUser === "function"
  );
}

function getNativeAuthBridge(): NativeAuthBridge | null {
  const candidate = (globalThis as { SecPalNativeAuthBridge?: unknown })
    .SecPalNativeAuthBridge;

  return isNativeAuthBridge(candidate) ? candidate : null;
}

export function resolveAuthTransport(options?: {
  nativeBridge?: NativeAuthBridge | null;
}): AuthTransport {
  const nativeBridge = options?.nativeBridge ?? getNativeAuthBridge();

  return nativeBridge
    ? createNativeBridgeAuthTransport(nativeBridge)
    : browserSessionAuthTransport;
}

export function getAuthTransport(): AuthTransport {
  return resolveAuthTransport();
}
