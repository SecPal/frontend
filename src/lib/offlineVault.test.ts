// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

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

function clearCsrfTokenCookie(): void {
  document.cookie = `XSRF-TOKEN=;expires=${new Date(0).toUTCString()};path=/`;
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

function createDeferredPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe("offlineVault", () => {
  const persistedUser: PersistedAuthUser = {
    id: "user-1",
    name: "Vault User",
    email: "vault@secpal.dev",
    emailVerified: false,
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

  it("does not expose auth_vault_state before the encrypted profile record is persisted", async () => {
    const deferredProfileWrite = createDeferredPromise<void>();
    const originalPut = db.vaultProfile.put.bind(db.vaultProfile);

    vi.spyOn(db.vaultProfile, "put").mockImplementationOnce((...args) => {
      return deferredProfileWrite.promise.then(() =>
        originalPut(...args)
      ) as ReturnType<typeof originalPut>;
    });

    const initializePromise = initializeOfflineVault(persistedUser);

    await Promise.resolve();
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();

    deferredProfileWrite.resolve();
    await initializePromise;

    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
      persistedUser
    );
  });

  it("keeps the vault readable when the browser-session CSRF token rotates", async () => {
    await initializeOfflineVault(persistedUser);

    const initialVaultState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);

    expect(initialVaultState).not.toBeNull();

    setCsrfTokenCookie("rotated-csrf-token");

    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
      persistedUser
    );

    const rotatedVaultState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);

    expect(rotatedVaultState).not.toBeNull();
    expect(rotatedVaultState).not.toBe(initialVaultState);
  });

  it("keeps the vault readable when the current csrf cookie is missing but a recent key is cached", async () => {
    await initializeOfflineVault(persistedUser);

    clearOfflineVaultSession();
    clearCsrfTokenCookie();

    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
      persistedUser
    );
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
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

  it("decrypts a persisted auth user from a legacy v1 envelope after upgrade", async () => {
    // 1. Create a real vault — produces V2 browser-session envelope with no native bridge installed
    await initializeOfflineVault(persistedUser);

    const v2State = readStoredVaultState() as {
      subjectHash: string;
      wrapper: { kind: string; salt: string; iv: string; ciphertext: string };
    };

    expect(v2State.wrapper.kind).toBe("browser-session");

    // 2. Re-derive the PBKDF2 MAC key using the same key material + same salt
    const b64ToBytes = (b64: string): Uint8Array => {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1)
        bytes[i] = binary.charCodeAt(i);
      return bytes;
    };
    const saltBytes = b64ToBytes(v2State.wrapper.salt);
    const baseKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("secpal-auth-vault:test-csrf-token"),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: saltBytes.buffer as ArrayBuffer,
        iterations: 600_000,
      },
      baseKey,
      512
    );
    const macKey = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(derivedBits).slice(32),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // 3. Compute the V1 MAC (different payload format than V2)
    const v1MacPayload = [
      "pbkdf2-aes-cbc-hmac-sha256-vault",
      "1",
      v2State.subjectHash,
      v2State.wrapper.salt,
      v2State.wrapper.iv,
      v2State.wrapper.ciphertext,
    ].join(":");
    const macBuf = await crypto.subtle.sign(
      "HMAC",
      macKey,
      new TextEncoder().encode(v1MacPayload)
    );
    const mac = btoa(String.fromCharCode(...new Uint8Array(macBuf)));

    // 4. Overwrite localStorage with a valid V1 envelope using the same ciphertext
    localStorage.setItem(
      AUTH_VAULT_STORAGE_KEY,
      JSON.stringify({
        scheme: "pbkdf2-aes-cbc-hmac-sha256-vault",
        version: 1,
        salt: v2State.wrapper.salt,
        iv: v2State.wrapper.iv,
        ciphertext: v2State.wrapper.ciphertext,
        mac,
        subjectHash: v2State.subjectHash,
      })
    );
    clearOfflineVaultSession();

    // 5. Confirm the V1 envelope is still readable after the wrapper upgrade
    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
      persistedUser
    );
  });

  it("returns null without clearing vault artifacts when native bridge is unavailable for a native-device-bound envelope", async () => {
    // Initialize vault with an available native bridge → native-device-bound envelope
    installNativeVaultBridge({
      isVaultDeviceBoundWrapperAvailable: vi.fn().mockResolvedValue(true),
      wrapVaultRootKey: vi.fn(
        async ({ rootKeyBase64 }: { rootKeyBase64: string }) => ({
          wrappedRootKey: `wrapped:${rootKeyBase64}`,
        })
      ),
      unwrapVaultRootKey: vi.fn(
        async ({ wrappedRootKey }: { wrappedRootKey: string }) => ({
          rootKeyBase64: wrappedRootKey.replace("wrapped:", ""),
        })
      ),
    });
    await initializeOfflineVault(persistedUser);

    expect(readStoredVaultState()).toMatchObject({
      wrapper: { kind: "native-device-bound" },
    });

    // Remove the bridge to simulate a transient unavailability
    setNativeVaultBridge(null);
    clearOfflineVaultSession();

    // Vault must be locked (null) — not corrupted and not cleared
    await expect(readPersistedAuthUserFromVault()).resolves.toBeNull();

    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
    expect(await db.vaultProfile.count()).toBe(1);
  });
});
