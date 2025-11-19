// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  fetchSecrets,
  uploadAttachment,
  listAttachments,
  deleteAttachment,
  getSecretMasterKey,
  ApiError,
  type Secret,
  type SecretAttachment,
} from "./secretApi";
import { apiConfig } from "../config";

describe("Secret API", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  describe("fetchSecrets", () => {
    it("should fetch secrets successfully", async () => {
      const mockSecrets: Secret[] = [
        {
          id: "secret-1",
          title: "My Secret",
          created_at: "2025-01-01",
          updated_at: "2025-01-01",
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockSecrets }),
      });

      const secrets = await fetchSecrets();

      expect(secrets).toEqual(mockSecrets);
      expect(mockFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/api/v1/secrets`,
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should throw ApiError on failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "Unauthorized" }),
      });

      await expect(fetchSecrets()).rejects.toThrow(ApiError);
      await expect(fetchSecrets()).rejects.toThrow("Unauthorized");
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(fetchSecrets()).rejects.toThrow("Network error");
    });
  });

  describe("uploadAttachment", () => {
    it("should upload file successfully", async () => {
      const mockAttachment: SecretAttachment = {
        id: "att-1",
        filename: "test.txt",
        size: 1024,
        mime_type: "text/plain",
        created_at: "2025-01-01",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockAttachment }),
      });

      const file = new File(["test"], "test.txt", { type: "text/plain" });
      const result = await uploadAttachment("secret-1", file);

      expect(result).toEqual(mockAttachment);
      expect(mockFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/api/v1/secrets/secret-1/attachments`,
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        })
      );
    });

    it("should throw ApiError on upload failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 413,
        json: async () => ({
          message: "File too large",
          errors: { file: ["Maximum size is 10MB"] },
        }),
      });

      const file = new File(["test"], "test.txt");

      await expect(uploadAttachment("secret-1", file)).rejects.toThrow(
        ApiError
      );
      await expect(uploadAttachment("secret-1", file)).rejects.toThrow(
        "File too large"
      );
    });
  });

  describe("listAttachments", () => {
    it("should list attachments successfully", async () => {
      const mockAttachments: SecretAttachment[] = [
        {
          id: "att-1",
          filename: "file1.txt",
          size: 1024,
          mime_type: "text/plain",
          created_at: "2025-01-01",
        },
        {
          id: "att-2",
          filename: "file2.pdf",
          size: 2048,
          mime_type: "application/pdf",
          created_at: "2025-01-02",
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockAttachments }),
      });

      const attachments = await listAttachments("secret-1");

      expect(attachments).toEqual(mockAttachments);
      expect(mockFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/api/v1/secrets/secret-1/attachments`,
        expect.objectContaining({
          method: "GET",
        })
      );
    });

    it("should throw ApiError on failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: "Secret not found" }),
      });

      await expect(listAttachments("secret-1")).rejects.toThrow(ApiError);
    });
  });

  describe("deleteAttachment", () => {
    it("should delete attachment successfully", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
      });

      await expect(deleteAttachment("att-1")).resolves.toBeUndefined();
      expect(mockFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/api/v1/attachments/att-1`,
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    it("should throw ApiError on delete failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: "Attachment not found" }),
      });

      await expect(deleteAttachment("att-1")).rejects.toThrow(ApiError);
    });
  });

  describe("ApiError", () => {
    it("should create error with status and validation errors", () => {
      const error = new ApiError("Validation failed", 422, {
        email: ["Invalid format"],
        password: ["Too short"],
      });

      expect(error.message).toBe("Validation failed");
      expect(error.status).toBe(422);
      expect(error.errors).toEqual({
        email: ["Invalid format"],
        password: ["Too short"],
      });
      expect(error.name).toBe("ApiError");
    });

    it("should handle malformed JSON error responses", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.reject(new Error("Invalid JSON")),
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(fetchSecrets()).rejects.toThrow("Internal Server Error");
    });
  });

  describe("Input Validation", () => {
    it("should reject empty secretId in uploadAttachment", async () => {
      const file = new File(["test"], "test.txt", { type: "text/plain" });
      await expect(uploadAttachment("", file)).rejects.toThrow(
        "secretId is required"
      );
      await expect(uploadAttachment("   ", file)).rejects.toThrow(
        "secretId is required"
      );
    });

    it("should reject invalid file in uploadAttachment", async () => {
      const emptyFile = new File([], "empty.txt", { type: "text/plain" });
      await expect(uploadAttachment("secret-123", emptyFile)).rejects.toThrow(
        "file must be a non-empty File object"
      );
    });

    it("should reject empty secretId in listAttachments", async () => {
      await expect(listAttachments("")).rejects.toThrow("secretId is required");
      await expect(listAttachments("   ")).rejects.toThrow(
        "secretId is required"
      );
    });

    it("should reject empty attachmentId in deleteAttachment", async () => {
      await expect(deleteAttachment("")).rejects.toThrow(
        "attachmentId is required"
      );
      await expect(deleteAttachment("   ")).rejects.toThrow(
        "attachmentId is required"
      );
    });
  });

  describe("getSecretMasterKey", () => {
    it("should fetch and import master key successfully", async () => {
      // Generate a real 256-bit key and export it to Base64
      const testKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
      const exportedKey = await crypto.subtle.exportKey("raw", testKey);
      const keyBytes = new Uint8Array(exportedKey);

      // Convert to Base64
      const base64Key = btoa(String.fromCharCode(...keyBytes));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: "secret-123",
            title: "Test Secret",
            master_key: base64Key,
            created_at: "2025-01-01",
            updated_at: "2025-01-01",
          },
        }),
      });

      const masterKey = await getSecretMasterKey("secret-123");

      expect(masterKey).toBeInstanceOf(CryptoKey);
      expect(masterKey.type).toBe("secret");
      expect(masterKey.algorithm.name).toBe("AES-GCM");
      expect((masterKey.algorithm as AesKeyAlgorithm).length).toBe(256);
      expect(masterKey.usages).toContain("encrypt");
      expect(masterKey.usages).toContain("decrypt");

      expect(mockFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/api/v1/secrets/secret-123`,
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should reject empty secretId", async () => {
      await expect(getSecretMasterKey("")).rejects.toThrow(
        "secretId is required"
      );
      await expect(getSecretMasterKey("   ")).rejects.toThrow(
        "secretId is required"
      );
    });

    it("should throw ApiError when API request fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: "Secret not found" }),
      });

      await expect(getSecretMasterKey("invalid-id")).rejects.toThrow(ApiError);
      await expect(getSecretMasterKey("invalid-id")).rejects.toThrow(
        "Secret not found"
      );
    });

    it("should handle API errors without json body", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      await expect(getSecretMasterKey("secret-123")).rejects.toThrow(ApiError);
    });

    it("should throw error when master_key is missing", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: "secret-123",
            title: "Test Secret",
            // master_key missing
            created_at: "2025-01-01",
            updated_at: "2025-01-01",
          },
        }),
      });

      await expect(getSecretMasterKey("secret-123")).rejects.toThrow(
        "Secret has no master key"
      );
    });

    it("should correctly decode Base64 master key", async () => {
      // Use a known 256-bit key (32 bytes of 0x42)
      const testKeyBytes = new Uint8Array(32).fill(0x42);
      const base64Key = btoa(String.fromCharCode(...testKeyBytes));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: "secret-123",
            title: "Test Secret",
            master_key: base64Key,
            created_at: "2025-01-01",
            updated_at: "2025-01-01",
          },
        }),
      });

      const masterKey = await getSecretMasterKey("secret-123");

      // Export and verify the key bytes
      const exportedKey = await crypto.subtle.exportKey("raw", masterKey);
      const exportedBytes = new Uint8Array(exportedKey);

      expect(exportedBytes).toEqual(testKeyBytes);
      expect(exportedBytes.length).toBe(32); // 256 bits
    });

    it("should create extractable CryptoKey", async () => {
      const testKeyBytes = new Uint8Array(32).fill(0x01);
      const base64Key = btoa(String.fromCharCode(...testKeyBytes));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: "secret-123",
            title: "Test Secret",
            master_key: base64Key,
            created_at: "2025-01-01",
            updated_at: "2025-01-01",
          },
        }),
      });

      const masterKey = await getSecretMasterKey("secret-123");

      expect(masterKey.extractable).toBe(true);

      // Should be able to export it
      const exported = await crypto.subtle.exportKey("raw", masterKey);
      expect(exported).toBeInstanceOf(Object);
      expect(exported.byteLength).toBe(32); // 256 bits
    });
  });
});
