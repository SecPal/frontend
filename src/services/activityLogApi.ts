// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig } from "../config";
import { apiFetch } from "./csrf";

/**
 * Activity Log API Response Types
 */
export interface Activity {
  id: string;
  tenant_id: string;
  organizational_unit_id: string | null;
  log_name: string;
  description: string;
  subject_type: string | null;
  subject_id: string | null;
  subject: {
    id: string;
    name?: string;
    type?: string;
  } | null;
  causer_type: string | null;
  causer_id: string | null;
  causer: {
    id: string;
    name?: string;
    email?: string;
  } | null;
  properties: Record<string, unknown> | null;
  event_hash: string;
  previous_hash: string | null;
  merkle_root: string | null;
  merkle_batch_id: string | null;
  merkle_proof: string | null;
  opentimestamp_proof: string | null;
  opentimestamp_merkle_root: string | null;
  opentimestamp_proof_confirmed: boolean;
  ots_confirmed_at: string | null;
  is_orphaned_genesis: boolean;
  orphaned_reason: string | null;
  orphaned_at: string | null;
  created_at: string;
  updated_at: string;
  organizational_unit: {
    id: string;
    name: string;
    unit_type: string;
  } | null;
  // Verification data (optional, included when include_verification=1)
  verification?: {
    chain_valid: boolean | null;
    chain_link_valid: boolean | null;
    merkle_valid: boolean | null;
    ots_valid: boolean | null;
  };
}

/**
 * Activity Log Detail with verification information
 */
export interface ActivityDetail extends Activity {
  verification?: {
    chain_valid: boolean | null;
    chain_link_valid: boolean | null;
    merkle_valid: boolean | null;
    ots_valid: boolean | null;
  };
}

/**
 * Verification result for an activity
 */
export interface ActivityVerification {
  activity_id: string;
  verification: {
    chain_valid: boolean | null;
    chain_link_valid: boolean | null;
    merkle_valid: boolean | null;
    ots_valid: boolean | null;
  };
  details: {
    event_hash: string;
    previous_hash: string | null;
    merkle_root: string | null;
    merkle_batch_id: string | null;
    ots_confirmed_at: string | null;
    is_orphaned_genesis: boolean;
    orphaned_reason: string | null;
  };
}

/**
 * Activity Log filters
 */
export interface ActivityFilters {
  page?: number;
  per_page?: number;
  from_date?: string;
  to_date?: string;
  log_name?: string;
  search?: string;
  organizational_unit_id?: string;
  causer_type?: string;
  causer_id?: string;
  subject_type?: string;
  subject_id?: string;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
}

/**
 * Single item API response
 */
export interface ApiResponse<T> {
  data: T;
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Fetch paginated activity logs with optional filters
 *
 * @param filters - Optional filters for activity logs
 * @returns Paginated list of activity logs
 * @throws ApiError if the request fails
 *
 * @example
 * ```typescript
 * const response = await fetchActivityLogs({
 *   page: 1,
 *   per_page: 50,
 *   from_date: '2025-12-01',
 *   log_name: 'default',
 *   search: 'employee',
 * });
 * ```
 */
export async function fetchActivityLogs(
  filters: ActivityFilters = {}
): Promise<PaginatedResponse<Activity>> {
  const params = new URLSearchParams();

  // Add pagination parameters
  if (filters.page) params.append("page", filters.page.toString());
  if (filters.per_page) params.append("per_page", filters.per_page.toString());

  // Add filter parameters
  if (filters.from_date) params.append("from_date", filters.from_date);
  if (filters.to_date) params.append("to_date", filters.to_date);
  if (filters.log_name) params.append("log_name", filters.log_name);
  if (filters.search) params.append("search", filters.search);
  if (filters.organizational_unit_id)
    params.append("organizational_unit_id", filters.organizational_unit_id);
  if (filters.causer_type) params.append("causer_type", filters.causer_type);
  if (filters.causer_id) params.append("causer_id", filters.causer_id);
  if (filters.subject_type) params.append("subject_type", filters.subject_type);
  if (filters.subject_id) params.append("subject_id", filters.subject_id);

  // Include verification data for displaying badges in list
  params.append("include_verification", "1");

  const queryString = params.toString();
  const url = `${apiConfig.baseUrl}/v1/activity-logs${queryString ? `?${queryString}` : ""}`;

  const response = await apiFetch(url);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.message || "Failed to fetch activity logs",
      response.status,
      errorData.errors
    );
  }

  return response.json();
}

/**
 * Fetch a single activity log by ID
 *
 * @param id - Activity log ID
 * @returns Activity log details
 * @throws ApiError if the request fails
 *
 * @example
 * ```typescript
 * const activity = await fetchActivityLog('123e4567-e89b-12d3-a456-426614174000');
 * ```
 */
export async function fetchActivityLog(
  id: string
): Promise<ApiResponse<Activity>> {
  const url = `${apiConfig.baseUrl}/v1/activity-logs/${id}`;

  const response = await apiFetch(url);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.message || "Failed to fetch activity log",
      response.status,
      errorData.errors
    );
  }

  return response.json();
}

/**
 * Verify an activity log (hash chain, Merkle tree, OpenTimestamp)
 *
 * @param id - Activity log ID
 * @returns Verification results
 * @throws ApiError if the request fails
 *
 * @example
 * ```typescript
 * const verification = await verifyActivityLog('123e4567-e89b-12d3-a456-426614174000');
 * if (verification.verification.chain_valid) {
 *   console.log('Hash chain is valid');
 * }
 * ```
 */
export async function verifyActivityLog(
  id: string
): Promise<ApiResponse<ActivityVerification>> {
  const url = `${apiConfig.baseUrl}/v1/activity-logs/${id}/verify`;

  const response = await apiFetch(url);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.message || "Failed to verify activity log",
      response.status,
      errorData.errors
    );
  }

  return response.json();
}
