// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/react/macro";
import {
  ArrowDownTrayIcon,
  TrashIcon,
  EyeIcon,
  DocumentIcon,
  DocumentTextIcon,
  PhotoIcon,
  FilmIcon,
  MusicalNoteIcon,
} from "@heroicons/react/24/outline";
import { Button } from "./button";
import type { SecretAttachment } from "../services/secretApi";

/**
 * AttachmentList Component Props
 */
export interface AttachmentListProps {
  /** Array of attachments to display */
  attachments: SecretAttachment[];
  /** Secret's master key for decryption */
  masterKey: CryptoKey;
  /** Callback when download button is clicked */
  onDownload: (
    attachmentId: string,
    masterKey: CryptoKey
  ) => void | Promise<void>;
  /** Callback when delete button is clicked */
  onDelete: (attachmentId: string) => void | Promise<void>;
  /** Callback when preview button is clicked */
  onPreview: (
    attachmentId: string,
    masterKey: CryptoKey
  ) => void | Promise<void>;
  /** Loading state (disables all buttons) */
  isLoading?: boolean;
}

/**
 * Format file size in human-readable format (B, KB, MB, GB)
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);

  return `${size.toFixed(1)} ${units[i]}`;
}

/**
 * Check if file MIME type is previewable in browser
 */
function isPreviewable(mimeType: string): boolean {
  return (
    mimeType.startsWith("image/") ||
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/")
  );
}

/**
 * Get appropriate icon for file MIME type
 */
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return PhotoIcon;
  }
  if (mimeType.startsWith("video/")) {
    return FilmIcon;
  }
  if (mimeType.startsWith("audio/")) {
    return MusicalNoteIcon;
  }
  if (mimeType === "application/pdf") {
    return DocumentTextIcon;
  }
  return DocumentIcon;
}

/**
 * AttachmentList Component
 *
 * Displays a list of encrypted file attachments with actions to download, preview, and delete.
 *
 * Features:
 * - Download encrypted files (triggers decryption)
 * - Preview images and PDFs
 * - Delete attachments with confirmation
 * - File icons based on MIME type
 * - Human-readable file sizes
 * - Loading states
 *
 * @example
 * ```tsx
 * <AttachmentList
 *   attachments={attachments}
 *   masterKey={secretMasterKey}
 *   onDownload={(id, key) => downloadAndDecrypt(id, key)}
 *   onDelete={(id) => deleteAttachment(id)}
 *   onPreview={(id, key) => showPreview(id, key)}
 * />
 * ```
 */
export function AttachmentList({
  attachments,
  masterKey,
  onDownload,
  onDelete,
  onPreview,
  isLoading = false,
}: AttachmentListProps) {
  if (attachments.length === 0) {
    return (
      <div className="text-center py-12">
        <DocumentIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600" />
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          <Trans>No attachments yet</Trans>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {isLoading && (
        <div role="status" className="mb-4">
          <span className="sr-only">
            <Trans>Loading attachments...</Trans>
          </span>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              <Trans>Loading...</Trans>
            </span>
          </div>
        </div>
      )}

      {attachments.map((attachment) => {
        const Icon = getFileIcon(attachment.mime_type);
        const canPreview = isPreviewable(attachment.mime_type);

        return (
          <div
            key={attachment.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:shadow-md transition-shadow"
          >
            {/* File Icon & Info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Icon
                className="h-8 w-8 flex-shrink-0 text-gray-400 dark:text-gray-500"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {attachment.filename}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatFileSize(attachment.size)}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {canPreview && (
                <Button
                  type="button"
                  color="zinc"
                  onClick={() => onPreview(attachment.id, masterKey)}
                  disabled={isLoading}
                  aria-label={`Preview ${attachment.filename}`}
                  title="Preview"
                >
                  <EyeIcon className="h-4 w-4" />
                  <span className="sr-only">
                    <Trans>Preview</Trans>
                  </span>
                </Button>
              )}

              <Button
                type="button"
                color="zinc"
                onClick={() => onDownload(attachment.id, masterKey)}
                disabled={isLoading}
                aria-label={`Download ${attachment.filename}`}
                title="Download"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                <span className="sr-only">
                  <Trans>Download</Trans>
                </span>
              </Button>

              <Button
                type="button"
                color="red"
                onClick={() => onDelete(attachment.id)}
                disabled={isLoading}
                aria-label={`Delete ${attachment.filename}`}
                title="Delete"
              >
                <TrashIcon className="h-4 w-4" />
                <span className="sr-only">
                  <Trans>Delete</Trans>
                </span>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
