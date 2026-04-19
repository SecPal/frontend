// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearStoredAuthUserCache,
  getEncryptedStoredAuthUser,
} from "../utils/passkeyAuthStorage";

const authUser = {
  id: "1",
  name: "Test User",
  email: "test@example.com",
  emailVerified: true,
  roles: [],
  permissions: [],
  hasOrganizationalScopes: false,
  hasCustomerAccess: false,
  hasSiteAccess: false,
};

describe("passkeyAuthStorage", () => {
  afterEach(() => {
    clearStoredAuthUserCache();
    vi.restoreAllMocks();
  });

  it("reuses the derived auth envelope across repeated helper calls", async () => {
    const deriveBitsSpy = vi.spyOn(crypto.subtle, "deriveBits");

    const firstEnvelope = await getEncryptedStoredAuthUser(
      authUser,
      "playwright-test-csrf-token"
    );
    const secondEnvelope = await getEncryptedStoredAuthUser(
      authUser,
      "playwright-test-csrf-token"
    );

    expect(secondEnvelope).toBe(firstEnvelope);
    expect(deriveBitsSpy).toHaveBeenCalledTimes(1);
  });
});
