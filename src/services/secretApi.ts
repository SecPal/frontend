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

export interface FileMetadata {
  filename: string;
  type: string;
  size: number;
  encryptedSize: number;
  checksum: string;
  checksumEncrypted: string;
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
  if (!secretId || secretId.trim() === "") {
    throw new Error("secretId is required");
  }
  if (!file || typeof file !== "object" || file.size === 0) {
    throw new Error("file must be a non-empty File object");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${apiConfig.baseUrl}/api/v1/secrets/${secretId}/attachments`,
    {
      method: "POST",
      credentials: "include",
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
 * Upload encrypted file attachment to secret
 *
 * Uploads an already-encrypted blob with metadata including checksums.
 * This is used for zero-knowledge client-side encryption (Phase 3).
 *
 * @param secretId - Target secret ID
 * @param encryptedBlob - Encrypted file blob (IV + AuthTag + Ciphertext)
 * @param metadata - File metadata including original filename and checksums
 * @returns Uploaded attachment metadata
 * @throws ApiError if upload fails
 *
 * @example
 * ```ts
 * const encryptedBlob = await encryptFile(file, fileKey);
 * const metadata = {
 *   filename: 'document.pdf',
 *   type: 'application/pdf',
 *   size: 1024,
 *   encryptedSize: 1152,
 *   checksum: 'abc123...',
 *   checksumEncrypted: 'def456...'
 * };
 * const attachment = await uploadEncryptedAttachment('secret-123', encryptedBlob, metadata);
 * ```
 */
export async function uploadEncryptedAttachment(
  secretId: string,
  encryptedBlob: Blob,
  metadata: FileMetadata
): Promise<SecretAttachment> {
  if (!secretId || secretId.trim() === "") {
    throw new Error("secretId is required");
  }
  if (!encryptedBlob || encryptedBlob.size === 0) {
    throw new Error("encryptedBlob must be a non-empty Blob");
  }

  const formData = new FormData();
  formData.append("file", encryptedBlob, "encrypted.bin");
  formData.append("metadata", JSON.stringify(metadata));

  const response = await fetch(
    `${apiConfig.baseUrl}/api/v1/secrets/${secretId}/attachments`,
    {
      method: "POST",
      credentials: "include",
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
  if (!secretId || secretId.trim() === "") {
    throw new Error("secretId is required");
  }

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
  if (!attachmentId || attachmentId.trim() === "") {
    throw new Error("attachmentId is required");
  }

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

/**
 * Get the master key for a secret
 *
 * @param secretId - Secret ID
 * @returns CryptoKey for encryption/decryption
 * @throws ApiError if request fails
 *
 * @example
 * ```ts
 * const masterKey = await getSecretMasterKey('secret-123');
 * // Use masterKey for file encryption
 * ```
 */
export async function getSecretMasterKey(secretId: string): Promise<CryptoKey> {
  if (!secretId || secretId.trim() === "") {
    throw new Error("secretId is required");
  }

  const response = await fetch(
    `${apiConfig.baseUrl}/api/v1/secrets/${secretId}`,
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

  const result: ApiResponse<Secret & { master_key: string }> =
    await response.json();

  // The master_key is Base64-encoded
  const masterKeyBase64 = result.data.master_key;
  if (!masterKeyBase64) {
    throw new Error("Secret has no master key");
  }

  // Decode Base64 to ArrayBuffer
  const bytes = Uint8Array.from(atob(masterKeyBase64), (c) => c.charCodeAt(0));

  // Import as CryptoKey (extractable needed for deriveFileKey)
  const key = await crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  return key;
}
