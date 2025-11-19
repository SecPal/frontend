// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig, getAuthHeaders } from "../config";

/**
 * Secret API Response Types
 */
export interface Secret {
  id: string;
  title: string;
  username?: string;
  url?: string;
  notes?: string;
  tags?: string[];
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SecretAttachment {
  id: string;
  filename: string;
  size: number;
  mime_type: string;
  created_at: string;
}

export interface ApiResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  message: string;
  errors?: Record<string, string[]>;
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
 * Fetch secrets list for user
 *
 * @returns Array of secrets
 * @throws ApiError if request fails
 *
 * @example
 * ```ts
 * const secrets = await fetchSecrets();
 * console.log(`Found ${secrets.length} secrets`);
 * ```
 */
export async function fetchSecrets(): Promise<Secret[]> {
  const response = await fetch(`${apiConfig.baseUrl}/api/v1/secrets`, {
    method: "GET",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error: ApiErrorResponse = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new ApiError(error.message, response.status, error.errors);
  }

  const result: ApiResponse<Secret[]> = await response.json();
  return result.data;
}

/**
 * Upload file attachment to secret
 *
 * @param secretId - Target secret ID
 * @param file - File to upload
 * @returns Uploaded attachment metadata
 * @throws ApiError if upload fails
 *
 * @example
 * ```ts
 * const attachment = await uploadAttachment('secret-123', file);
 * console.log(`Uploaded: ${attachment.filename} (${attachment.size} bytes)`);
 * ```
 */
export async function uploadAttachment(
  secretId: string,
  file: File
): Promise<SecretAttachment> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${apiConfig.baseUrl}/api/v1/secrets/${secretId}/attachments`,
    {
      method: "POST",
      headers: getAuthHeaders(), // Don't set Content-Type for FormData
      body: formData,
    }
  );

  if (!response.ok) {
    const error: ApiErrorResponse = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new ApiError(error.message, response.status, error.errors);
  }

  const result: ApiResponse<SecretAttachment> = await response.json();
  return result.data;
}

/**
 * List attachments for a secret
 *
 * @param secretId - Secret ID
 * @returns Array of attachments
 * @throws ApiError if request fails
 *
 * @example
 * ```ts
 * const attachments = await listAttachments('secret-123');
 * console.log(`Secret has ${attachments.length} attachments`);
 * ```
 */
export async function listAttachments(
  secretId: string
): Promise<SecretAttachment[]> {
  const response = await fetch(
    `${apiConfig.baseUrl}/api/v1/secrets/${secretId}/attachments`,
    {
      method: "GET",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error: ApiErrorResponse = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new ApiError(error.message, response.status, error.errors);
  }

  const result: ApiResponse<SecretAttachment[]> = await response.json();
  return result.data;
}

/**
 * Delete an attachment
 *
 * @param attachmentId - Attachment ID to delete
 * @throws ApiError if deletion fails
 *
 * @example
 * ```ts
 * await deleteAttachment('attachment-456');
 * console.log('Attachment deleted');
 * ```
 */
export async function deleteAttachment(attachmentId: string): Promise<void> {
  const response = await fetch(
    `${apiConfig.baseUrl}/api/v1/attachments/${attachmentId}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    const error: ApiErrorResponse = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new ApiError(error.message, response.status, error.errors);
  }
}
