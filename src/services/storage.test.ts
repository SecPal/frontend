// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("encrypts persisted auth state before writing to localStorage", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
      employeeStatus: "pre_contract" as const,
      onboardingWorkflowStatus: "submitted_for_review" as const,
    };

    await authStorage.setUser(user);

    const storedUser = localStorage.getItem("auth_user");

    expect(storedUser).not.toBeNull();
    const parsedStoredUser = JSON.parse(storedUser as string) as Record<
      string,
      unknown
    >;

    expect(parsedStoredUser).toEqual(
      expect.objectContaining({
        scheme: expect.any(String),
        version: expect.anything(),
        salt: expect.any(String),
        iv: expect.any(String),
        ciphertext: expect.any(String),
        mac: expect.any(String),
      })
    );
    expect(parsedStoredUser.salt).not.toBe("");
    expect(parsedStoredUser.iv).not.toBe("");
    expect(parsedStoredUser.ciphertext).not.toBe("");
    expect(parsedStoredUser.mac).not.toBe("");
    await expect(authStorage.getUser()).resolves.toEqual(user);
  });

  it("clears encrypted auth state when the session-derived key material changes", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(user);
    setCsrfTokenCookie("rotated-csrf-token");

    await expect(authStorage.getUser()).resolves.toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("clears invalid JSON snapshots and logs the parse failure", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    localStorage.setItem("auth_user", "invalid-json");

    expect(authStorage.getUserSnapshot()).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to parse stored user snapshot:",
      expect.any(SyntaxError)
    );
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("clears invalid JSON persisted auth state while decrypting", async () => {
    localStorage.setItem("auth_user", "invalid-json");

    await expect(authStorage.getUser()).resolves.toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("clears encrypted auth state when the decrypted payload is not valid JSON", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await authStorage.setUser(user);

    vi.spyOn(globalThis.crypto.subtle, "decrypt").mockResolvedValue(
      new TextEncoder().encode("not-json").buffer
    );

    await expect(authStorage.getUser()).resolves.toBeNull();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to parse stored user data:",
      expect.any(SyntaxError)
    );
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("clears persisted auth state when WebCrypto rejects during setUser", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const cryptoFailure = new DOMException(
      "The operation failed.",
      "OperationError"
    );
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    localStorage.setItem(
      "auth_user",
      JSON.stringify({ stale: true, email: "stale@secpal.dev" })
    );

    vi.spyOn(globalThis.crypto.subtle, "deriveBits").mockRejectedValue(
      cryptoFailure
    );

    await expect(authStorage.setUser(user)).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to persist stored user data:",
      cryptoFailure
    );
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("keeps reading legacy cleartext persisted auth state for compatibility", async () => {
    const legacyUser = {
      id: "1",
      name: "Legacy User",
      email: "legacy@secpal.dev",
      emailVerified: false,
    };

    localStorage.setItem("auth_user", JSON.stringify(legacyUser));

    await expect(authStorage.getUser()).resolves.toEqual(legacyUser);
  });
});
