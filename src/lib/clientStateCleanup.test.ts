// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import {
  clearSensitiveClientState,
  SENSITIVE_CACHE_NAMES,
} from "./clientStateCleanup";

const mockCaches = {
  keys: vi.fn(),
  delete: vi.fn(),
};

describe("clearSensitiveClientState", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.delete();
    await db.open();

    localStorage.clear();
    sessionStorage.clear();

    // @ts-expect-error Test cache API mock
    globalThis.caches = mockCaches;
  });

  it("clears auth storage, sensitive caches, and IndexedDB tables", async () => {
    localStorage.setItem("auth_user", JSON.stringify({ id: 1 }));
    localStorage.setItem("auth_token", "legacy-token");
    localStorage.setItem("locale", "de");
    sessionStorage.setItem("share-draft", "pending");

    await db.guards.add({
      id: "guard-1",
      name: "Guard",
      email: "guard@secpal.dev",
      lastSynced: new Date(),
    });
    await db.syncQueue.add({
      id: "sync-1",
      type: "create",
      entity: "secret",
      data: { id: "secret-1" },
      status: "pending",
      createdAt: new Date(),
      attempts: 0,
    });
    await db.apiCache.put({
      url: "/v1/secrets",
      data: [{ id: "secret-1" }],
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await db.analytics.add({
      type: "page_view",
      category: "navigation",
      action: "open",
      timestamp: Date.now(),
      synced: false,
      sessionId: "session-1",
    });
    await db.fileQueue.add({
      id: "file-1",
      file: new Blob(["test"]),
      metadata: {
        name: "test.txt",
        type: "text/plain",
        size: 4,
        timestamp: Date.now(),
      },
      uploadState: "pending",
      retryCount: 0,
      createdAt: new Date(),
    });
    await db.secretCache.add({
      id: "secret-1",
      title: "Secret",
      password: "plaintext",
      notes: "note",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      cachedAt: new Date(),
      lastSynced: new Date(),
    });
    await db.organizationalUnitCache.add({
      id: "org-1",
      type: "company",
      name: "SecPal GmbH",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      cachedAt: new Date(),
      lastSynced: new Date(),
    });

    mockCaches.keys.mockResolvedValue([
      "static-assets",
      SENSITIVE_CACHE_NAMES[0],
      SENSITIVE_CACHE_NAMES[6],
    ]);
    mockCaches.delete.mockResolvedValue(true);

    await clearSensitiveClientState();

    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("locale")).toBe("de");
    expect(sessionStorage.length).toBe(0);

    expect(await db.guards.count()).toBe(0);
    expect(await db.syncQueue.count()).toBe(0);
    expect(await db.apiCache.count()).toBe(0);
    expect(await db.analytics.count()).toBe(0);
    expect(await db.fileQueue.count()).toBe(0);
    expect(await db.secretCache.count()).toBe(0);
    expect(await db.organizationalUnitCache.count()).toBe(0);

    expect(mockCaches.delete).toHaveBeenCalledWith(SENSITIVE_CACHE_NAMES[0]);
    expect(mockCaches.delete).toHaveBeenCalledWith(SENSITIVE_CACHE_NAMES[6]);
    expect(mockCaches.delete).not.toHaveBeenCalledWith("static-assets");
  });

  it("does not fail when Cache API is unavailable", async () => {
    // @ts-expect-error Simulate unsupported Cache API
    delete globalThis.caches;

    await expect(clearSensitiveClientState()).resolves.not.toThrow();
  });
});
