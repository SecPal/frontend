// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig, getAuthHeaders } from "../config";
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
  const response = await fetch(
    `${apiConfig.baseUrl}/v1/secrets/${secretId}/shares`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
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

  const data = await response.json();
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
  const response = await fetch(
    `${apiConfig.baseUrl}/v1/secrets/${secretId}/shares`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
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

  const data = await response.json();
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
  const response = await fetch(
    `${apiConfig.baseUrl}/v1/secrets/${secretId}/shares/${shareId}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
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
