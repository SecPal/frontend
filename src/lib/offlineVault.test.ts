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

function setCapacitorNativeRuntime(value = { isNativePlatform: () => true }): void {
  Object.defineProperty(globalThis, "Capacitor", {
    configurable: true,
    writable: true,
    value,
  });
}

function clearCapacitorNativeRuntime(): void {
  Reflect.deleteProperty(globalThis as Record<string, unknown>, "Capacitor");
}

function setNativeVaultBridge(value: unknown): void {
  Object.defineProperty(globalThis, "SecPalNativeAuthBridge", {
    configurable: true,
    writable: true,
    value,
  });
}

function clearNativeVaultBridge(): void {
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

function installNativeVaultBridge(
  overrides: Partial<{
    isVaultDeviceBoundWrapperAvailable: ReturnType<typeof vi.fn>;
    wrapVaultRootKey: ReturnType<typeof vi.fn>;
    unwrapVaultRootKey: ReturnType<typeof vi.fn>;
  }>
) {
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
    clearCapacitorNativeRuntime();
    clearNativeVaultBridge();
    vi.restoreAllMocks();
  });

  it("stores the persisted profile in the encrypted vault and keeps auth_user out of localStorage", async () => {
    await initializeOfflineVault(persistedUser);

    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
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

    // initializeOfflineVault will trigger getStoredVaultState
    await initializeOfflineVault(persistedUser);

    // Vault should now be initialized fresh (old invalid key replaced)
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
      persistedUser
    );
  });

  it("clears vault state and legacy tables when profile record is missing from vault", async () => {
    await initializeOfflineVault(persistedUser);
    expect(await db.vaultProfile.count()).toBe(1);

    // Simulate a corrupted vault: clear only the profile table, leave vault state
    await clearOfflineVaultTables();
    clearOfflineVaultSession();

    // Add legacy data to verify it gets cleared too
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

  it("falls back to the browser wrapper when a native-capable runtime has no device-bound vault wrapper", async () => {
    const nativeBridge = installNativeVaultBridge({});

    await initializeOfflineVault(persistedUser);

    const storedState = readStoredVaultState();

    expect(storedState.version).toBe(2);
    expect(storedState.wrapper).toMatchObject({ kind: "browser-session" });
    expect(
      nativeBridge.isVaultDeviceBoundWrapperAvailable
    ).toHaveBeenCalledTimes(1);
    expect(nativeBridge.wrapVaultRootKey).not.toHaveBeenCalled();
    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
      persistedUser
    );
  });

  it("stores and restores the vault root key through the optional native device-bound wrapper", async () => {
    const wrapVaultRootKey = vi.fn().mockImplementation(async ({
      rootKeyBase64,
    }: {
      rootKeyBase64: string;
    }) => ({
      wrappedRootKey: `wrapped:${rootKeyBase64}`,
      metadata: "android-keystore",
    }));
    const unwrapVaultRootKey = vi.fn().mockImplementation(async ({
      wrappedRootKey,
    }: {
      wrappedRootKey: string;
    }) => ({
      rootKeyBase64: wrappedRootKey.replace("wrapped:", ""),
    }));
    const nativeBridge = installNativeVaultBridge({
      isVaultDeviceBoundWrapperAvailable: vi.fn().mockResolvedValue(true),
      wrapVaultRootKey,
      unwrapVaultRootKey,
    });

    await initializeOfflineVault(persistedUser);

    const storedState = readStoredVaultState();

    expect(storedState.wrapper).toMatchObject({
      kind: "native-device-bound",
      metadata: "android-keystore",
    });
    expect(wrapVaultRootKey).toHaveBeenCalledWith(
      expect.objectContaining({
        rootKeyBase64: expect.any(String),
        subjectHash: storedState.subjectHash,
      })
    );

    clearOfflineVaultSession();

    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
      persistedUser
    );
    expect(nativeBridge.unwrapVaultRootKey).toHaveBeenCalledWith(
      expect.objectContaining({
        wrappedRootKey: expect.stringMatching(/^wrapped:/),
        metadata: "android-keystore",
        subjectHash: storedState.subjectHash,
      })
    );
  });
});
