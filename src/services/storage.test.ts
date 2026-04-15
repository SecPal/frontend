// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it } from "vitest";
import { authStorage } from "./storage";

function setCsrfTokenCookie(value: string): void {
  document.cookie = `XSRF-TOKEN=;expires=${new Date(0).toUTCString()};path=/`;
  document.cookie = `XSRF-TOKEN=${encodeURIComponent(value)};path=/`;
}

describe("authStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    setCsrfTokenCookie("test-csrf-token");
  });

  it("encrypts persisted auth state before writing to localStorage", () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
      employeeStatus: "pre_contract" as const,
      onboardingWorkflowStatus: "submitted_for_review" as const,
    };

    authStorage.setUser(user);

    const storedUser = localStorage.getItem("auth_user");

    expect(storedUser).not.toBeNull();
    const parsedStoredUser = JSON.parse(storedUser as string) as Record<string, unknown>;

    expect(parsedStoredUser).toEqual(
      expect.objectContaining({
        scheme: expect.any(String),
        version: expect.anything(),
        salt: expect.any(String),
        iv: expect.any(String),
        ciphertext: expect.any(String),
        mac: expect.any(String),
      }),
    );
    expect(parsedStoredUser.salt).not.toBe("");
    expect(parsedStoredUser.iv).not.toBe("");
    expect(parsedStoredUser.ciphertext).not.toBe("");
    expect(parsedStoredUser.mac).not.toBe("");
    expect(authStorage.getUser()).toEqual(user);
  });

  it("clears encrypted auth state when the session-derived key material changes", () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    authStorage.setUser(user);
    setCsrfTokenCookie("rotated-csrf-token");

    expect(authStorage.getUser()).toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("keeps reading legacy cleartext persisted auth state for compatibility", () => {
    const legacyUser = {
      id: "1",
      name: "Legacy User",
      email: "legacy@secpal.dev",
      emailVerified: false,
    };

    localStorage.setItem("auth_user", JSON.stringify(legacyUser));

    expect(authStorage.getUser()).toEqual(legacyUser);
  });
});
