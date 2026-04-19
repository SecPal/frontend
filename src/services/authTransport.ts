// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { LoginMfaChallengeResponse, MfaChallenge } from "@/types/api";
import type { User } from "../contexts/auth-context";
import {
  AuthApiError,
  getCurrentUser as getBrowserSessionCurrentUser,
  login as loginWithBrowserSession,
  logout as logoutBrowserSession,
  logoutAll as logoutAllBrowserSessions,
} from "./authApi";
import { sanitizeAuthUser } from "./authState";
import { isOnline } from "./sessionEvents";

export { AuthApiError } from "./authApi";

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface PasskeyLoginOptions {
  email?: string;
}

export interface AuthenticatedLoginResult {
  status: "authenticated";
  user: User;
}

export interface MfaRequiredLoginResult {
  status: "mfa_required";
  challenge: MfaChallenge;
}

export type AuthLoginResult = AuthenticatedLoginResult | MfaRequiredLoginResult;

export type AuthTransportKind = "browser-session" | "native-bridge";

export interface NativeAuthBridge {
  login(credentials: AuthCredentials): Promise<unknown>;
  loginWithPasskey?(options?: PasskeyLoginOptions): Promise<unknown>;
  logout(): Promise<void>;
  logoutAll?(): Promise<void>;
  getCurrentUser(): Promise<unknown>;
  isNetworkAvailable?(): Promise<boolean>;
}

export interface AuthTransport {
  readonly kind: AuthTransportKind;
  login(credentials: AuthCredentials): Promise<AuthLoginResult>;
  supportsPasskeyLogin(): boolean;
  loginWithPasskey(
    options?: PasskeyLoginOptions
  ): Promise<AuthenticatedLoginResult>;
  logout(): Promise<void>;
  logoutAll(): Promise<void>;
  getCurrentUser(): Promise<User>;
  isNetworkAvailable(): Promise<boolean>;
}

async function finalizeAuthenticatedLogin(
  payload: unknown,
  loginOperation: string,
  getCurrentUserImpl: () => Promise<unknown>,
  currentUserOperation: string
): Promise<AuthenticatedLoginResult> {
  const loginUser = sanitizeAuthPayload(payload, loginOperation);

  try {
    const currentUser = await getCurrentUserImpl();

    return {
      status: "authenticated",
      user: sanitizeAuthPayload(currentUser, currentUserOperation),
    };
  } catch (err) {
    if (err instanceof Error) {
      return {
        status: "authenticated",
        user: loginUser,
      };
    }

    throw err;
  }
}

function isMfaChallengeResponse(
  payload: unknown
): payload is LoginMfaChallengeResponse {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "challenge" in payload &&
    typeof (payload as { challenge?: unknown }).challenge === "object" &&
    (payload as { challenge?: unknown }).challenge !== null
  );
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

    if (isMfaChallengeResponse(result)) {
      return {
        status: "mfa_required",
        challenge: result.challenge,
      };
    }

    return finalizeAuthenticatedLogin(
      result,
      "Browser-session login",
      () => getBrowserSessionCurrentUser(),
      "Browser-session current-user fetch"
    );
  },
  supportsPasskeyLogin(): boolean {
    return false;
  },
  async loginWithPasskey(): Promise<AuthenticatedLoginResult> {
    throw new AuthApiError(
      "Browser-session transport does not support transport-managed passkey sign-in"
    );
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
  async isNetworkAvailable(): Promise<boolean> {
    return isOnline();
  },
};

function createNativeBridgeAuthTransport(
  nativeAuthBridge: NativeAuthBridge
): AuthTransport {
  return {
    kind: "native-bridge",
    async login(credentials): Promise<AuthLoginResult> {
      const result = await nativeAuthBridge.login(credentials);

      return finalizeAuthenticatedLogin(
        result,
        "Native auth login",
        () => nativeAuthBridge.getCurrentUser(),
        "Native auth current-user fetch"
      );
    },
    supportsPasskeyLogin(): boolean {
      return typeof nativeAuthBridge.loginWithPasskey === "function";
    },
    async loginWithPasskey(
      options?: PasskeyLoginOptions
    ): Promise<AuthenticatedLoginResult> {
      if (typeof nativeAuthBridge.loginWithPasskey !== "function") {
        throw new AuthApiError(
          "Native auth transport does not support passkey sign-in"
        );
      }

      const result = await nativeAuthBridge.loginWithPasskey(options);

      return finalizeAuthenticatedLogin(
        result,
        "Native passkey login",
        () => nativeAuthBridge.getCurrentUser(),
        "Native auth current-user fetch"
      );
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
    async isNetworkAvailable(): Promise<boolean> {
      if (typeof nativeAuthBridge.isNetworkAvailable !== "function") {
        return isOnline();
      }

      try {
        return (await nativeAuthBridge.isNetworkAvailable()) === true;
      } catch {
        return isOnline();
      }
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
  const nativeBridge =
    options?.nativeBridge !== undefined
      ? options.nativeBridge
      : getNativeAuthBridge();

  return nativeBridge
    ? createNativeBridgeAuthTransport(nativeBridge)
    : browserSessionAuthTransport;
}

export function getAuthTransport(): AuthTransport {
  return resolveAuthTransport();
}
