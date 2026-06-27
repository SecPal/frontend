// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { LoginMfaChallengeResponse, MfaChallenge } from "@/types/api";
import type { User } from "../contexts/auth-context";
import {
  clearBrowserPushInstallationId,
  peekBrowserPushInstallationId,
  setBrowserPushLogoutInProgress,
} from "../lib/browserPushState";
import { isTransientModuleLoadError } from "../lib/lazyModuleErrors";
import { AuthApiError } from "./AuthApiError";
import { sanitizeAuthUser } from "./authState";
import { NATIVE_AUTH_LOGOUT_EVENT_NAME } from "./nativeAuthEvents";
import { isOnline } from "./sessionEvents";

export { AuthApiError } from "./AuthApiError";

const NATIVE_AUTH_BRIDGE_DISPATCHES_LOGOUT_EVENT = Symbol(
  "nativeAuthBridgeDispatchesLogoutEvent"
);

async function loadAuthApiModule() {
  return await import("./authApi");
}

async function loadNotificationInstallationsModule() {
  return await import("./notificationInstallationsApi");
}

function dispatchNativeAuthLogoutEvent(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(NATIVE_AUTH_LOGOUT_EVENT_NAME));
}

export interface AuthCredentials {
  email: string;
  password: string;
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
  loginWithPasskey?(): Promise<unknown>;
  logout(): Promise<void>;
  logoutAll?(): Promise<void>;
  getCurrentUser(): Promise<unknown>;
  isNetworkAvailable?(): Promise<boolean>;
}

export interface AuthTransport {
  readonly kind: AuthTransportKind;
  login(credentials: AuthCredentials): Promise<AuthLoginResult>;
  supportsPasskeyLogin(): boolean;
  loginWithPasskey(): Promise<AuthenticatedLoginResult>;
  logout(): Promise<void>;
  logoutAll(): Promise<void>;
  getCurrentUser(): Promise<User>;
  isNetworkAvailable(): Promise<boolean>;
}

const BROWSER_PUSH_LOGOUT_REVOCATION_TIMEOUT_MS = 1000;
const TEMPORARY_LOGIN_UNAVAILABLE_MESSAGE =
  "Login is temporarily unavailable. Please try again later.";

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

async function waitForPushRevocationToSettle(
  pushRevocation: Promise<void>
): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    await Promise.race([
      pushRevocation,
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(
          resolve,
          BROWSER_PUSH_LOGOUT_REVOCATION_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

function revokeBrowserPushInstallationForLogout(): Promise<void> | null {
  const installationId = peekBrowserPushInstallationId();

  if (!installationId) {
    return null;
  }

  return loadNotificationInstallationsModule()
    .then(({ revokeBrowserNotificationInstallation }) =>
      revokeBrowserNotificationInstallation(installationId)
    )
    .then(
      () => undefined,
      (error: unknown) => {
        console.warn(
          "Failed to revoke browser push installation during logout:",
          error
        );
      }
    )
    .finally(() => {
      if (peekBrowserPushInstallationId() === installationId) {
        clearBrowserPushInstallationId();
      }
    });
}

const browserSessionAuthTransport: AuthTransport = {
  kind: "browser-session",
  async login(credentials): Promise<AuthLoginResult> {
    let loginWithBrowserSession: typeof import("./authApi").login;
    let getCurrentUser: typeof import("./authApi").getCurrentUser;

    try {
      ({ login: loginWithBrowserSession, getCurrentUser } =
        await loadAuthApiModule());
    } catch (error) {
      if (isTransientModuleLoadError(error)) {
        throw new AuthApiError(
          TEMPORARY_LOGIN_UNAVAILABLE_MESSAGE,
          undefined,
          503,
          "AUTH_CHUNK_LOAD_FAILED"
        );
      }

      throw error;
    }

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
      () => getCurrentUser(),
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
    setBrowserPushLogoutInProgress(true);
    const pushRevocation = revokeBrowserPushInstallationForLogout();

    try {
      if (pushRevocation) {
        await waitForPushRevocationToSettle(pushRevocation);
      }
    } finally {
      try {
        const { logout: logoutBrowserSession } = await loadAuthApiModule();
        await logoutBrowserSession();
      } finally {
        setBrowserPushLogoutInProgress(false);
      }
    }
  },
  async logoutAll(): Promise<void> {
    setBrowserPushLogoutInProgress(true);
    const pushRevocation = revokeBrowserPushInstallationForLogout();

    try {
      if (pushRevocation) {
        await waitForPushRevocationToSettle(pushRevocation);
      }
    } finally {
      try {
        const { logoutAll: logoutAllBrowserSessions } =
          await loadAuthApiModule();
        await logoutAllBrowserSessions();
      } finally {
        setBrowserPushLogoutInProgress(false);
      }
    }
  },
  async getCurrentUser(): Promise<User> {
    const { getCurrentUser } = await loadAuthApiModule();
    const user = await getCurrentUser();

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
    async loginWithPasskey(): Promise<AuthenticatedLoginResult> {
      if (typeof nativeAuthBridge.loginWithPasskey !== "function") {
        throw new AuthApiError(
          "Native auth transport does not support passkey sign-in"
        );
      }

      const result = await nativeAuthBridge.loginWithPasskey();

      return finalizeAuthenticatedLogin(
        result,
        "Native passkey login",
        () => nativeAuthBridge.getCurrentUser(),
        "Native auth current-user fetch"
      );
    },
    async logout(): Promise<void> {
      await nativeAuthBridge.logout();
      if (!bridgeDispatchesLogoutEvent(nativeAuthBridge)) {
        dispatchNativeAuthLogoutEvent();
      }
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

function bridgeDispatchesLogoutEvent(bridge: NativeAuthBridge): boolean {
  return (
    (
      bridge as NativeAuthBridge & {
        [NATIVE_AUTH_BRIDGE_DISPATCHES_LOGOUT_EVENT]?: boolean;
      }
    )[NATIVE_AUTH_BRIDGE_DISPATCHES_LOGOUT_EVENT] === true
  );
}

function wrapNativeAuthBridge(
  nativeAuthBridge: NativeAuthBridge
): NativeAuthBridge {
  if (bridgeDispatchesLogoutEvent(nativeAuthBridge)) {
    return nativeAuthBridge;
  }

  const wrappedBridge: NativeAuthBridge & {
    [NATIVE_AUTH_BRIDGE_DISPATCHES_LOGOUT_EVENT]: true;
  } = {
    login(credentials) {
      return nativeAuthBridge.login.call(nativeAuthBridge, credentials);
    },
    async logout() {
      await nativeAuthBridge.logout.call(nativeAuthBridge);
      dispatchNativeAuthLogoutEvent();
    },
    getCurrentUser() {
      return nativeAuthBridge.getCurrentUser.call(nativeAuthBridge);
    },
    [NATIVE_AUTH_BRIDGE_DISPATCHES_LOGOUT_EVENT]: true,
  };

  if (typeof nativeAuthBridge.loginWithPasskey === "function") {
    wrappedBridge.loginWithPasskey = () =>
      nativeAuthBridge.loginWithPasskey!.call(nativeAuthBridge);
  }

  if (typeof nativeAuthBridge.logoutAll === "function") {
    wrappedBridge.logoutAll = () =>
      nativeAuthBridge.logoutAll!.call(nativeAuthBridge);
  }

  if (typeof nativeAuthBridge.isNetworkAvailable === "function") {
    wrappedBridge.isNetworkAvailable = () =>
      nativeAuthBridge.isNetworkAvailable!.call(nativeAuthBridge);
  }

  return wrappedBridge;
}

function getNativeAuthBridge(): NativeAuthBridge | null {
  const bridgeGlobal = globalThis as {
    SecPalNativeAuthBridge?: unknown;
  };
  const candidate = bridgeGlobal.SecPalNativeAuthBridge;

  if (!isNativeAuthBridge(candidate)) {
    return null;
  }

  const wrappedBridge = wrapNativeAuthBridge(candidate);
  bridgeGlobal.SecPalNativeAuthBridge = wrappedBridge;

  return wrappedBridge;
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
