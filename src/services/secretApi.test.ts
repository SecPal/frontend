// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  fetchSecrets,
  uploadAttachment,
  listAttachments,
  deleteAttachment,
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
  });
});
