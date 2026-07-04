// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

interface OfflineVaultSessionRuntime {
  rootKeyBytes: Uint8Array;
}

let activeOfflineVaultSession: OfflineVaultSessionRuntime | null = null;
let vaultOrgUnitIndexEnsured = false;

export function getActiveOfflineVaultSession<
  T extends OfflineVaultSessionRuntime,
>(): T | null {
  return activeOfflineVaultSession as T | null;
}

export function setActiveOfflineVaultSession<
  T extends OfflineVaultSessionRuntime,
>(session: T | null): void {
  activeOfflineVaultSession = session;
}

export function clearActiveOfflineVaultSession(): void {
  if (activeOfflineVaultSession) {
    activeOfflineVaultSession.rootKeyBytes.fill(0);
  }

  activeOfflineVaultSession = null;
  vaultOrgUnitIndexEnsured = false;
}

export function isVaultOrgUnitIndexEnsured(): boolean {
  return vaultOrgUnitIndexEnsured;
}

export function markVaultOrgUnitIndexEnsured(): void {
  vaultOrgUnitIndexEnsured = true;
}
