// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig, getAuthHeaders } from "../config";
import { fetchWithCsrf } from "./csrf";

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
  attachment_count?: number;
  is_shared?: boolean;
}

/**
 * Extended Secret with additional details (used in detail view)
 */
export interface SecretDetail extends Secret {
  password?: string;
  owner?: {
    id: string;
    name: string;
  };
  attachments?: SecretAttachment[];
  shares?: SecretShare[];
}

/**
 * Secret Share information
 */
export interface SecretShare {
  id: string;
  user?: {
    id: string;
    name: string;
  };
  role?: {
    id: string;
    name: string;
  };
  permission: "read" | "write" | "admin";
  granted_by: {
    id: string;
    name: string;
  };
  granted_at: string;
  expires_at?: string;
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
  const response = await fetch(`${apiConfig.baseUrl}/v1/secrets`, {
    method: "GET",
    credentials: "include",
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
 * Fetch a single secret by ID with full details
 *
 * @param secretId - Secret ID
 * @returns Secret with full details including password, attachments, and shares
 * @throws ApiError if request fails or secret not found (404)
 *
 * @example
 * ```ts
 * const secret = await getSecretById('secret-123');
 * console.log(`Secret: ${secret.title} (${secret.attachment_count} attachments)`);
 * ```
 */
export async function getSecretById(secretId: string): Promise<SecretDetail> {
  if (!secretId || secretId.trim() === "") {
    throw new Error("secretId is required");
  }

  const response = await fetch(`${apiConfig.baseUrl}/v1/secrets/${secretId}`, {
    method: "GET",
    credentials: "include",
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

  const result: ApiResponse<SecretDetail> = await response.json();
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

  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/secrets/${secretId}/attachments`,
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

  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/secrets/${secretId}/attachments`,
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
  if (!secretId || secretId.trim() === "") {
    throw new Error("secretId is required");
  }

  const response = await fetch(
    `${apiConfig.baseUrl}/v1/secrets/${secretId}/attachments`,
    {
      method: "GET",
      credentials: "include",
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

  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/attachments/${attachmentId}`,
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

  const response = await fetch(`${apiConfig.baseUrl}/v1/secrets/${secretId}`, {
    method: "GET",
    credentials: "include",
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

/**
 * Download encrypted attachment response from backend
 */
export interface EncryptedAttachmentResponse {
  encryptedBlob: string; // Base64-encoded encrypted file data
  metadata: FileMetadata;
}

/**
 * Download and decrypt an encrypted attachment
 *
 * Downloads an encrypted file blob from the backend and decrypts it client-side.
 * Verifies file integrity using SHA-256 checksums before returning the decrypted file.
 *
 * @param attachmentId - Attachment ID to download
 * @param secretKey - Secret's master key for decryption
 * @returns Promise resolving to decrypted File object with original filename and MIME type
 * @throws ApiError if download fails
 * @throws Error if decryption fails or checksum verification fails
 *
 * @example
 * ```ts
 * const masterKey = await getSecretMasterKey('secret-123');
 * const file = await downloadAndDecryptAttachment('attachment-456', masterKey);
 * console.log(`Downloaded: ${file.name} (${file.size} bytes)`);
 * ```
 */
export async function downloadAndDecryptAttachment(
  attachmentId: string,
  secretKey: CryptoKey
): Promise<File> {
  if (!attachmentId || attachmentId.trim() === "") {
    throw new Error("attachmentId is required");
  }

  // 1. Download encrypted blob + metadata from backend
  const response = await fetch(
    `${apiConfig.baseUrl}/v1/attachments/${attachmentId}/download`,
    {
      method: "GET",
      credentials: "include",
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    const error: ApiErrorResponse = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new ApiError(error.message, response.status, error.errors);
  }

  const { encryptedBlob, metadata }: EncryptedAttachmentResponse =
    await response.json();

  // 2. Decode Base64 encrypted blob
  const encryptedBytes = Uint8Array.from(atob(encryptedBlob), (c) =>
    c.charCodeAt(0)
  );

  // 3. Parse encrypted blob (IV + AuthTag + Ciphertext)
  // Format: [12 bytes IV][16 bytes AuthTag][... Ciphertext]
  if (encryptedBytes.length < 28) {
    throw new Error(
      "Invalid encrypted blob: too short (expected at least IV + AuthTag)"
    );
  }

  const iv = encryptedBytes.slice(0, 12); // 96 bits
  const authTag = encryptedBytes.slice(12, 28); // 128 bits
  const ciphertext = encryptedBytes.slice(28); // Rest is ciphertext

  // 4. Derive file key (same as encryption)
  const { deriveFileKey, decryptFile } = await import(
    "../lib/crypto/encryption"
  );
  const fileKey = await deriveFileKey(secretKey, metadata.filename);

  // 5. Decrypt file
  const decryptedData = await decryptFile(ciphertext, fileKey, iv, authTag);

  // 6. Verify checksum (integrity check)
  const { calculateChecksum } = await import("../lib/crypto/checksum");
  const actualChecksum = await calculateChecksum(decryptedData);

  if (actualChecksum !== metadata.checksum) {
    // Only expose checksum details in development for debugging
    if (import.meta.env.DEV) {
      console.error(
        `Checksum mismatch: expected ${metadata.checksum}, got ${actualChecksum}`
      );
    }
    throw new Error(
      "Checksum verification failed: file may be corrupted or tampered"
    );
  }

  // 7. Restore original filename and MIME type
  // Use .buffer.slice() to create a new ArrayBuffer with exact size
  // (decryptedData is a fresh Uint8Array from Web Crypto, so buffer is already exact size)
  return new File(
    [decryptedData.buffer.slice(0, decryptedData.byteLength) as ArrayBuffer],
    metadata.filename,
    {
      type: metadata.type,
    }
  );
}

/**
 * Request/Response types for Create/Update operations
 */
export interface CreateSecretRequest {
  title: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  tags?: string[];
  expires_at?: string;
}

export interface UpdateSecretRequest {
  title?: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  tags?: string[];
  expires_at?: string;
}

/**
 * Create a new secret
 *
 * @param data - Secret data (title is required)
 * @returns Created secret with full details
 * @throws ApiError if request fails (400, 401, 403, 422)
 *
 * @example
 * ```ts
 * const secret = await createSecret({
 *   title: 'Gmail Account',
 *   username: 'user@example.com',
 *   password: 'super-secret',
 *   tags: ['work', 'email'],
 *   expires_at: '2025-12-31T23:59:59Z'
 * });
 * console.log(`Created secret: ${secret.id}`);
 * ```
 */
export async function createSecret(
  data: CreateSecretRequest
): Promise<SecretDetail> {
  if (!data.title || data.title.trim() === "") {
    throw new Error("title is required");
  }

  const response = await fetchWithCsrf(`${apiConfig.baseUrl}/v1/secrets`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error: ApiErrorResponse = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new ApiError(error.message, response.status, error.errors);
  }

  const result: ApiResponse<SecretDetail> = await response.json();
  return result.data;
}

/**
 * Update an existing secret
 *
 * @param secretId - Secret ID to update
 * @param data - Fields to update (only provided fields will be updated)
 * @returns Updated secret with full details
 * @throws ApiError if request fails (400, 401, 403, 404, 422)
 *
 * @example
 * ```ts
 * const secret = await updateSecret('secret-123', {
 *   title: 'Updated Title',
 *   password: 'new-password'
 * });
 * console.log(`Updated secret: ${secret.title}`);
 * ```
 */
export async function updateSecret(
  secretId: string,
  data: UpdateSecretRequest
): Promise<SecretDetail> {
  if (!secretId || secretId.trim() === "") {
    throw new Error("secretId is required");
  }

  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/secrets/${secretId}`,
    {
      method: "PATCH",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error: ApiErrorResponse = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new ApiError(error.message, response.status, error.errors);
  }

  const result: ApiResponse<SecretDetail> = await response.json();
  return result.data;
}

/**
 * Delete a secret (soft delete)
 *
 * @param secretId - Secret ID to delete
 * @throws ApiError if request fails (401, 403, 404)
 *
 * @example
 * ```ts
 * await deleteSecret('secret-123');
 * console.log('Secret deleted');
 * ```
 */
export async function deleteSecret(secretId: string): Promise<void> {
  if (!secretId || secretId.trim() === "") {
    throw new Error("secretId is required");
  }

  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/secrets/${secretId}`,
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
