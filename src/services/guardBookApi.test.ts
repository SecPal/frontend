// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listGuardBooks,
  getGuardBook,
  createGuardBook,
  updateGuardBook,
  deleteGuardBook,
  listGuardBookReports,
  getGuardBookReport,
  getGuardBookReports,
  generateGuardBookReport,
  deleteGuardBookReport,
  exportGuardBookReport,
} from "./guardBookApi";
import { ApiError } from "./secretApi";
import { apiConfig } from "../config";
import type {
  GuardBook,
  GuardBookReport,
  PaginatedResponse,
} from "../types/organizational";

// Mock apiFetch (central API wrapper)
vi.mock("./csrf", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "./csrf";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFetchWithCsrf = apiFetch as any;

describe("Guard Book API", () => {
  const mockGuardBook: GuardBook = {
    id: "gb-1",
    title: "Wachbuch Terminal 1",
    description: "Primary guard book for Terminal 1",
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  const mockReport: GuardBookReport = {
    id: "report-1",
    report_number: "RPT-2025-001",
    period_start: "2025-01-01T00:00:00Z",
    period_end: "2025-01-31T23:59:59Z",
    total_events: 42,
    generated_at: "2025-02-01T00:00:00Z",
    report_data: [],
    created_at: "2025-02-01T00:00:00Z",
    updated_at: "2025-02-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Guard Book Tests
  // ============================================================================

  describe("listGuardBooks", () => {
    it("should fetch guard books successfully", async () => {
      const mockResponse: PaginatedResponse<GuardBook> = {
        data: [mockGuardBook],
        meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      };

      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await listGuardBooks();

      expect(result.data).toEqual([mockGuardBook]);
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/guard-books`,
        expect.objectContaining({ method: "GET" })
      );
    });

    it("should filter by object_id", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: {} }),
      });

      await listGuardBooks({ object_id: "obj-1" });

      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        expect.stringContaining("object_id=obj-1"),
        expect.any(Object)
      );
    });

    it("should filter by object_area_id", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: {} }),
      });

      await listGuardBooks({ object_area_id: "area-1" });

      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        expect.stringContaining("object_area_id=area-1"),
        expect.any(Object)
      );
    });

    it("should filter by is_active", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: {} }),
      });

      await listGuardBooks({ is_active: true });

      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        expect.stringContaining("is_active=true"),
        expect.any(Object)
      );
    });

    it("should throw ApiError on failure", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: "Forbidden" }),
      });

      await expect(listGuardBooks()).rejects.toThrow(ApiError);
    });
  });

  describe("getGuardBook", () => {
    it("should fetch a single guard book", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockGuardBook }),
      });

      const result = await getGuardBook("gb-1");

      expect(result).toEqual(mockGuardBook);
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/guard-books/gb-1`,
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  describe("createGuardBook", () => {
    it("should create a guard book successfully", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockGuardBook }),
      } as Response);

      const result = await createGuardBook({
        object_id: "obj-1",
        title: "Wachbuch Terminal 1",
      });

      expect(result).toEqual(mockGuardBook);
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/guard-books`,
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Wachbuch Terminal 1"),
        })
      );
    });
  });

  describe("updateGuardBook", () => {
    it("should update a guard book", async () => {
      const updatedGuardBook = { ...mockGuardBook, title: "Updated Title" };
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: updatedGuardBook }),
      } as Response);

      const result = await updateGuardBook("gb-1", { title: "Updated Title" });

      expect(result.title).toBe("Updated Title");
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/guard-books/gb-1`,
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });

  describe("deleteGuardBook", () => {
    it("should delete a guard book", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await expect(deleteGuardBook("gb-1")).resolves.toBeUndefined();
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/guard-books/gb-1`,
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  // ============================================================================
  // Guard Book Report Tests
  // ============================================================================

  describe("listGuardBookReports", () => {
    it("should fetch guard book reports", async () => {
      const mockResponse: PaginatedResponse<GuardBookReport> = {
        data: [mockReport],
        meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      };

      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await listGuardBookReports();

      expect(result.data).toEqual([mockReport]);
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/guard-book-reports`,
        expect.any(Object)
      );
    });

    it("should filter by guard_book_id", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: {} }),
      });

      await listGuardBookReports({ guard_book_id: "gb-1" });

      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        expect.stringContaining("guard_book_id=gb-1"),
        expect.any(Object)
      );
    });

    it("should filter by status", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: {} }),
      });

      await listGuardBookReports({ status: "generated" });

      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        expect.stringContaining("status=generated"),
        expect.any(Object)
      );
    });

    it("should filter by report_type", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: {} }),
      });

      await listGuardBookReports({ report_type: "monthly" });

      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        expect.stringContaining("report_type=monthly"),
        expect.any(Object)
      );
    });
  });

  describe("getGuardBookReport", () => {
    it("should fetch a single guard book report", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockReport }),
      });

      const result = await getGuardBookReport("report-1");

      expect(result).toEqual(mockReport);
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/guard-book-reports/report-1`,
        expect.any(Object)
      );
    });
  });

  describe("getGuardBookReports", () => {
    it("should fetch reports for a specific guard book", async () => {
      const mockResponse: PaginatedResponse<GuardBookReport> = {
        data: [mockReport],
        meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      };

      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getGuardBookReports("gb-1");

      expect(result.data).toEqual([mockReport]);
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/guard-books/gb-1/reports`,
        expect.any(Object)
      );
    });
  });

  describe("generateGuardBookReport", () => {
    it("should generate a guard book report", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockReport }),
      } as Response);

      const result = await generateGuardBookReport("gb-1", {
        period_start: "2025-01-01T00:00:00Z",
        period_end: "2025-01-31T23:59:59Z",
      });

      expect(result).toEqual(mockReport);
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/guard-books/gb-1/reports`,
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("deleteGuardBookReport", () => {
    it("should delete a guard book report", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await expect(deleteGuardBookReport("report-1")).resolves.toBeUndefined();
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/guard-book-reports/report-1`,
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("exportGuardBookReport", () => {
    it("should export a guard book report as PDF", async () => {
      const mockBlob = new Blob(["PDF content"], { type: "application/pdf" });
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        blob: async () => mockBlob,
      });

      const result = await exportGuardBookReport("report-1");

      expect(result).toEqual(mockBlob);
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/guard-book-reports/report-1/export`,
        expect.objectContaining({ method: "GET" })
      );
    });

    it("should throw ApiError on export failure", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: "Report not found" }),
      });

      await expect(exportGuardBookReport("invalid-id")).rejects.toThrow(
        ApiError
      );
    });
  });
});
