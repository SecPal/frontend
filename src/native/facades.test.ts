// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it } from "vitest";

import * as nativeFacades from "./index";

describe("native facade surface", () => {
  it("exposes explicit domain facades instead of a generic native command bridge", () => {
    expect(nativeFacades).toHaveProperty("SecPalDeviceState");
    expect(nativeFacades).toHaveProperty("SecPalEnterprise");
    expect(nativeFacades).toHaveProperty("SecPalPush");
    expect(nativeFacades).not.toHaveProperty("executeNativeCommand");
  });

  it("keeps the prepared facades as inert stubs", async () => {
    await expect(nativeFacades.SecPalDeviceState.getSnapshot()).resolves.toBe(
      null
    );
    await expect(
      nativeFacades.SecPalEnterprise.getEnrollment()
    ).resolves.toBe(null);
    await expect(nativeFacades.SecPalPush.getRegistration()).resolves.toBe(
      null
    );
  });
});
