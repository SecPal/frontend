// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig } from "../config";
import { apiFetch } from "./csrf";
import { ApiError, type SecretShare } from "./secretApi";

// Re-export ApiError for test convenience
export { ApiError };

/**
 * Request payload for creating a share
 */
export interface CreateShareRequest {
  user_id?: string; // XOR with role_id
  role_id?: string;
  permission: "read" | "write" | "admin";
  expires_at?: string; // ISO 8601 format
}

/**
 * Fetch all shares for a secret
 *
 * @param secretId - Secret UUID
 * @returns Array of shares
 * @throws ApiError if request fails
 *
 * @example
 * ```ts
 * const shares = await fetchShares("019a9b50-secret-id");
 * console.log(`Secret has ${shares.length} shares`);
 * ```
 */
export async function fetchShares(secretId: string): Promise<SecretShare[]> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/secrets/${secretId}/shares`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new ApiError(
      errorData.message || "Failed to fetch shares",
      response.status,
      errorData.errors
    );
  }

  const data = await response.json().catch(() => ({ data: [] }));
  if (!data.data) {
    throw new ApiError("Failed to parse shares response", response.status);
  }
  return data.data;
}

/**
 * Create a new share (grant access to user or role)
 *
 * @param secretId - Secret UUID
 * @param request - Share creation data
 * @returns Created share
 * @throws ApiError if request fails
 *
 * @example
 * ```ts
 * const share = await createShare("019a9b50-secret-id", {
 *   user_id: "019a9b50-user-id",
 *   permission: "read",
 *   expires_at: "2025-12-31T23:59:59Z"
 * });
 * ```
 */
export async function createShare(
  secretId: string,
  request: CreateShareRequest
): Promise<SecretShare> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/secrets/${secretId}/shares`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new ApiError(
      errorData.message || "Failed to create share",
      response.status,
      errorData.errors
    );
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new ApiError("Failed to parse share response", response.status);
  }
  return data.data;
}

/**
 * Revoke a share (remove access)
 *
 * @param secretId - Secret UUID
 * @param shareId - Share UUID
 * @throws ApiError if request fails
 *
 * @example
 * ```ts
 * await revokeShare("019a9b50-secret-id", "019a9b50-share-id");
 * ```
 */
export async function revokeShare(
  secretId: string,
  shareId: string
): Promise<void> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/secrets/${secretId}/shares/${shareId}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new ApiError(
      errorData.message || "Failed to revoke share",
      response.status,
      errorData.errors
    );
  }
}
