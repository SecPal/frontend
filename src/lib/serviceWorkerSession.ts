// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { writeOfflineSessionState } from "./offlineSessionState";

interface AuthSessionChangedMessage {
  type: "AUTH_SESSION_CHANGED";
  isAuthenticated: boolean;
}

async function postAuthSessionChangedMessage(
  message: AuthSessionChangedMessage
): Promise<void> {
  if (
    typeof navigator === "undefined" ||
    navigator.serviceWorker === undefined
  ) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
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
  isAuthenticated: boolean
): Promise<void> {
  await writeOfflineSessionState(isAuthenticated);

  await postAuthSessionChangedMessage({
    type: "AUTH_SESSION_CHANGED",
    isAuthenticated,
  });
}
