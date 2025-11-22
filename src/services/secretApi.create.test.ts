// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createSecret,
  updateSecret,
  ApiError,
  type SecretDetail,
} from "./secretApi";

// Mock fetch globally
globalThis.fetch = vi.fn() as typeof fetch;

describe("secretApi - createSecret", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a secret successfully", async () => {
    const mockSecret: SecretDetail = {
      id: "secret-123",
      title: "Gmail Account",
      username: "user@example.com",
      password: "super-secret",
      url: "https://gmail.com",
      notes: "Main work email",
      tags: ["work", "email"],
      expires_at: "2025-12-31T23:59:59Z",
      created_at: "2025-11-22T10:00:00Z",
      updated_at: "2025-11-22T10:00:00Z",
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ data: mockSecret }),
    });

    const data = {
      title: "Gmail Account",
      username: "user@example.com",
      password: "super-secret",
      url: "https://gmail.com",
      notes: "Main work email",
      tags: ["work", "email"],
      expires_at: "2025-12-31T23:59:59Z",
    };

    const result = await createSecret(data);

    expect(result).toEqual(mockSecret);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/secrets"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(data),
      })
    );
  });

  it("should throw error when title is missing", async () => {
    await expect(
      // @ts-expect-error - Testing invalid input
      createSecret({
        username: "user@example.com",
      })
    ).rejects.toThrow("title is required");
  });

  it("should handle 422 validation errors", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        message: "Validation failed",
        errors: {
          expires_at: ["The expiration date must be in the future"],
        },
      }),
    });

    try {
      await createSecret({ title: "Test", expires_at: "2020-01-01T00:00:00Z" });
      expect.fail("Should have thrown error");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(422);
      expect(apiError.errors).toEqual({
        expires_at: ["The expiration date must be in the future"],
      });
    }
  });

  it("should handle 401 unauthorized", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: "Unauthenticated" }),
    });

    await expect(createSecret({ title: "Test" })).rejects.toThrow(ApiError);
  });

  it("should handle 403 forbidden", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: "Forbidden" }),
    });

    await expect(createSecret({ title: "Test" })).rejects.toThrow(ApiError);
  });

  it("should create secret with only required fields", async () => {
    const mockSecret: SecretDetail = {
      id: "secret-456",
      title: "Minimal Secret",
      created_at: "2025-11-22T10:00:00Z",
      updated_at: "2025-11-22T10:00:00Z",
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ data: mockSecret }),
    });

    const result = await createSecret({ title: "Minimal Secret" });

    expect(result).toEqual(mockSecret);
  });
});

describe("secretApi - updateSecret", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update a secret successfully", async () => {
    const mockSecret: SecretDetail = {
      id: "secret-123",
      title: "Updated Title",
      username: "user@example.com",
      password: "new-password",
      created_at: "2025-11-22T10:00:00Z",
      updated_at: "2025-11-22T11:00:00Z",
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: mockSecret }),
    });

    const result = await updateSecret("secret-123", {
      title: "Updated Title",
      password: "new-password",
    });

    expect(result).toEqual(mockSecret);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/secrets/secret-123"),
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          title: "Updated Title",
          password: "new-password",
        }),
      })
    );
  });

  it("should throw error when secretId is empty", async () => {
    await expect(updateSecret("", { title: "Test" })).rejects.toThrow(
      "secretId is required"
    );
  });

  it("should handle 404 not found", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: "Secret not found" }),
    });

    try {
      await updateSecret("nonexistent-id", { title: "Test" });
      expect.fail("Should have thrown error");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(404);
      expect(apiError.message).toBe("Secret not found");
    }
  });

  it("should handle 422 validation errors on update", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        message: "Validation failed",
        errors: {
          url: ["The url must be a valid URL"],
        },
      }),
    });

    try {
      await updateSecret("secret-123", { url: "invalid-url" });
      expect.fail("Should have thrown error");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(422);
      expect(apiError.errors).toEqual({
        url: ["The url must be a valid URL"],
      });
    }
  });

  it("should update only provided fields", async () => {
    const mockSecret: SecretDetail = {
      id: "secret-123",
      title: "Original Title",
      username: "user@example.com",
      password: "new-password",
      created_at: "2025-11-22T10:00:00Z",
      updated_at: "2025-11-22T11:00:00Z",
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: mockSecret }),
    });

    await updateSecret("secret-123", { password: "new-password" });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ password: "new-password" }),
      })
    );
  });

  it("should handle 403 forbidden on update", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: "Forbidden" }),
    });

    await expect(updateSecret("secret-123", { title: "Test" })).rejects.toThrow(
      ApiError
    );
  });
});
