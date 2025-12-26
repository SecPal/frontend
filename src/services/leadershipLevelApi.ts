// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig } from "../config";
import { apiFetch } from "./csrf";
import { ApiError } from "./ApiError";
import type {
  LeadershipLevel,
  LeadershipLevelFormData,
  LeadershipLevelListResponse,
} from "../types/leadershipLevel";

/**
 * Leadership Level API Client
 *
 * Based on Issue #426: PR-4 Leadership Levels Frontend UI
 * Backend routes from Issue #424: PR-2 Leadership Levels Backend API
 */

/**
 * Fetch paginated list of leadership levels
 */
export async function fetchLeadershipLevels(params?: {
  page?: number;
  per_page?: number;
  include_inactive?: boolean;
}): Promise<LeadershipLevelListResponse> {
  const searchParams = new URLSearchParams();

  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.per_page)
    searchParams.set("per_page", params.per_page.toString());
  if (params?.include_inactive)
    searchParams.set("include_inactive", params.include_inactive.toString());

  const url = `${apiConfig.baseUrl}/v1/leadership-levels?${searchParams.toString()}`;

  const response = await apiFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    throw new ApiError(
      "Failed to fetch leadership levels",
      response.status,
      await response.json()
    );
  }

  return response.json();
}

/**
 * Fetch all available (active) leadership levels
 * Used for dropdowns/selectors
 */
export async function fetchAvailableLeadershipLevels(): Promise<
  LeadershipLevel[]
> {
  const url = `${apiConfig.baseUrl}/v1/leadership-levels/available`;

  const response = await apiFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    throw new ApiError(
      "Failed to fetch available leadership levels",
      response.status,
      await response.json()
    );
  }

  const data = await response.json();
  return data.data;
}

/**
 * Fetch inactive leadership levels
 */
export async function fetchInactiveLeadershipLevels(): Promise<
  LeadershipLevel[]
> {
  const url = `${apiConfig.baseUrl}/v1/leadership-levels/inactive`;

  const response = await apiFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    throw new ApiError(
      "Failed to fetch inactive leadership levels",
      response.status,
      await response.json()
    );
  }

  const data = await response.json();
  return data.data;
}

/**
 * Search leadership levels by name
 */
export async function searchLeadershipLevels(
  query: string
): Promise<LeadershipLevel[]> {
  const searchParams = new URLSearchParams({ q: query });
  const url = `${apiConfig.baseUrl}/v1/leadership-levels/search?${searchParams.toString()}`;

  const response = await apiFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    throw new ApiError(
      "Failed to search leadership levels",
      response.status,
      await response.json()
    );
  }

  const data = await response.json();
  return data.data;
}

/**
 * Fetch single leadership level by ID
 */
export async function fetchLeadershipLevel(
  id: string
): Promise<LeadershipLevel> {
  const url = `${apiConfig.baseUrl}/v1/leadership-levels/${id}`;

  const response = await apiFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    throw new ApiError(
      "Failed to fetch leadership level",
      response.status,
      await response.json()
    );
  }

  const data = await response.json();
  return data.data;
}

/**
 * Create new leadership level
 */
export async function createLeadershipLevel(
  leadershipLevel: LeadershipLevelFormData
): Promise<LeadershipLevel> {
  const url = `${apiConfig.baseUrl}/v1/leadership-levels`;

  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(leadershipLevel),
  });

  if (!response.ok) {
    throw new ApiError(
      "Failed to create leadership level",
      response.status,
      await response.json()
    );
  }

  const data = await response.json();
  return data.data;
}

/**
 * Update existing leadership level
 */
export async function updateLeadershipLevel(
  id: string,
  leadershipLevel: Partial<LeadershipLevelFormData>
): Promise<LeadershipLevel> {
  const url = `${apiConfig.baseUrl}/v1/leadership-levels/${id}`;

  const response = await apiFetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(leadershipLevel),
  });

  if (!response.ok) {
    throw new ApiError(
      "Failed to update leadership level",
      response.status,
      await response.json()
    );
  }

  const data = await response.json();
  return data.data;
}

/**
 * Delete leadership level (soft delete)
 * Cannot delete if employees are assigned
 */
export async function deleteLeadershipLevel(id: string): Promise<void> {
  const url = `${apiConfig.baseUrl}/v1/leadership-levels/${id}`;

  const response = await apiFetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new ApiError(
      "Failed to delete leadership level",
      response.status,
      await response.json()
    );
  }
}

/**
 * Force delete leadership level (permanent)
 * Admin only, audit requirements
 */
export async function forceDeleteLeadershipLevel(id: string): Promise<void> {
  const url = `${apiConfig.baseUrl}/v1/leadership-levels/${id}/force`;

  const response = await apiFetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new ApiError(
      "Failed to force delete leadership level",
      response.status,
      await response.json()
    );
  }
}

/**
 * Restore soft-deleted leadership level
 */
export async function restoreLeadershipLevel(id: string): Promise<void> {
  const url = `${apiConfig.baseUrl}/v1/leadership-levels/${id}/restore`;

  const response = await apiFetch(url, {
    method: "POST",
  });

  if (!response.ok) {
    throw new ApiError(
      "Failed to restore leadership level",
      response.status,
      await response.json()
    );
  }
}

/**
 * Reorder leadership levels (update ranks via drag-and-drop)
 */
export async function reorderLeadershipLevels(
  reorderedIds: string[]
): Promise<void> {
  const url = `${apiConfig.baseUrl}/v1/leadership-levels/reorder`;

  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ordered_ids: reorderedIds }),
  });

  if (!response.ok) {
    throw new ApiError(
      "Failed to reorder leadership levels",
      response.status,
      await response.json()
    );
  }
}
