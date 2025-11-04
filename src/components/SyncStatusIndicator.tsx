// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Trans } from "@lingui/react/macro";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { db } from "../lib/db";
import { processSyncQueue } from "../lib/apiCache";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

/**
 * SyncStatusIndicator Component
 *
 * Displays the current sync status and allows manual sync trigger.
 * Shows pending operations count and last sync time.
 *
 * @example
 * ```tsx
 * <SyncStatusIndicator apiBaseUrl="https://api.secpal.dev" />
 * ```
 */
export function SyncStatusIndicator({ apiBaseUrl }: { apiBaseUrl: string }) {
  const isOnline = useOnlineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Live query for pending operations
  const pendingOps = useLiveQuery(
    () => db.syncQueue.where("status").equals("pending").count(),
    []
  );

  const errorOps = useLiveQuery(
    () => db.syncQueue.where("status").equals("error").count(),
    []
  );

  const handleManualSync = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    setSyncError(null);

    try {
      const stats = await processSyncQueue(apiBaseUrl);

      if (stats.failed > 0) {
        // Error messages are developer-facing and don't need translation
        setSyncError(
          `Failed to sync ${stats.failed} operation(s). Will retry later.`
        );
      }

      if (stats.synced > 0) {
        setLastSyncTime(new Date());
      }
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "Unknown sync error occurred"
      );
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, apiBaseUrl]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingOps && pendingOps > 0) {
      handleManualSync();
    }
  }, [isOnline, pendingOps, handleManualSync]);

  // Don't show indicator if nothing to sync and no errors
  if (!pendingOps && !errorOps) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-white p-4 shadow-lg dark:bg-gray-800">
      <div className="flex items-center gap-3">
        {/* Status Icon */}
        {isSyncing ? (
          <ArrowPathIcon
            className="h-6 w-6 animate-spin text-blue-600"
            aria-hidden="true"
          />
        ) : errorOps && errorOps > 0 ? (
          <ExclamationCircleIcon
            className="h-6 w-6 text-red-600"
            aria-hidden="true"
          />
        ) : (
          <CheckCircleIcon
            className="h-6 w-6 text-green-600"
            aria-hidden="true"
          />
        )}

        {/* Status Text */}
        <div className="flex-1">
          {isSyncing ? (
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              <Trans>Syncing...</Trans>
            </p>
          ) : pendingOps && pendingOps > 0 ? (
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              <Trans>{pendingOps} operation(s) pending</Trans>
            </p>
          ) : errorOps && errorOps > 0 ? (
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              <Trans>{errorOps} operation(s) failed</Trans>
            </p>
          ) : (
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              <Trans>All synced</Trans>
            </p>
          )}

          {/* Last Sync Time */}
          {lastSyncTime && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <Trans>Last sync: {lastSyncTime.toLocaleTimeString()}</Trans>
            </p>
          )}

          {/* Error Message */}
          {syncError && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {syncError}
            </p>
          )}
        </div>

        {/* Manual Sync Button */}
        {!isSyncing && isOnline && pendingOps && pendingOps > 0 && (
          <button
            onClick={handleManualSync}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            aria-label="Sync now"
          >
            <Trans>Sync</Trans>
          </button>
        )}

        {/* Offline Notice */}
        {!isOnline && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <Trans>Offline - will sync when online</Trans>
          </p>
        )}
      </div>
    </div>
  );
}
