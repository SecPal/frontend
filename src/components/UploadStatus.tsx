// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useState, useRef, useEffect } from "react";
import { Trans, Plural } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  CloudArrowUpIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useFileQueue } from "../hooks/useFileQueue";
import { Button } from "./button";

/**
 * UploadStatus Component
 *
 * Displays encrypted file upload status and queue management UI.
 * Shows upload progress, queue list, and manual retry options.
 *
 * Features:
 * - Real-time upload progress indicator (0-100%)
 * - Upload queue list with file names and status
 * - Manual retry button for failed uploads
 * - Success/failure notifications
 * - Automatic dismissal of completed uploads
 *
 * @example
 * ```tsx
 * <UploadStatus />
 * ```
 */
export function UploadStatus() {
  const { _ } = useLingui();
  const {
    encrypted,
    failed,
    isProcessing,
    clearCompleted,
    deleteFile,
    retryFailed,
  } = useFileQueue();

  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const timeoutRef = useRef<number | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const clearNotificationTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleRetryFailed = useCallback(async () => {
    try {
      await retryFailed();
      clearNotificationTimeout();
      setNotification({
        type: "success",
        message: _(
          msg`Retry scheduled. Files will upload when network is available.`
        ),
      });

      // Auto-dismiss success notification after 5 seconds
      timeoutRef.current = window.setTimeout(() => setNotification(null), 5000);
    } catch (error) {
      setNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : _(msg`Failed to schedule upload retry`),
      });
    }
  }, [retryFailed, clearNotificationTimeout, _]);

  const handleClearCompleted = useCallback(async () => {
    try {
      const count = await clearCompleted();
      clearNotificationTimeout();
      setNotification({
        type: "success",
        message: _(msg`Cleared ${count} completed upload(s)`),
      });

      // Auto-dismiss after 3 seconds
      timeoutRef.current = window.setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      setNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : _(msg`Failed to clear uploads`),
      });
    }
  }, [clearCompleted, clearNotificationTimeout, _]);

  const handleDeleteFile = useCallback(
    async (id: string, filename: string) => {
      try {
        await deleteFile(id);
        clearNotificationTimeout();
        setNotification({
          type: "success",
          message: _(msg`Removed ${filename} from queue`),
        });

        timeoutRef.current = window.setTimeout(
          () => setNotification(null),
          3000
        );
      } catch (error) {
        setNotification({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : _(msg`Failed to delete file`),
        });
      }
    },
    [deleteFile, clearNotificationTimeout, _]
  );

  // Don't show component if nothing in queue
  const totalFiles = encrypted.length + failed.length;
  if (totalFiles === 0) {
    return null;
  }

  // Calculate progress percentage (files that have left the encrypted state)
  const completedCount = totalFiles - encrypted.length;
  const progressPercentage =
    totalFiles > 0 ? Math.round((completedCount / totalFiles) * 100) : 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 rounded-lg bg-white shadow-lg dark:bg-gray-800">
      {/* Notification Toast */}
      {notification && (
        <div
          className={`mb-2 rounded-t-lg p-3 ${
            notification.type === "success"
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {notification.type === "success" ? (
                <CheckCircleIcon className="h-5 w-5" aria-hidden="true" />
              ) : (
                <ExclamationCircleIcon className="h-5 w-5" aria-hidden="true" />
              )}
              <span className="text-sm font-medium">
                {notification.message}
              </span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-current hover:opacity-70"
              aria-label="Dismiss notification"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <CloudArrowUpIcon
            className="h-6 w-6 text-blue-600 dark:text-blue-400"
            aria-hidden="true"
          />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            <Trans>Upload Queue</Trans>
          </h3>
        </div>

        {isProcessing && (
          <ArrowPathIcon
            className="h-5 w-5 animate-spin text-blue-600"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Progress Indicator */}
      {encrypted.length > 0 && (
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-300">
              <Trans>Progress</Trans>
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {progressPercentage}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
              role="progressbar"
              aria-valuenow={progressPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            <Plural
              value={encrypted.length}
              one="# file ready for upload"
              other="# files ready for upload"
            />
          </p>
        </div>
      )}

      {/* Queue List */}
      <div className="max-h-64 overflow-y-auto border-t border-gray-200 dark:border-gray-700">
        {encrypted.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between border-b border-gray-100 p-3 dark:border-gray-700"
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {file.metadata.name}
              </span>
            </div>
            <button
              onClick={() => handleDeleteFile(file.id, file.metadata.name)}
              className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
              aria-label={`Remove ${file.metadata.name}`}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        ))}

        {failed.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between border-b border-gray-100 bg-red-50 p-3 dark:border-gray-700 dark:bg-red-900/20"
          >
            <div className="flex items-center gap-2">
              <ExclamationCircleIcon
                className="h-4 w-4 text-red-600 dark:text-red-400"
                aria-hidden="true"
              />
              <div>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {file.metadata.name}
                </span>
                {file.error && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {file.error}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => handleDeleteFile(file.id, file.metadata.name)}
              className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
              aria-label={`Remove ${file.metadata.name}`}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-gray-200 p-4 dark:border-gray-700">
        {failed.length > 0 && (
          <Button onClick={handleRetryFailed} disabled={isProcessing}>
            <ArrowPathIcon className="h-4 w-4" />
            <Trans>Retry Failed</Trans>
          </Button>
        )}

        <Button onClick={handleClearCompleted} outline disabled={isProcessing}>
          <Trans>Clear Completed</Trans>
        </Button>
      </div>
    </div>
  );
}
