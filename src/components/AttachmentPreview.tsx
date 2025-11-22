// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Trans } from "@lingui/macro";
import {
  XMarkIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
} from "@heroicons/react/24/outline";
import { Button } from "./button";
import { Dialog, DialogActions, DialogBody, DialogTitle } from "./dialog";

/**
 * AttachmentPreview Component Props
 */
export interface AttachmentPreviewProps {
  /** File to preview */
  file: File;
  /** Object URL for the file */
  fileUrl: string;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when download button is clicked */
  onDownload: () => void;
}

/**
 * Check if file is an image
 */
function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * Check if file is a PDF
 */
function isPDF(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    units.length - 1
  );

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

/**
 * AttachmentPreview Component
 *
 * Modal dialog for previewing image and PDF attachments.
 * Supports zoom controls for images and inline PDF display.
 *
 * Features:
 * - Image preview with zoom controls
 * - PDF preview (iframe)
 * - Download button
 * - Close button and ESC key support
 * - Click backdrop to close
 * - Keyboard accessible
 *
 * @example
 * ```tsx
 * <AttachmentPreview
 *   file={file}
 *   fileUrl={objectUrl}
 *   onClose={() => setShowPreview(false)}
 *   onDownload={() => downloadFile(file)}
 * />
 * ```
 */
export function AttachmentPreview({
  file,
  fileUrl,
  onClose,
  onDownload,
}: AttachmentPreviewProps) {
  const [zoomLevel, setZoomLevel] = useState(100);
  const canPreview = isImage(file.type) || isPDF(file.type);

  /**
   * Zoom in (max 200%)
   */
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 25, 200));
  };

  /**
   * Zoom out (min 50%)
   */
  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 25, 50));
  };

  return (
    <Dialog open={true} onClose={onClose} size="5xl">
      <DialogTitle>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {file.name}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {formatFileSize(file.size)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={onDownload}
              aria-label="Download file"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              <Trans>Download</Trans>
            </Button>
            <Button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              color="zinc"
            >
              <XMarkIcon className="h-5 w-5" />
              <Trans>Close</Trans>
            </Button>
          </div>
        </div>
      </DialogTitle>

      <DialogBody>
        {/* Image Preview */}
        {isImage(file.type) && (
          <div className="space-y-4">
            {/* Zoom Controls */}
            <div className="flex items-center justify-center gap-2">
              <Button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 50}
                aria-label="Zoom out"
                color="zinc"
              >
                <MagnifyingGlassMinusIcon className="h-5 w-5" />
              </Button>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {zoomLevel}%
              </span>
              <Button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 200}
                aria-label="Zoom in"
                color="zinc"
              >
                <MagnifyingGlassPlusIcon className="h-5 w-5" />
              </Button>
            </div>

            {/* Image */}
            <div className="flex justify-center overflow-auto rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
              <img
                src={fileUrl}
                alt={file.name}
                className="max-h-[600px] object-contain"
                style={{ transform: `scale(${zoomLevel / 100})` }}
              />
            </div>
          </div>
        )}

        {/* PDF Preview */}
        {isPDF(file.type) && (
          <div className="h-[600px] w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
            <iframe
              src={fileUrl}
              title="PDF Preview"
              className="h-full w-full"
              sandbox="allow-scripts"
            />
          </div>
        )}

        {/* Unsupported Preview */}
        {!canPreview && (
          <div className="flex h-64 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
            <div className="text-center">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                <Trans>Preview not available for this file type.</Trans>
              </p>
              <Button type="button" onClick={onDownload} className="mt-4">
                <ArrowDownTrayIcon className="h-5 w-5" />
                <Trans>Download to view</Trans>
              </Button>
            </div>
          </div>
        )}
      </DialogBody>

      <DialogActions>
        <Button type="button" onClick={onClose} color="zinc">
          <Trans>Close</Trans>
        </Button>
        <Button type="button" onClick={onDownload}>
          <ArrowDownTrayIcon className="h-5 w-5" />
          <Trans>Download</Trans>
        </Button>
      </DialogActions>
    </Dialog>
  );
}
