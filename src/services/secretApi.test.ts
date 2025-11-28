// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  fetchSecrets,
  getSecretById,
  uploadAttachment,
  uploadEncryptedAttachment,
  listAttachments,
  deleteAttachment,
  getSecretMasterKey,
  ApiError,
  type Secret,
  type SecretDetail,
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
        `${apiConfig.baseUrl}/v1/secrets`,
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

  describe("getSecretById", () => {
    it("should fetch secret by ID successfully", async () => {
      const mockSecret: SecretDetail = {
        id: "secret-1",
        title: "My Secret",
        username: "user@example.com",
        password: "super-secret",
        url: "https://example.com",
        notes: "Some notes",
        tags: ["work", "email"],
        expires_at: "2025-12-31T23:59:59Z",
        created_at: "2025-01-01T10:00:00Z",
        updated_at: "2025-11-15T14:30:00Z",
        owner: {
          id: "user-1",
          name: "John Doe",
        },
        attachment_count: 2,
        is_shared: true,
        attachments: [
          {
            id: "att-1",
            filename: "document.pdf",
            size: 1024,
            mime_type: "application/pdf",
            created_at: "2025-01-01",
          },
        ],
        shares: [
          {
            id: "share-1",
            user: {
              id: "user-2",
              name: "Jane Smith",
            },
            permission: "read",
            granted_by: {
              id: "user-1",
              name: "John Doe",
            },
            granted_at: "2025-11-01T10:00:00Z",
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockSecret }),
      });

      const result = await getSecretById("secret-1");

      expect(result).toEqual(mockSecret);
      expect(mockFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/secrets/secret-1`,
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should throw ApiError on 404 (not found)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: "Secret not found" }),
      });

      await expect(getSecretById("invalid-id")).rejects.toThrow(ApiError);
      await expect(getSecretById("invalid-id")).rejects.toThrow(
        "Secret not found"
      );
    });

    it("should throw ApiError on 403 (forbidden)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: "Access denied" }),
      });

      await expect(getSecretById("secret-1")).rejects.toThrow(ApiError);
    });

    it("should throw error if secretId is empty", async () => {
      await expect(getSecretById("")).rejects.toThrow("secretId is required");
      await expect(getSecretById("   ")).rejects.toThrow(
        "secretId is required"
      );
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(getSecretById("secret-1")).rejects.toThrow("Network error");
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
        `${apiConfig.baseUrl}/v1/secrets/secret-1/attachments`,
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
        `${apiConfig.baseUrl}/v1/secrets/secret-1/attachments`,
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
        `${apiConfig.baseUrl}/v1/attachments/att-1`,
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
        `${apiConfig.baseUrl}/v1/secrets/secret-123`,
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

      // Verify key was imported correctly
      expect(masterKey).toBeInstanceOf(CryptoKey);
      expect(masterKey.type).toBe("secret");
      expect(masterKey.extractable).toBe(true); // Needed for deriveFileKey

      // Verify we can use the key for encryption
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        masterKey,
        testData
      );
      expect(encrypted).toBeInstanceOf(Object);
      expect(encrypted.byteLength).toBeGreaterThan(0);
    });

    it("should create extractable CryptoKey (required for HKDF)", async () => {
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

      // Should be able to export it (needed for deriveFileKey)
      const exported = await crypto.subtle.exportKey("raw", masterKey);
      expect(exported).toBeInstanceOf(Object);
      expect(exported.byteLength).toBe(32); // 256 bits
    });
  });

  describe("uploadEncryptedAttachment", () => {
    it("should upload encrypted blob successfully", async () => {
      const mockAttachment: SecretAttachment = {
        id: "att-1",
        filename: "encrypted.bin",
        size: 128,
        mime_type: "application/octet-stream",
        created_at: "2025-11-21T10:00:00Z",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockAttachment }),
      });

      const encryptedBlob = new Blob([new Uint8Array([1, 2, 3, 4, 5])]);
      const metadata = {
        filename: "document.pdf",
        type: "application/pdf",
        size: 1024,
        encryptedSize: 128,
        checksum: "abc123def456",
        checksumEncrypted: "789ghi012jkl",
      };

      const result = await uploadEncryptedAttachment(
        "secret-123",
        encryptedBlob,
        metadata
      );

      expect(result).toEqual(mockAttachment);
      expect(mockFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/secrets/secret-123/attachments`,
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        })
      );

      // Verify FormData contains encrypted blob
      const callArgs = mockFetch.mock.calls[0];
      if (!callArgs) throw new Error("mockFetch not called");
      const formData = callArgs[1].body as FormData;
      expect(formData.get("file")).toBeInstanceOf(Blob);
      expect(formData.get("metadata")).toBe(JSON.stringify(metadata));
    });

    it("should include metadata in upload", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { id: "att-1", filename: "test.bin", size: 100 },
        }),
      });

      const blob = new Blob([new Uint8Array(10)]);
      const metadata = {
        filename: "secret.txt",
        type: "text/plain",
        size: 500,
        encryptedSize: 512,
        checksum: "original-checksum",
        checksumEncrypted: "encrypted-checksum",
      };

      await uploadEncryptedAttachment("secret-456", blob, metadata);

      const callArgs = mockFetch.mock.calls[0];
      if (!callArgs) throw new Error("mockFetch not called");
      const formData = callArgs[1].body as FormData;
      const metadataJson = formData.get("metadata");
      expect(metadataJson).toBe(JSON.stringify(metadata));

      const parsedMetadata = JSON.parse(metadataJson as string);
      expect(parsedMetadata.checksum).toBe("original-checksum");
      expect(parsedMetadata.checksumEncrypted).toBe("encrypted-checksum");
    });

    it("should handle upload errors gracefully", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 413,
        json: async () => ({
          message: "File too large",
          errors: { file: ["Maximum size is 10MB"] },
        }),
      });

      const blob = new Blob([new Uint8Array(1)]);
      const metadata = {
        filename: "large.bin",
        type: "application/octet-stream",
        size: 15000000,
        encryptedSize: 15000128,
        checksum: "abc",
        checksumEncrypted: "def",
      };

      await expect(
        uploadEncryptedAttachment("secret-123", blob, metadata)
      ).rejects.toThrow(ApiError);
      await expect(
        uploadEncryptedAttachment("secret-123", blob, metadata)
      ).rejects.toThrow("File too large");
    });

    it("should handle network failures", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const blob = new Blob([new Uint8Array(1)]);
      const metadata = {
        filename: "test.txt",
        type: "text/plain",
        size: 100,
        encryptedSize: 128,
        checksum: "abc",
        checksumEncrypted: "def",
      };

      await expect(
        uploadEncryptedAttachment("secret-123", blob, metadata)
      ).rejects.toThrow("Network error");
    });

    it("should reject empty secretId", async () => {
      const blob = new Blob([new Uint8Array(1)]);
      const metadata = {
        filename: "test.txt",
        type: "text/plain",
        size: 100,
        encryptedSize: 128,
        checksum: "abc",
        checksumEncrypted: "def",
      };

      await expect(
        uploadEncryptedAttachment("", blob, metadata)
      ).rejects.toThrow("secretId is required");
      await expect(
        uploadEncryptedAttachment("   ", blob, metadata)
      ).rejects.toThrow("secretId is required");
    });

    it("should reject empty blob", async () => {
      const emptyBlob = new Blob([]);
      const metadata = {
        filename: "test.txt",
        type: "text/plain",
        size: 100,
        encryptedSize: 0,
        checksum: "abc",
        checksumEncrypted: "def",
      };

      await expect(
        uploadEncryptedAttachment("secret-123", emptyBlob, metadata)
      ).rejects.toThrow("encryptedBlob must be a non-empty Blob");
    });

    it("should not include Content-Type header (FormData auto-sets it)", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { id: "att-1", filename: "test.bin", size: 100 },
        }),
      });

      const blob = new Blob([new Uint8Array(10)]);
      const metadata = {
        filename: "test.txt",
        type: "text/plain",
        size: 100,
        encryptedSize: 128,
        checksum: "abc",
        checksumEncrypted: "def",
      };

      await uploadEncryptedAttachment("secret-123", blob, metadata);

      const callArgs = mockFetch.mock.calls[0];
      if (!callArgs) throw new Error("mockFetch not called");
      const headers = callArgs[1].headers;

      // Should NOT include Content-Type (FormData sets it automatically with boundary)
      expect(headers["Content-Type"]).toBeUndefined();
    });
  });

  describe("downloadAndDecryptAttachment", () => {
    it("should download and decrypt file successfully", async () => {
      // Step 1: Create test file and encrypt it
      const originalFile = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const masterKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      // Import encryption functions for test
      const { deriveFileKey, encryptFile } =
        await import("../lib/crypto/encryption");
      const { calculateChecksum } = await import("../lib/crypto/checksum");

      const filename = "document.pdf";
      const fileKey = await deriveFileKey(masterKey, filename);
      const encrypted = await encryptFile(originalFile, fileKey);

      // Calculate checksums
      const checksum = await calculateChecksum(originalFile);
      const encryptedData = new Uint8Array([
        ...encrypted.iv,
        ...encrypted.authTag,
        ...encrypted.ciphertext,
      ]);
      const checksumEncrypted = await calculateChecksum(encryptedData);

      // Step 2: Mock backend response
      const mockResponse = {
        encryptedBlob: btoa(String.fromCharCode(...encryptedData)),
        metadata: {
          filename,
          type: "application/pdf",
          size: originalFile.length,
          encryptedSize: encryptedData.length,
          checksum,
          checksumEncrypted,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // Step 3: Import function under test
      const { downloadAndDecryptAttachment } = await import("./secretApi");

      // Step 4: Test download and decrypt
      const decryptedFile = await downloadAndDecryptAttachment(
        "attachment-123",
        masterKey
      );

      expect(decryptedFile).toBeInstanceOf(File);
      expect(decryptedFile.name).toBe(filename);
      expect(decryptedFile.type).toBe("application/pdf");
      expect(decryptedFile.size).toBe(originalFile.length);

      // Verify file contents
      const decryptedBuffer = await decryptedFile.arrayBuffer();
      const decryptedBytes = new Uint8Array(decryptedBuffer);
      expect(decryptedBytes).toEqual(originalFile);

      // Verify API call
      expect(mockFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/attachments/attachment-123/download`,
        expect.objectContaining({
          method: "GET",
          credentials: "include",
        })
      );
    });

    it("should verify checksum after decryption", async () => {
      const originalFile = new Uint8Array([10, 20, 30]);
      const masterKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      const { deriveFileKey, encryptFile } =
        await import("../lib/crypto/encryption");
      const { calculateChecksum } = await import("../lib/crypto/checksum");

      const filename = "test.txt";
      const fileKey = await deriveFileKey(masterKey, filename);
      const encrypted = await encryptFile(originalFile, fileKey);

      const checksum = await calculateChecksum(originalFile);
      const encryptedData = new Uint8Array([
        ...encrypted.iv,
        ...encrypted.authTag,
        ...encrypted.ciphertext,
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          encryptedBlob: btoa(String.fromCharCode(...encryptedData)),
          metadata: {
            filename,
            type: "text/plain",
            size: originalFile.length,
            encryptedSize: encryptedData.length,
            checksum,
            checksumEncrypted: await calculateChecksum(encryptedData),
          },
        }),
      });

      const { downloadAndDecryptAttachment } = await import("./secretApi");
      const result = await downloadAndDecryptAttachment(
        "attachment-456",
        masterKey
      );

      // Should succeed with valid checksum
      expect(result).toBeInstanceOf(File);
      expect(result.name).toBe(filename);
    });

    it("should reject tampered files (invalid checksum)", async () => {
      const originalFile = new Uint8Array([1, 2, 3]);
      const masterKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      const { deriveFileKey, encryptFile } =
        await import("../lib/crypto/encryption");
      const { calculateChecksum } = await import("../lib/crypto/checksum");

      const filename = "tampered.txt";
      const fileKey = await deriveFileKey(masterKey, filename);
      const encrypted = await encryptFile(originalFile, fileKey);

      const encryptedData = new Uint8Array([
        ...encrypted.iv,
        ...encrypted.authTag,
        ...encrypted.ciphertext,
      ]);

      // Use WRONG checksum (simulate tampering)
      const wrongChecksum = "0".repeat(64);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          encryptedBlob: btoa(String.fromCharCode(...encryptedData)),
          metadata: {
            filename,
            type: "text/plain",
            size: originalFile.length,
            encryptedSize: encryptedData.length,
            checksum: wrongChecksum, // WRONG!
            checksumEncrypted: await calculateChecksum(encryptedData),
          },
        }),
      });

      const { downloadAndDecryptAttachment } = await import("./secretApi");

      await expect(
        downloadAndDecryptAttachment("attachment-789", masterKey)
      ).rejects.toThrow(/checksum verification failed/i);
    });

    it("should handle download errors gracefully", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: "Attachment not found" }),
      });

      const masterKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      const { downloadAndDecryptAttachment } = await import("./secretApi");

      await expect(
        downloadAndDecryptAttachment("missing-attachment", masterKey)
      ).rejects.toThrow(ApiError);
      await expect(
        downloadAndDecryptAttachment("missing-attachment", masterKey)
      ).rejects.toThrow("Attachment not found");
    });

    it("should handle network errors during download", async () => {
      mockFetch.mockRejectedValue(new Error("Network timeout"));

      const masterKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      const { downloadAndDecryptAttachment } = await import("./secretApi");

      await expect(
        downloadAndDecryptAttachment("attachment-123", masterKey)
      ).rejects.toThrow("Network timeout");
    });

    it("should handle decryption errors gracefully", async () => {
      // Simulate corrupted encrypted data
      const corruptedData = new Uint8Array(32).fill(0xff);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          encryptedBlob: btoa(String.fromCharCode(...corruptedData)),
          metadata: {
            filename: "corrupt.bin",
            type: "application/octet-stream",
            size: 100,
            encryptedSize: 128,
            checksum: "abc123",
            checksumEncrypted: "def456",
          },
        }),
      });

      const masterKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      const { downloadAndDecryptAttachment } = await import("./secretApi");

      // Should throw error due to invalid encrypted format or decryption failure
      await expect(
        downloadAndDecryptAttachment("corrupt-attachment", masterKey)
      ).rejects.toThrow();
    });

    it("should restore original filename and MIME type", async () => {
      const originalFile = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const masterKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      const { deriveFileKey, encryptFile } =
        await import("../lib/crypto/encryption");
      const { calculateChecksum } = await import("../lib/crypto/checksum");

      const originalFilename = "secret-document.docx";
      const originalMimeType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      const fileKey = await deriveFileKey(masterKey, originalFilename);
      const encrypted = await encryptFile(originalFile, fileKey);

      const encryptedData = new Uint8Array([
        ...encrypted.iv,
        ...encrypted.authTag,
        ...encrypted.ciphertext,
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          encryptedBlob: btoa(String.fromCharCode(...encryptedData)),
          metadata: {
            filename: originalFilename,
            type: originalMimeType,
            size: originalFile.length,
            encryptedSize: encryptedData.length,
            checksum: await calculateChecksum(originalFile),
            checksumEncrypted: await calculateChecksum(encryptedData),
          },
        }),
      });

      const { downloadAndDecryptAttachment } = await import("./secretApi");
      const result = await downloadAndDecryptAttachment(
        "attachment-docx",
        masterKey
      );

      expect(result.name).toBe(originalFilename);
      expect(result.type).toBe(originalMimeType);
    });

    it("should handle missing files (404)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          message: "Attachment not found or has been deleted",
        }),
      });

      const masterKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      const { downloadAndDecryptAttachment } = await import("./secretApi");

      await expect(
        downloadAndDecryptAttachment("deleted-attachment", masterKey)
      ).rejects.toThrow(ApiError);
      await expect(
        downloadAndDecryptAttachment("deleted-attachment", masterKey)
      ).rejects.toThrow("Attachment not found or has been deleted");
    });
  });
});
