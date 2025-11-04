// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import { checkStorageQuota } from "../lib/apiCache";

/**
 * Component to display IndexedDB storage quota usage
 *
 * Shows current usage, quota, and percentage with warning indicator
 * when storage is above 80% capacity.
 *
 * @example
 * ```tsx
 * <StorageQuotaIndicator />
 * ```
 */
export function StorageQuotaIndicator() {
  const [quota, setQuota] = useState<{
    usage: number;
    quota: number;
    percentUsed: number;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadQuota() {
      setIsLoading(true);
      const result = await checkStorageQuota();
      setQuota(result);
      setIsLoading(false);
    }

    loadQuota();
  }, []);

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading storage info...</div>;
  }

  if (!quota) {
    return (
      <div className="text-sm text-gray-500">
        Storage quota information not available
      </div>
    );
  }

  const usageMB = quota.usage / 1024 / 1024;
  const quotaMB = quota.quota / 1024 / 1024;
  const isWarning = quota.percentUsed > 80;

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Storage Usage</h3>
          <p className="mt-1 text-xs text-gray-500">
            {usageMB.toFixed(2)} MB / {quotaMB.toFixed(2)} MB
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isWarning && <span className="text-xl">⚠️</span>}
          <span
            className={`text-lg font-semibold ${
              isWarning ? "text-red-600" : "text-gray-900"
            }`}
          >
            {quota.percentUsed.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full transition-all ${
            isWarning ? "bg-red-600" : "bg-blue-600"
          }`}
          style={{ width: `${Math.min(quota.percentUsed, 100)}%` }}
        />
      </div>

      {isWarning && (
        <p className="mt-2 text-xs text-red-600">
          Storage is almost full. Consider clearing cache.
        </p>
      )}
    </div>
  );
}
