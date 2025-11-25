// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";
import {
  saveSecret,
  getSecret,
  listSecrets,
  deleteSecret,
  searchSecrets,
  getSecretsByTag,
  getExpiredSecrets,
  clearSecretCache,
} from "./secretStore";
import type { SecretCacheEntry } from "./secretStore";

/**
 * Test suite for SecretStore (IndexedDB secret caching)
 *
 * Tests offline-first secret management:
 * - CRUD operations (save, get, list, delete)
 * - Search and filtering (tags, expiration)
 * - Cache management
 */
describe("SecretStore", () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.delete();
    await db.open();
  });

  describe("saveSecret", () => {
    it("should save a secret to IndexedDB", async () => {
      const secret: SecretCacheEntry = {
        id: "secret-1",
        title: "Gmail Account",
        username: "user@example.com",
        url: "https://gmail.com",
        notes: "Personal email",
        tags: ["email", "personal"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cachedAt: new Date(),
        lastSynced: new Date(),
      };

      await saveSecret(secret);

      const retrieved = await getSecret("secret-1");
      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe("Gmail Account");
      expect(retrieved?.username).toBe("user@example.com");
    });

    it("should update an existing secret", async () => {
      const secret: SecretCacheEntry = {
        id: "secret-1",
        title: "Original Title",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cachedAt: new Date(),
        lastSynced: new Date(),
      };

      await saveSecret(secret);

      // Update secret
      const updated: SecretCacheEntry = {
        ...secret,
        title: "Updated Title",
        updated_at: new Date().toISOString(),
        lastSynced: new Date(),
      };

      await saveSecret(updated);

      const retrieved = await getSecret("secret-1");
      expect(retrieved?.title).toBe("Updated Title");
    });

    it("should store multiple secrets independently", async () => {
      const secret1: SecretCacheEntry = {
        id: "secret-1",
        title: "Secret 1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cachedAt: new Date(),
        lastSynced: new Date(),
      };

      const secret2: SecretCacheEntry = {
        id: "secret-2",
        title: "Secret 2",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cachedAt: new Date(),
        lastSynced: new Date(),
      };

      await saveSecret(secret1);
      await saveSecret(secret2);

      const retrieved1 = await getSecret("secret-1");
      const retrieved2 = await getSecret("secret-2");

      expect(retrieved1?.title).toBe("Secret 1");
      expect(retrieved2?.title).toBe("Secret 2");
    });
  });

  describe("getSecret", () => {
    it("should return secret by ID", async () => {
      const secret: SecretCacheEntry = {
        id: "secret-1",
        title: "Test Secret",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cachedAt: new Date(),
        lastSynced: new Date(),
      };

      await saveSecret(secret);

      const retrieved = await getSecret("secret-1");
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe("secret-1");
    });

    it("should return undefined for non-existent secret", async () => {
      const retrieved = await getSecret("non-existent");
      expect(retrieved).toBeUndefined();
    });
  });

  describe("listSecrets", () => {
    it("should return all cached secrets", async () => {
      const secret1: SecretCacheEntry = {
        id: "secret-1",
        title: "Secret 1",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        cachedAt: new Date("2025-01-01"),
        lastSynced: new Date("2025-01-01"),
      };

      const secret2: SecretCacheEntry = {
        id: "secret-2",
        title: "Secret 2",
        created_at: "2025-01-02T00:00:00Z",
        updated_at: "2025-01-02T00:00:00Z",
        cachedAt: new Date("2025-01-02"),
        lastSynced: new Date("2025-01-02"),
      };

      await saveSecret(secret1);
      await saveSecret(secret2);

      const secrets = await listSecrets();
      expect(secrets).toHaveLength(2);
      expect(secrets.map((s) => s.id)).toContain("secret-1");
      expect(secrets.map((s) => s.id)).toContain("secret-2");
    });

    it("should return secrets sorted by updated_at (newest first)", async () => {
      const secret1: SecretCacheEntry = {
        id: "secret-1",
        title: "Oldest",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        cachedAt: new Date(),
        lastSynced: new Date(),
      };

      const secret2: SecretCacheEntry = {
        id: "secret-2",
        title: "Newest",
        created_at: "2025-01-03T00:00:00Z",
        updated_at: "2025-01-03T00:00:00Z",
        cachedAt: new Date(),
        lastSynced: new Date(),
      };

      const secret3: SecretCacheEntry = {
        id: "secret-3",
        title: "Middle",
        created_at: "2025-01-02T00:00:00Z",
        updated_at: "2025-01-02T00:00:00Z",
        cachedAt: new Date(),
        lastSynced: new Date(),
      };

      await saveSecret(secret1);
      await saveSecret(secret2);
      await saveSecret(secret3);

      const secrets = await listSecrets();
      expect(secrets[0].title).toBe("Newest");
      expect(secrets[1].title).toBe("Middle");
      expect(secrets[2].title).toBe("Oldest");
    });

    it("should return empty array when no secrets are cached", async () => {
      const secrets = await listSecrets();
      expect(secrets).toEqual([]);
    });
  });

  describe("deleteSecret", () => {
    it("should remove secret from IndexedDB", async () => {
      const secret: SecretCacheEntry = {
        id: "secret-1",
        title: "To Be Deleted",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cachedAt: new Date(),
        lastSynced: new Date(),
      };

      await saveSecret(secret);
      expect(await getSecret("secret-1")).toBeDefined();

      await deleteSecret("secret-1");
      expect(await getSecret("secret-1")).toBeUndefined();
    });

    it("should not throw when deleting non-existent secret", async () => {
      await expect(deleteSecret("non-existent")).resolves.not.toThrow();
    });
  });

  describe("searchSecrets", () => {
    beforeEach(async () => {
      // Seed test data
      await saveSecret({
        id: "secret-1",
        title: "Gmail Account",
        username: "user@gmail.com",
        tags: ["email", "personal"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cachedAt: new Date(),
        lastSynced: new Date(),
      });

      await saveSecret({
        id: "secret-2",
        title: "GitHub Token",
        notes: "Personal access token",
        tags: ["dev", "github"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cachedAt: new Date(),
        lastSynced: new Date(),
      });

      await saveSecret({
        id: "secret-3",
        title: "AWS Credentials",
        username: "admin",
        tags: ["cloud", "aws"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cachedAt: new Date(),
        lastSynced: new Date(),
      });
    });

    it("should search by title (case-insensitive)", async () => {
      const results = await searchSecrets("gmail");
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Gmail Account");
    });

    it("should search by username", async () => {
      const results = await searchSecrets("gmail.com");
      expect(results).toHaveLength(1);
      expect(results[0].username).toContain("gmail.com");
    });

    it("should search by notes", async () => {
      const results = await searchSecrets("access token");
      expect(results).toHaveLength(1);
      expect(results[0].notes).toContain("access token");
    });

    it("should return empty array when no matches found", async () => {
      const results = await searchSecrets("nonexistent");
      expect(results).toEqual([]);
    });

    it("should return all secrets when query is empty", async () => {
      const results = await searchSecrets("");
      expect(results).toHaveLength(3);
    });
  });

  describe("getSecretsByTag", () => {
    beforeEach(async () => {
      await saveSecret({
        id: "secret-1",
        title: "Secret 1",
        tags: ["email", "personal"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cachedAt: new Date(),
        lastSynced: new Date(),
      });

      await saveSecret({
        id: "secret-2",
        title: "Secret 2",
        tags: ["email", "work"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cachedAt: new Date(),
        lastSynced: new Date(),
      });

      await saveSecret({
        id: "secret-3",
        title: "Secret 3",
        tags: ["dev", "github"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cachedAt: new Date(),
        lastSynced: new Date(),
      });
    });

    it("should return secrets with specified tag", async () => {
      const results = await getSecretsByTag("email");
      expect(results).toHaveLength(2);
      expect(results.map((s) => s.id)).toContain("secret-1");
      expect(results.map((s) => s.id)).toContain("secret-2");
    });

    it("should return empty array when no secrets have the tag", async () => {
      const results = await getSecretsByTag("nonexistent");
      expect(results).toEqual([]);
    });

    it("should return empty array for secrets without tags", async () => {
      await saveSecret({
        id: "secret-4",
        title: "No Tags",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cachedAt: new Date(),
        lastSynced: new Date(),
      });

      const results = await getSecretsByTag("email");
      expect(results).toHaveLength(2); // Only secret-1 and secret-2
    });
  });

  describe("getExpiredSecrets", () => {
    it("should return secrets that have expired", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await saveSecret({
        id: "secret-1",
        title: "Expired Secret",
        expires_at: yesterday.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cachedAt: new Date(),
        lastSynced: new Date(),
      });

      await saveSecret({
        id: "secret-2",
        title: "Valid Secret",
        expires_at: tomorrow.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cachedAt: new Date(),
        lastSynced: new Date(),
      });

      const expired = await getExpiredSecrets();
      expect(expired).toHaveLength(1);
      expect(expired[0].id).toBe("secret-1");
    });

    it("should not return secrets without expiration", async () => {
      await saveSecret({
        id: "secret-1",
        title: "No Expiration",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cachedAt: new Date(),
        lastSynced: new Date(),
      });

      const expired = await getExpiredSecrets();
      expect(expired).toEqual([]);
    });
  });

  describe("clearSecretCache", () => {
    it("should remove all secrets from IndexedDB", async () => {
      await saveSecret({
        id: "secret-1",
        title: "Secret 1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cachedAt: new Date(),
        lastSynced: new Date(),
      });

      await saveSecret({
        id: "secret-2",
        title: "Secret 2",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cachedAt: new Date(),
        lastSynced: new Date(),
      });

      expect(await listSecrets()).toHaveLength(2);

      await clearSecretCache();

      expect(await listSecrets()).toEqual([]);
    });
  });
});
