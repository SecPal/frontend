// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import {
  detectSecretConflict,
  resolveConflictLWW,
  applyConflictResolution,
  type SecretConflict,
} from "./conflictResolution";
import type { SecretDetail } from "../services/secretApi";

describe("Conflict Resolution", () => {
  const baseSecret: SecretDetail = {
    id: "secret-1",
    title: "Gmail Account",
    username: "user@example.com",
    password: "password123",
    url: "https://gmail.com",
    notes: "Work email",
    tags: ["work", "email"],
    created_at: "2025-01-01T10:00:00Z",
    updated_at: "2025-01-01T12:00:00Z",
  };

  describe("detectSecretConflict", () => {
    it("should return null when timestamps match", () => {
      const local = { ...baseSecret };
      const server = { ...baseSecret };

      const conflict = detectSecretConflict(local, server);

      expect(conflict).toBeNull();
    });

    it("should return null when local is newer", () => {
      const local = {
        ...baseSecret,
        updated_at: "2025-01-01T13:00:00Z",
        title: "Updated Gmail",
      };
      const server = { ...baseSecret };

      const conflict = detectSecretConflict(local, server);

      expect(conflict).toBeNull();
    });

    it("should return null when only timestamps differ", () => {
      const local = {
        ...baseSecret,
        updated_at: "2025-01-01T11:00:00Z",
      };
      const server = {
        ...baseSecret,
        updated_at: "2025-01-01T12:00:00Z",
      };

      const conflict = detectSecretConflict(local, server);

      expect(conflict).toBeNull();
    });

    it("should detect conflict when local is older with changes", () => {
      const local = {
        ...baseSecret,
        updated_at: "2025-01-01T11:00:00Z",
        title: "Updated Gmail",
      };
      const server = {
        ...baseSecret,
        updated_at: "2025-01-01T12:00:00Z",
        title: "Gmail Account",
      };

      const conflict = detectSecretConflict(local, server);

      expect(conflict).not.toBeNull();
      expect(conflict?.conflictFields).toContain("title");
    });

    it("should detect multiple conflicting fields", () => {
      const local = {
        ...baseSecret,
        updated_at: "2025-01-01T11:00:00Z",
        title: "Updated Gmail",
        username: "new@example.com",
        password: "newpass123",
      };
      const server = {
        ...baseSecret,
        updated_at: "2025-01-01T12:00:00Z",
      };

      const conflict = detectSecretConflict(local, server);

      expect(conflict?.conflictFields).toEqual(
        expect.arrayContaining(["title", "username", "password"])
      );
      expect(conflict?.conflictFields).toHaveLength(3);
    });

    it("should detect tag conflicts", () => {
      const local = {
        ...baseSecret,
        updated_at: "2025-01-01T11:00:00Z",
        tags: ["work", "email", "important"],
      };
      const server = {
        ...baseSecret,
        updated_at: "2025-01-01T12:00:00Z",
        tags: ["work", "email"],
      };

      const conflict = detectSecretConflict(local, server);

      expect(conflict?.conflictFields).toContain("tags");
    });

    it("should handle missing optional fields", () => {
      const local = {
        ...baseSecret,
        updated_at: "2025-01-01T11:00:00Z",
        notes: undefined,
      };
      const server = {
        ...baseSecret,
        updated_at: "2025-01-01T12:00:00Z",
        notes: "Updated notes",
      };

      const conflict = detectSecretConflict(local, server);

      // No conflict because local doesn't have notes (no local change)
      expect(conflict).toBeNull();
    });
  });

  describe("resolveConflictLWW", () => {
    it("should keep server when server is newer", () => {
      const conflict: SecretConflict = {
        localVersion: {
          ...baseSecret,
          updated_at: "2025-01-01T11:00:00Z",
        },
        serverVersion: {
          ...baseSecret,
          updated_at: "2025-01-01T12:00:00Z",
        },
        conflictFields: ["title"],
      };

      const resolution = resolveConflictLWW(conflict);

      expect(resolution).toBe("keep-server");
    });

    it("should keep local when local is newer", () => {
      const conflict: SecretConflict = {
        localVersion: {
          ...baseSecret,
          updated_at: "2025-01-01T13:00:00Z",
        },
        serverVersion: {
          ...baseSecret,
          updated_at: "2025-01-01T12:00:00Z",
        },
        conflictFields: ["title"],
      };

      const resolution = resolveConflictLWW(conflict);

      expect(resolution).toBe("keep-local");
    });
  });

  describe("applyConflictResolution", () => {
    it("should return server version when keeping server", () => {
      const local = {
        ...baseSecret,
        title: "Local Title",
      };
      const server = {
        ...baseSecret,
        title: "Server Title",
      };

      const result = applyConflictResolution(local, server, "keep-server");

      expect(result.title).toBe("Server Title");
      expect(result.updated_at).toBe(baseSecret.updated_at);
    });

    it("should merge local changes when keeping local", () => {
      const local = {
        id: baseSecret.id,
        title: "Local Title",
        username: "local@example.com",
        updated_at: "2025-01-01T11:00:00Z",
      };
      const server = {
        ...baseSecret,
        title: "Server Title",
        updated_at: "2025-01-01T12:00:00Z",
      };

      const result = applyConflictResolution(local, server, "keep-local");

      expect(result.title).toBe("Local Title");
      expect(result.username).toBe("local@example.com");
      expect(result.password).toBe(baseSecret.password); // Server value preserved
      expect(result.updated_at).toBe(server.updated_at); // Server timestamp
    });

    it("should preserve server metadata when keeping local", () => {
      const local = {
        id: baseSecret.id,
        title: "Local Title",
        updated_at: "2025-01-01T11:00:00Z",
      };
      const server = {
        ...baseSecret,
        created_at: "2025-01-01T10:00:00Z",
        updated_at: "2025-01-01T12:00:00Z",
      };

      const result = applyConflictResolution(local, server, "keep-local");

      expect(result.created_at).toBe(server.created_at);
      expect(result.updated_at).toBe(server.updated_at);
    });
  });
});
