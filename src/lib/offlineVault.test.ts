// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PersistedAuthUser } from "../services/authState";
import { db, type OrganizationalUnitCacheEntry } from "./db";
import {
  AUTH_VAULT_STORAGE_KEY,
  clearOfflineVaultSession,
  initializeOfflineVault,
  listVaultAnalyticsEvents,
  listVaultOrganizationalUnits,
  readPersistedAuthUserFromVault,
  clearOfflineVaultTables,
} from "./offlineVault";

function setCsrfTokenCookie(value: string): void {
  document.cookie = `XSRF-TOKEN=;expires=${new Date(0).toUTCString()};path=/`;
  document.cookie = `XSRF-TOKEN=${encodeURIComponent(value)};path=/`;
}

function setCapacitorNativeRuntime(
  value = { isNativePlatform: () => true }
): void {
  Object.defineProperty(globalThis, "Capacitor", {
    configurable: true,
    writable: true,
    value,
  });
}

function setNativeVaultBridge(value: unknown): void {
  Object.defineProperty(globalThis, "SecPalNativeAuthBridge", {
    configurable: true,
    writable: true,
    value,
  });
}

function resetNativeVaultRuntime(): void {
  Reflect.deleteProperty(globalThis as Record<string, unknown>, "Capacitor");
  Reflect.deleteProperty(
    globalThis as Record<string, unknown>,
    "SecPalNativeAuthBridge"
  );
}

function readStoredVaultState(): Record<string, unknown> {
  return JSON.parse(
    localStorage.getItem(AUTH_VAULT_STORAGE_KEY) as string
  ) as Record<string, unknown>;
}

function installNativeVaultBridge(overrides: Record<string, unknown> = {}) {
  setCapacitorNativeRuntime();

  const bridge = {
    isVaultDeviceBoundWrapperAvailable: vi.fn().mockResolvedValue(false),
    wrapVaultRootKey: vi.fn(),
    unwrapVaultRootKey: vi.fn(),
    ...overrides,
  };

  setNativeVaultBridge(bridge);

  return bridge;
}

describe("offlineVault", () => {
  const persistedUser: PersistedAuthUser = {
    id: "user-1",
    name: "Vault User",
    email: "vault@secpal.dev",
    emailVerified: false,
    roles: ["Admin"],
  };

  beforeEach(async () => {
    await db.delete();
    await db.open();
    localStorage.clear();
    sessionStorage.clear();
    setCsrfTokenCookie("test-csrf-token");
    clearOfflineVaultSession();
  });

  afterEach(() => {
    clearOfflineVaultSession();
    resetNativeVaultRuntime();
    vi.restoreAllMocks();
  });

  it("stores the persisted profile in the encrypted vault and keeps auth_user out of localStorage", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    installNativeVaultBridge({
      isVaultDeviceBoundWrapperAvailable: vi
        .fn()
        .mockRejectedValue(new Error("bridge unavailable")),
    });

    await initializeOfflineVault(persistedUser);

    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(readStoredVaultState().wrapper).toMatchObject({
      kind: "browser-session",
    });
    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
      persistedUser
    );

    const storedProfile = await db.vaultProfile.get("profile");

    expect(storedProfile).toEqual(
      expect.objectContaining({
        id: "profile",
        ciphertext: expect.any(String),
        iv: expect.any(String),
        authTag: expect.any(String),
      })
    );
  });

  it("migrates legacy IndexedDB PII into vault-backed stores and clears plaintext records", async () => {
    await db.analytics.add({
      type: "page_view",
      category: "navigation",
      action: "view_dashboard",
      timestamp: Date.now(),
      synced: false,
      sessionId: "session-1",
      userId: persistedUser.id,
    });

    const organizationalUnit: OrganizationalUnitCacheEntry = {
      id: "org-1",
      type: "company",
      name: "SecPal GmbH",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
      cachedAt: new Date("2026-01-03T00:00:00Z"),
      lastSynced: new Date("2026-01-03T00:00:00Z"),
      parent_id: null,
      parent: null,
    };

    await db.organizationalUnitCache.put(organizationalUnit);

    await initializeOfflineVault(persistedUser);

    expect(await db.analytics.count()).toBe(0);
    expect(await db.organizationalUnitCache.count()).toBe(0);

    await expect(listVaultAnalyticsEvents()).resolves.toEqual([
      expect.objectContaining({
        type: "page_view",
        userId: persistedUser.id,
        sessionId: "session-1",
      }),
    ]);
    await expect(listVaultOrganizationalUnits()).resolves.toEqual([
      expect.objectContaining({
        id: "org-1",
        name: "SecPal GmbH",
      }),
    ]);
  });

  it("removes invalid vault state from localStorage when JSON is malformed", async () => {
    localStorage.setItem(AUTH_VAULT_STORAGE_KEY, "not-valid-json{{{");

    await initializeOfflineVault(persistedUser);

    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
      persistedUser
    );
  });

  it("clears vault state and legacy tables when profile record is missing from vault", async () => {
    await initializeOfflineVault(persistedUser);
    expect(await db.vaultProfile.count()).toBe(1);

    await clearOfflineVaultTables();
    clearOfflineVaultSession();

    await db.analytics.add({
      type: "page_view",
      category: "navigation",
      action: "open",
      timestamp: Date.now(),
      synced: false,
      sessionId: "test-session",
    });

    const result = await readPersistedAuthUserFromVault();

    expect(result).toBeNull();
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();
    expect(await db.vaultProfile.count()).toBe(0);
    expect(await db.analytics.count()).toBe(0);
  });

  it("stores and restores the vault root key through the optional native device-bound wrapper", async () => {
    const wrapVaultRootKey = vi.fn(
      async ({ rootKeyBase64 }: { rootKeyBase64: string }) => ({
        wrappedRootKey: `wrapped:${rootKeyBase64}`,
        metadata: "android-keystore",
      })
    );
    const unwrapVaultRootKey = vi.fn(
      async ({ wrappedRootKey }: { wrappedRootKey: string }) => ({
        rootKeyBase64: wrappedRootKey.replace("wrapped:", ""),
      })
    );
    const nativeBridge = installNativeVaultBridge({
      isVaultDeviceBoundWrapperAvailable: vi
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true),
      wrapVaultRootKey,
      unwrapVaultRootKey,
    });

    await initializeOfflineVault(persistedUser);

    await initializeOfflineVault(persistedUser);

    const { subjectHash, wrapper } = readStoredVaultState() as {
      subjectHash: string;
      wrapper: Record<string, unknown>;
    };

    expect(wrapper).toMatchObject({
      kind: "native-device-bound",
      metadata: "android-keystore",
    });

    clearOfflineVaultSession();

    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
      persistedUser
    );
    expect(nativeBridge.unwrapVaultRootKey).toHaveBeenCalledWith(
      expect.objectContaining({
        wrappedRootKey: expect.stringMatching(/^wrapped:/),
        metadata: "android-keystore",
        subjectHash,
      })
    );
  });
});
