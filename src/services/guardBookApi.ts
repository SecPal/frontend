// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig } from "../config";
import { fetchWithCsrf } from "./csrf";
import type {
  GuardBook,
  GuardBookReport,
  CreateGuardBookRequest,
  UpdateGuardBookRequest,
  GenerateReportRequest,
  GuardBookFilters,
  PaginatedResponse,
} from "../types/organizational";
import { ApiError } from "./secretApi";

/**
 * Guard Book API Service
 *
 * Provides CRUD operations for guard books (continuous event stream containers)
 * and report generation. Guard books can be linked to entire objects or specific
 * object areas for fine-grained organization.
 *
 * @see ADR-007: Organizational Structure Hierarchy
 * @see ADR-001: Event Sourcing for Guard Book Entries
 */

// ============================================================================
// Guard Book CRUD Operations
// ============================================================================

/**
 * List guard books with optional filters
 */
export async function listGuardBooks(
  filters?: GuardBookFilters
): Promise<PaginatedResponse<GuardBook>> {
  const params = new URLSearchParams();

  if (filters?.object_id) {
    params.set("object_id", filters.object_id);
  }
  if (filters?.object_area_id) {
    params.set("object_area_id", filters.object_area_id);
  }
  if (filters?.is_active !== undefined) {
    params.set("is_active", String(filters.is_active));
  }
  if (filters?.per_page) {
    params.set("per_page", String(filters.per_page));
  }
  if (filters?.page) {
    params.set("page", String(filters.page));
  }

  const queryString = params.toString();
  const url = `${apiConfig.baseUrl}/v1/guard-books${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to fetch guard books",
      response.status
    );
  }

  return response.json();
}

/**
 * Get a single guard book by ID
 */
export async function getGuardBook(id: string): Promise<GuardBook> {
  const response = await fetch(`${apiConfig.baseUrl}/v1/guard-books/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to fetch guard book",
      response.status
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Create a new guard book
 *
 * Note: Either object_id OR object_area_id must be provided, not both.
 */
export async function createGuardBook(
  data: CreateGuardBookRequest
): Promise<GuardBook> {
  const response = await fetchWithCsrf(`${apiConfig.baseUrl}/v1/guard-books`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to create guard book",
      response.status,
      error.errors
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Update a guard book
 */
export async function updateGuardBook(
  id: string,
  data: UpdateGuardBookRequest
): Promise<GuardBook> {
  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/guard-books/${id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to update guard book",
      response.status,
      error.errors
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Delete (archive) a guard book
 */
export async function deleteGuardBook(id: string): Promise<void> {
  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/guard-books/${id}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to delete guard book",
      response.status
    );
  }
}

// ============================================================================
// Guard Book Report Operations
// ============================================================================

/**
 * Get reports for a guard book
 */
export async function getGuardBookReports(
  guardBookId: string,
  filters?: { per_page?: number; page?: number }
): Promise<PaginatedResponse<GuardBookReport>> {
  const params = new URLSearchParams();

  if (filters?.per_page) {
    params.set("per_page", String(filters.per_page));
  }
  if (filters?.page) {
    params.set("page", String(filters.page));
  }

  const queryString = params.toString();
  const url = `${apiConfig.baseUrl}/v1/guard-books/${guardBookId}/reports${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to fetch guard book reports",
      response.status
    );
  }

  return response.json();
}

/**
 * Generate a new report for a guard book
 */
export async function generateGuardBookReport(
  guardBookId: string,
  data: GenerateReportRequest
): Promise<GuardBookReport> {
  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/guard-books/${guardBookId}/reports`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to generate report",
      response.status,
      error.errors
    );
  }

  const result = await response.json();
  return result.data;
}

// ============================================================================
// Guard Book Report CRUD Operations
// ============================================================================

/**
 * List all guard book reports with optional filters
 */
export async function listGuardBookReports(filters?: {
  guard_book_id?: string;
  status?: "draft" | "generated" | "finalized";
  report_type?: "daily" | "weekly" | "monthly" | "custom";
  per_page?: number;
  page?: number;
}): Promise<PaginatedResponse<GuardBookReport>> {
  const params = new URLSearchParams();

  if (filters?.guard_book_id) {
    params.set("guard_book_id", filters.guard_book_id);
  }
  if (filters?.status) {
    params.set("status", filters.status);
  }
  if (filters?.report_type) {
    params.set("report_type", filters.report_type);
  }
  if (filters?.per_page) {
    params.set("per_page", String(filters.per_page));
  }
  if (filters?.page) {
    params.set("page", String(filters.page));
  }

  const queryString = params.toString();
  const url = `${apiConfig.baseUrl}/v1/guard-book-reports${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to fetch reports",
      response.status
    );
  }

  return response.json();
}

/**
 * Get a single guard book report by ID
 */
export async function getGuardBookReport(id: string): Promise<GuardBookReport> {
  const response = await fetch(
    `${apiConfig.baseUrl}/v1/guard-book-reports/${id}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to fetch report",
      response.status
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Export a guard book report as PDF
 *
 * Returns the PDF blob for download.
 */
export async function exportGuardBookReport(id: string): Promise<Blob> {
  const response = await fetch(
    `${apiConfig.baseUrl}/v1/guard-book-reports/${id}/export`,
    {
      method: "GET",
      headers: {
        Accept: "application/pdf",
      },
      credentials: "include",
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to export report",
      response.status
    );
  }

  return response.blob();
}

/**
 * Delete a guard book report
 */
export async function deleteGuardBookReport(id: string): Promise<void> {
  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/guard-book-reports/${id}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to delete report",
      response.status
    );
  }
}
