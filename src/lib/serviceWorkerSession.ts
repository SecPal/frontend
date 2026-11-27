// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { authLifecycle } from "./authLifecycle";
import {
  writeOfflineSessionState,
  type AuthSessionChangedMessage,
} from "./offlineSessionState";

export interface SyncOfflineSessionAccessOptions {
  redirectOpenClients?: boolean;
}

async function postAuthSessionChangedMessage(
  message: AuthSessionChangedMessage,
  isCurrent: () => boolean
): Promise<void> {
  if (
    typeof navigator === "undefined" ||
    navigator.serviceWorker === undefined
  ) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if (!isCurrent()) {
      return;
    }
    const target =
      navigator.serviceWorker.controller ??
      registration.active ??
      registration.waiting ??
      registration.installing;

    target?.postMessage(message);
  } catch (error) {
    console.warn("[SW] Failed to sync auth session state:", error);
  }
}

export async function syncOfflineSessionAccess(
  isAuthenticated: boolean,
  options: SyncOfflineSessionAccessOptions = {}
): Promise<void> {
  const owner = authLifecycle.current();
  const ownsAuth = authLifecycle.observeAuthenticatedGeneration();
  const barrier = authLifecycle.barrier();
  const isCurrent = () =>
    isAuthenticated
      ? ownsAuth()
      : barrier === null
        ? authLifecycle.owns(owner) && authLifecycle.barrier() === null
        : authLifecycle.barrier() === barrier;

  if (!isCurrent()) {
    return;
  }
  await writeOfflineSessionState(isAuthenticated, isCurrent);

  if (isCurrent()) {
    await postAuthSessionChangedMessage(
      {
        type: "AUTH_SESSION_CHANGED",
        isAuthenticated,
        redirectOpenClients: options.redirectOpenClients ?? false,
      },
      isCurrent
    );
  }
}
