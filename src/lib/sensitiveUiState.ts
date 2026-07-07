// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

export type SensitiveUiState = "clear" | "privacy-shield" | "vault-locked";

interface SensitiveUiStateInput {
  isPrivacyShieldVisible?: boolean;
  isVaultLocked?: boolean;
}

export function getSensitiveUiState({
  isPrivacyShieldVisible = false,
  isVaultLocked = false,
}: SensitiveUiStateInput): SensitiveUiState {
  if (isVaultLocked) {
    return "vault-locked";
  }

  if (isPrivacyShieldVisible) {
    return "privacy-shield";
  }

  return "clear";
}

export function isPrivacyShieldState(
  state: SensitiveUiState
): state is "privacy-shield" {
  return state === "privacy-shield";
}

export function isVaultLockedState(
  state: SensitiveUiState
): state is "vault-locked" {
  return state === "vault-locked";
}
