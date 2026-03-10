// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState, useRef } from "react";
import { Trans } from "@lingui/macro";
import { Heading } from "../components/heading";
import { Text } from "../components/text";
import { Button } from "../components/button";
import { Badge } from "../components/badge";
import { EncryptionProgress } from "../components/EncryptionProgress";
import {
  fetchSecrets,
  getSecretMasterKey,
  type Secret,
} from "../services/secretApi";
import { addFileToQueue, processEncryptedFileQueue } from "../lib/fileQueue";
import { encryptFile, deriveFileKey } from "../lib/crypto/encryption";
import { calculateChecksum } from "../lib/crypto/checksum";
import { db } from "../lib/db";

interface SharedFile {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  file?: File;
}

interface SharedData {
  title?: string;
  text?: string;
  url?: string;
  files?: SharedFile[];
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/*",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/**
 * Validates data URL to prevent XSS attacks.
 * Only allows data URLs with safe image MIME types.
 * @returns The data URL if valid, null otherwise
 */
function sanitizeDataUrl(dataUrl: string | undefined): string | null {
  if (!dataUrl || !dataUrl.startsWith("data:")) return null;

  // Only allow image data URLs
  const allowedImageTypes = [
    "data:image/jpeg",
    "data:image/jpg",
    "data:image/png",
    "data:image/gif",
    "data:image/webp",
  ];

  const isAllowed = allowedImageTypes.some((type) =>
    dataUrl.toLowerCase().startsWith(type)
  );

  return isAllowed ? dataUrl : null;
}

function isFileTypeAllowed(fileType: string): boolean {
  return ALLOWED_TYPES.some((allowed) => {
    if (allowed.endsWith("/*")) {
      const prefix = allowed.slice(0, -2);
      return fileType.startsWith(prefix);
    }
    // Exact match only for specific MIME types
    return fileType === allowed;
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validates and sanitizes URLs to prevent XSS and open redirect attacks.
 * Only allows http and https protocols AND validates domain is not suspicious.
 * @returns The sanitized URL or null if invalid
 */
function sanitizeUrl(url: string | undefined): string | null {
  if (!url || url.trim() === "") return null;

  try {
    const parsed = new URL(url);
    // Only allow http and https protocols to prevent javascript:, data:, etc.
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    // Additional validation: Reject URLs with credentials
    if (parsed.username || parsed.password) {
      return null;
    }

    return parsed.toString();
  } catch {
    // Invalid URL format
    return null;
  }
}

function getShareTextDataFromUrl(): Omit<SharedData, "files"> {
  const url = new URL(window.location.href);

  return {
    title: url.searchParams.get("title") || undefined,
    text: url.searchParams.get("text") || undefined,
    url: url.searchParams.get("url") || undefined,
  };
}

function buildShareDataFromUrl(files?: SharedFile[]): SharedData | null {
  const { title, text, url } = getShareTextDataFromUrl();

  const hasContent =
    (title && title !== "") ||
    (text && text !== "") ||
    (url && url !== "") ||
    (files && files.length > 0);

  if (!hasContent) {
    return null;
  }

  return {
    title: title || undefined,
    text: text || undefined,
    url: url || undefined,
    files: files && files.length > 0 ? files : undefined,
  };
}

function normalizeSharedFiles(
  files: unknown,
  newErrors: string[]
): SharedFile[] {
  if (!Array.isArray(files)) {
    newErrors.push("Invalid files format");
    return [];
  }

  return files.filter((file): file is SharedFile => {
    if (
      typeof file !== "object" ||
      file === null ||
      typeof file.name !== "string" ||
      typeof file.type !== "string" ||
      typeof file.size !== "number"
    ) {
      newErrors.push("Invalid file data structure");
      return false;
    }

    if (file.dataUrl !== undefined && typeof file.dataUrl !== "string") {
      newErrors.push("Invalid file data structure");
      return false;
    }

    if (file.file !== undefined && !(file.file instanceof File)) {
      newErrors.push("Invalid file data structure");
      return false;
    }

    if (!isFileTypeAllowed(file.type)) {
      newErrors.push(
        `Invalid file type: ${file.name} (${file.type}) is not supported`
      );
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      newErrors.push(
        `File too large: ${file.name} (${formatFileSize(file.size)}). Maximum 10MB allowed.`
      );
      return false;
    }

    return true;
  });
}

function isAllowedLocalFileUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.protocol === "data:" || parsed.protocol === "blob:";
  } catch {
    return false;
  }
}

async function readSharedFileBytes(file: SharedFile): Promise<Uint8Array> {
  if (file.file) {
    return new Uint8Array(await file.file.arrayBuffer());
  }

  if (!file.dataUrl) {
    throw new Error(`File ${file.name} has no data URL`);
  }

  if (!isAllowedLocalFileUrl(file.dataUrl)) {
    throw new Error(
      `File ${file.name} has an invalid local file URL and cannot be uploaded`
    );
  }

  const response = await fetch(file.dataUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file data for ${file.name}`);
  }

  const blob = await response.blob();
  return new Uint8Array(await blob.arrayBuffer());
}

export function ShareTarget() {
  const [shareTextData] = useState<Omit<SharedData, "files">>(() =>
    getShareTextDataFromUrl()
  );

  // Parse initial data once using lazy initialization
  const [sharedData, setSharedData] = useState<SharedData | null>(() => {
    const filesJson = sessionStorage.getItem("share-target-files");
    let files: SharedFile[] | undefined;
    const newErrors: string[] = [];

    if (filesJson) {
      try {
        files = normalizeSharedFiles(JSON.parse(filesJson), newErrors);
      } catch (error) {
        // Log parsing errors for debugging
        console.error("Failed to parse shared files during init:", error);
      }
    }

    return buildShareDataFromUrl(files);
  });

  const [errors, setErrors] = useState<string[]>(() => {
    const newErrors: string[] = [];
    const filesJson = sessionStorage.getItem("share-target-files");

    if (filesJson) {
      try {
        normalizeSharedFiles(JSON.parse(filesJson), newErrors);
      } catch {
        newErrors.push("Failed to load shared files");
      }
    }

    return newErrors;
  });

  const [shareId] = useState<string | null>(() => {
    const url = new URL(window.location.href);
    return url.searchParams.get("share_id");
  });

  // Upload state
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loadingSecrets, setLoadingSecrets] = useState(false);
  const [selectedSecretId, setSelectedSecretId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [secretsLoadError, setSecretsLoadError] = useState<string | null>(null);
  const clearTimeoutRef = useRef<number | null>(null);

  // Encryption state
  const [encryptionProgress, setEncryptionProgress] = useState<
    Map<string, number>
  >(new Map());
  const [isEncrypting, setIsEncrypting] = useState(false);

  // Load secrets on mount
  useEffect(() => {
    const loadSecrets = async () => {
      setLoadingSecrets(true);
      setSecretsLoadError(null);
      try {
        const loadedSecrets = await fetchSecrets();
        setSecrets(loadedSecrets);
      } catch (error) {
        console.error("Failed to load secrets:", error);
        setSecretsLoadError("Failed to load secrets");
      } finally {
        setLoadingSecrets(false);
      }
    };

    // Only load if we have files to upload
    if (sharedData?.files && sharedData.files.length > 0) {
      void loadSecrets();
    }
  }, [sharedData?.files]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (clearTimeoutRef.current !== null) {
        clearTimeout(clearTimeoutRef.current);
      }
    };
  }, []);

  // Clean up URL parameters on mount
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.size > 0 && window.history?.replaceState) {
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // Service Worker message handler
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) {
        return;
      }

      const { type, shareId: messageShareId } = event.data;

      if (shareId && messageShareId && shareId !== messageShareId) {
        return;
      }

      if (type === "SHARE_TARGET_FILES") {
        const newErrors: string[] = [];
        const files = normalizeSharedFiles(event.data.files, newErrors);

        setSharedData((current) => {
          const nextData: SharedData = {
            ...(current ?? shareTextData),
            ...shareTextData,
            files: files.length > 0 ? files : undefined,
          };

          if (
            !nextData.title &&
            !nextData.text &&
            !nextData.url &&
            !nextData.files
          ) {
            return null;
          }

          return nextData;
        });

        if (newErrors.length > 0) {
          setErrors((current) => [...current, ...newErrors]);
        }
      } else if (type === "SHARE_TARGET_ERROR") {
        setErrors((current) => [
          ...current,
          event.data.error || "Unknown error processing shared content",
        ]);
      }
    };

    navigator.serviceWorker?.addEventListener("message", handleMessage);

    if (shareId && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "REQUEST_SHARE_TARGET_FILES",
        shareId,
      });
    }

    // Clean up event listener on unmount
    return () => {
      navigator.serviceWorker?.removeEventListener("message", handleMessage);
    };
  }, [shareId, shareTextData]);

  const handleClear = () => {
    setSharedData(null);
    setErrors([]);
    sessionStorage.removeItem("share-target-files");
    setSelectedSecretId("");
    setUploadSuccess(false);
    setUploadError(null);

    if (shareId && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "CLEAR_SHARE_TARGET_FILES",
        shareId,
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedSecretId || !sharedData?.files) return;

    setUploading(true);
    setIsEncrypting(true);
    setUploadError(null);
    setUploadSuccess(false);
    setEncryptionProgress(new Map());

    try {
      // Get master key for the secret
      const masterKey = await getSecretMasterKey(selectedSecretId);

      // Encrypt and queue all files
      for (const file of sharedData.files) {
        try {
          // Update encryption progress (0%)
          setEncryptionProgress((prev) => new Map(prev).set(file.name, 0));

          const plaintext = await readSharedFileBytes(file);

          // Update encryption progress (25%)
          setEncryptionProgress((prev) => new Map(prev).set(file.name, 25));

          // Derive file-specific key
          const fileKey = await deriveFileKey(masterKey, file.name);

          // Update encryption progress (50%)
          setEncryptionProgress((prev) => new Map(prev).set(file.name, 50));

          // Encrypt file
          const encryptedFile = await encryptFile(plaintext, fileKey);

          // Update encryption progress (75%)
          setEncryptionProgress((prev) => new Map(prev).set(file.name, 75));

          // Combine IV + authTag + ciphertext into single blob
          // Ensure type compatibility for Blob constructor
          const ivBuffer = new Uint8Array(encryptedFile.iv);
          const authTagBuffer = new Uint8Array(encryptedFile.authTag);
          const ciphertextBuffer = new Uint8Array(encryptedFile.ciphertext);

          const encryptedBlob = new Blob([
            ivBuffer,
            authTagBuffer,
            ciphertextBuffer,
          ]);

          // Calculate checksum of encrypted data
          const encryptedArrayBuffer = await encryptedBlob.arrayBuffer();
          const encryptedData = new Uint8Array(encryptedArrayBuffer);
          const checksum = await calculateChecksum(encryptedData);

          // Update encryption progress (100%)
          setEncryptionProgress((prev) => new Map(prev).set(file.name, 100));

          // Add encrypted file to queue
          const queueId = await addFileToQueue(
            encryptedBlob,
            {
              name: file.name,
              type: file.type,
              size: file.size, // Original plaintext size
              timestamp: Date.now(),
            },
            selectedSecretId
          );

          // Update queue entry with encryption state and checksum
          await db.fileQueue.update(queueId, {
            uploadState: "encrypted",
            checksum,
          });
        } catch (error) {
          console.error(`Encryption failed for ${file.name}:`, error);
          throw new Error(
            `Encryption failed for ${file.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
            { cause: error }
          );
        }
      }

      // All files encrypted successfully
      setIsEncrypting(false);

      // Process the queue (upload encrypted files)
      const stats = await processEncryptedFileQueue();

      if (stats.failed > 0) {
        setUploadError(
          `Failed to upload ${stats.failed} of ${sharedData.files.length} file(s)`
        );
      } else if (stats.total > 0 && stats.completed === stats.total) {
        setUploadSuccess(true);
        // Clear shared data after successful upload
        clearTimeoutRef.current = window.setTimeout(() => {
          handleClear();
        }, 3000);
      } else {
        // Some files are pending or skipped
        const pending = stats.pending || 0;
        const skipped = stats.skipped || 0;
        setUploadError(
          `Upload incomplete: ${stats.completed} succeeded, ${pending + skipped} pending`
        );
      }
    } catch (error) {
      console.error("Upload failed:", error);
      setIsEncrypting(false);
      setUploadError(
        error instanceof Error
          ? error.message
          : "Failed to encrypt/upload files"
      );
    } finally {
      setUploading(false);
    }
  };

  // Show errors even if no valid shared data
  if (!sharedData && errors.length === 0) {
    return (
      <div className="p-8">
        <Heading>
          <Trans>Share Target</Trans>
        </Heading>
        <Text className="mt-4">
          <Trans>No content shared</Trans>
        </Text>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Heading>
          <Trans>Shared Content</Trans>
        </Heading>
        <Button onClick={handleClear} outline>
          <Trans>Clear</Trans>
        </Button>
      </div>

      {/* Display errors */}
      {errors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <Text className="font-semibold text-red-900 mb-2">
            <Trans>Errors:</Trans>
          </Text>
          <ul className="list-disc list-inside space-y-1">
            {errors.map((error, index) => (
              <li
                key={`error-${index}-${error.slice(0, 20)}`}
                className="text-red-700 text-sm"
              >
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Display text content */}
      {sharedData &&
        (sharedData.title || sharedData.text || sharedData.url) && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            {sharedData.title && (
              <div className="mb-2">
                <Text className="font-semibold text-gray-700">
                  <Trans>Title:</Trans>
                </Text>
                <Text className="text-gray-900">{sharedData.title}</Text>
              </div>
            )}

            {sharedData.text && (
              <div className="mb-2">
                <Text className="font-semibold text-gray-700">
                  <Trans>Text:</Trans>
                </Text>
                <Text className="text-gray-900 whitespace-pre-wrap">
                  {sharedData.text}
                </Text>
              </div>
            )}

            {sharedData.url &&
              (() => {
                const sanitizedUrl = sanitizeUrl(sharedData.url);
                if (!sanitizedUrl) {
                  return (
                    <div className="mb-2">
                      <Text className="font-semibold text-gray-700">
                        <Trans>URL:</Trans>
                      </Text>
                      <Text className="text-red-600 text-sm">
                        <Trans>Invalid or unsafe URL</Trans>
                      </Text>
                    </div>
                  );
                }
                return (
                  <div className="mb-2">
                    <Text className="font-semibold text-gray-700">
                      <Trans>URL:</Trans>
                    </Text>
                    <a
                      href={sanitizedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {sanitizedUrl}
                    </a>
                  </div>
                );
              })()}
          </div>
        )}

      {/* Display shared files */}
      {sharedData && sharedData.files && sharedData.files.length > 0 && (
        <div>
          <Heading level={2} className="mb-4">
            <Trans>Attached Files</Trans> ({sharedData.files.length})
          </Heading>

          {/* Upload Section */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            {secretsLoadError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded">
                <Text className="text-red-900 font-semibold">
                  {secretsLoadError}
                </Text>
              </div>
            ) : loadingSecrets ? (
              <Text className="text-blue-900">
                <Trans>Loading secrets...</Trans>
              </Text>
            ) : (
              <>
                <div className="mb-4">
                  <label
                    htmlFor="secret-selector"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    <Trans>Select Secret to attach files:</Trans>
                  </label>
                  <select
                    id="secret-selector"
                    value={selectedSecretId}
                    onChange={(e) => setSelectedSecretId(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={uploading}
                  >
                    <option value="">
                      <Trans>-- Choose a Secret --</Trans>
                    </option>
                    {secrets.map((secret) => (
                      <option key={secret.id} value={secret.id}>
                        {secret.title}
                      </option>
                    ))}
                  </select>
                </div>

                {isEncrypting && (
                  <EncryptionProgress
                    progress={encryptionProgress}
                    isEncrypting={isEncrypting}
                  />
                )}

                {uploading && !isEncrypting && (
                  <div
                    className="mb-4 p-3 bg-blue-100 rounded"
                    role="status"
                    aria-live="polite"
                  >
                    <Text className="text-blue-900 font-semibold">
                      <Trans>Uploading...</Trans>
                    </Text>
                    <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full animate-pulse w-full"></div>
                    </div>
                  </div>
                )}

                {uploadSuccess && (
                  <div
                    className="mb-4 p-3 bg-green-50 border border-green-200 rounded"
                    role="status"
                    aria-live="polite"
                  >
                    <Text className="text-green-900 font-semibold">
                      <Trans>Successfully uploaded files!</Trans>
                    </Text>
                  </div>
                )}

                {uploadError && (
                  <div
                    className="mb-4 p-3 bg-red-50 border border-red-200 rounded"
                    role="alert"
                    aria-live="assertive"
                  >
                    <Text className="text-red-900 font-semibold">
                      {uploadError}
                    </Text>
                  </div>
                )}

                <Button
                  onClick={handleUpload}
                  disabled={!selectedSecretId || uploading || uploadSuccess}
                  className="w-full"
                >
                  <Trans>Save to Secret</Trans>
                </Button>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sharedData.files.map((file, index) => (
              <div
                key={`${file.name}-${file.size}-${index}`}
                className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                {/* Image preview */}
                {file.dataUrl &&
                  file.type.startsWith("image/") &&
                  (() => {
                    const sanitizedDataUrl = sanitizeDataUrl(file.dataUrl);
                    if (!sanitizedDataUrl) return null;

                    return (
                      <img
                        src={sanitizedDataUrl}
                        alt={file.name}
                        className="w-full h-48 object-cover rounded mb-3"
                      />
                    );
                  })()}

                {/* File info */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <Text className="font-medium text-gray-900 truncate">
                      {file.name}
                    </Text>
                    <Text className="text-sm text-gray-500">
                      {formatFileSize(file.size)}
                    </Text>
                  </div>
                  <Badge color="zinc" className="ml-2">
                    {file.type.split("/")[1]?.toUpperCase() || "FILE"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ShareTarget;
