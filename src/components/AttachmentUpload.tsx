// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Trans } from "@lingui/macro";
import { CloudArrowUpIcon } from "@heroicons/react/24/outline";
import { Button } from "./button";

/**
 * AttachmentUpload Component Props
 */
export interface AttachmentUploadProps {
  /** Callback when file is selected/dropped */
  onUpload: (file: File) => void | Promise<void>;
  /** Callback when validation error occurs */
  onError?: (error: string) => void;
  /** Loading state during upload */
  isUploading?: boolean;
  /** Upload progress (0-100) */
  uploadProgress?: number;
}

/**
 * Allowed MIME types for file uploads
 */
const ALLOWED_MIME_TYPES = [
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // PDFs
  "application/pdf",
  // Documents
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/json",
  "application/xml",
  "text/xml",
];

/**
 * Maximum file size in bytes (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Validate file type
 */
function isValidFileType(file: File): boolean {
  return ALLOWED_MIME_TYPES.includes(file.type);
}

/**
 * Validate file size
 */
function isValidFileSize(file: File): boolean {
  return file.size <= MAX_FILE_SIZE;
}

/**
 * AttachmentUpload Component
 *
 * Drag-and-drop file upload zone with file picker fallback.
 * Validates file types and sizes before triggering upload callback.
 *
 * Features:
 * - Drag-and-drop support
 * - File picker button
 * - File type validation (images, PDFs, documents)
 * - File size validation (max 10MB)
 * - Upload progress indicator
 * - Keyboard accessible
 *
 * @example
 * ```tsx
 * <AttachmentUpload
 *   onUpload={(file) => handleUpload(file)}
 *   onError={(error) => showError(error)}
 *   isUploading={uploading}
 *   uploadProgress={50}
 * />
 * ```
 */
export function AttachmentUpload({
  onUpload,
  onError,
  isUploading = false,
  uploadProgress = 0,
}: AttachmentUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle file selection from input or drag-and-drop
   */
  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Process each file
    Array.from(files).forEach((file) => {
      // Validate file type
      if (!isValidFileType(file)) {
        onError?.(
          `Invalid file type: ${file.name}. Only images, PDFs, and documents are allowed.`
        );
        return;
      }

      // Validate file size
      if (!isValidFileSize(file)) {
        onError?.(`File too large: ${file.name}. Maximum size is 10MB.`);
        return;
      }

      // File is valid, trigger upload callback
      onUpload(file);
    });
  };

  /**
   * Handle file input change
   */
  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /**
   * Handle drag over event
   */
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  /**
   * Handle drag leave event
   */
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  /**
   * Handle drop event
   */
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  /**
   * Trigger file picker
   */
  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Drag-and-drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative rounded-lg border-2 border-dashed p-8 text-center
          transition-colors duration-200
          ${
            isDragOver
              ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20"
              : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
          }
          ${
            isUploading
              ? "pointer-events-none opacity-50"
              : "hover:border-zinc-400 dark:hover:border-zinc-600"
          }
        `}
      >
        {/* Icon */}
        <CloudArrowUpIcon className="mx-auto h-12 w-12 text-zinc-400 dark:text-zinc-500" />

        {/* Main text */}
        <p className="mt-4 text-sm font-medium text-zinc-900 dark:text-white">
          {isUploading ? (
            <Trans>Uploading...</Trans>
          ) : (
            <Trans>Drag files here or click to browse</Trans>
          )}
        </p>

        {/* Hint text */}
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          <Trans>Supported: Images, PDFs, Documents (max 10MB)</Trans>
        </p>

        {/* Browse button */}
        {!isUploading && (
          <Button
            type="button"
            onClick={handleBrowseClick}
            className="mt-4"
            disabled={isUploading}
          >
            <Trans>Select Files</Trans>
          </Button>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          disabled={isUploading}
          aria-label="Select files to upload"
          tabIndex={0}
          className="sr-only"
          accept={ALLOWED_MIME_TYPES.join(",")}
        />
      </div>

      {/* Progress bar */}
      {isUploading && uploadProgress !== undefined && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">
              <Trans>Uploading...</Trans>
            </span>
            <span className="text-zinc-600 dark:text-zinc-400">
              {uploadProgress}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={uploadProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-300 dark:bg-blue-500"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
