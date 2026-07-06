// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it } from "vitest";
import {
  getSensitiveUiState,
  isPrivacyShieldState,
  isVaultLockedState,
} from "./sensitiveUiState";

describe("sensitiveUiState", () => {
  it("separates visual privacy shielding from an offline vault lock", () => {
    expect(
      getSensitiveUiState({
        isPrivacyShieldVisible: true,
        isVaultLocked: false,
      })
    ).toBe("privacy-shield");

    expect(isPrivacyShieldState("privacy-shield")).toBe(true);
    expect(isVaultLockedState("privacy-shield")).toBe(false);
  });

  it("keeps a real vault lock distinct and higher priority than visual shielding", () => {
    expect(
      getSensitiveUiState({
        isPrivacyShieldVisible: true,
        isVaultLocked: true,
      })
    ).toBe("vault-locked");

    expect(isVaultLockedState("vault-locked")).toBe(true);
    expect(isPrivacyShieldState("vault-locked")).toBe(false);
  });
});
