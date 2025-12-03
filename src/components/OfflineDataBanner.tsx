// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import {
  SignalSlashIcon,
  ClockIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

export interface OfflineDataBannerProps {
  /** Whether the device is currently offline */
  isOffline: boolean;
  /** Whether the displayed data is from cache (not fresh from API) */
  isStale: boolean;
  /** Timestamp of last successful sync */
  lastSynced: Date | null;
  /** Optional refresh callback (hidden when offline) */
  onRefresh?: () => void;
}

/**
 * Format relative time using browser's Intl.RelativeTimeFormat
 * Automatically uses the user's locale for i18n
 * @param date - Date to format
 * @param locale - Locale string (e.g., 'en', 'de')
 * @returns Localized human-readable relative time
 */
function formatRelativeTime(date: Date, locale: string): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (diffSeconds < 60) {
    return rtf.format(-diffSeconds, "second");
  } else if (diffMinutes < 60) {
    return rtf.format(-diffMinutes, "minute");
  } else if (diffHours < 24) {
    return rtf.format(-diffHours, "hour");
  } else {
    return rtf.format(-diffDays, "day");
  }
}

/**
 * Banner component to show offline/stale data status
 *
 * Displays:
 * - Offline warning with cached data notice
 * - Stale data warning with last sync time
 * - Refresh button when online
 *
 * @example
 * ```tsx
 * <OfflineDataBanner
 *   isOffline={!navigator.onLine}
 *   isStale={true}
 *   lastSynced={new Date('2025-01-15T12:00:00Z')}
 *   onRefresh={() => refetch()}
 * />
 * ```
 */
export function OfflineDataBanner({
  isOffline,
  isStale,
  lastSynced,
  onRefresh,
}: OfflineDataBannerProps) {
  const { i18n, _ } = useLingui();

  // Don't show banner if online and data is fresh
  if (!isOffline && !isStale) {
    return null;
  }

  const Icon = isOffline ? SignalSlashIcon : ClockIcon;
  const bgColor = isOffline
    ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
    : "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800";
  const textColor = isOffline
    ? "text-amber-800 dark:text-amber-200"
    : "text-blue-800 dark:text-blue-200";
  const iconColor = isOffline
    ? "text-amber-600 dark:text-amber-400"
    : "text-blue-600 dark:text-blue-400";

  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 ${bgColor}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 shrink-0 ${iconColor}`} aria-hidden="true" />
        <div className="flex-1">
          <p className={`text-sm font-medium ${textColor}`}>
            {isOffline ? (
              <Trans>You're offline - showing cached data</Trans>
            ) : (
              <Trans>Showing cached data</Trans>
            )}
          </p>
          {lastSynced && (
            <p className={`mt-0.5 text-xs ${textColor} opacity-75`}>
              <Trans>
                Last synced: {formatRelativeTime(lastSynced, i18n.locale)}
              </Trans>
            </p>
          )}
        </div>
        {onRefresh && !isOffline && (
          <button
            type="button"
            onClick={onRefresh}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${textColor}`}
            aria-label={_(msg`Refresh data`)}
          >
            <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
            <Trans>Refresh</Trans>
          </button>
        )}
      </div>
    </div>
  );
}
