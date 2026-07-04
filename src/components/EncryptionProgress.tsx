// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { Trans } from "@lingui/react/macro";

export interface EncryptionProgressProps {
  /**
   * Map of filename to encryption progress (0-100)
   */
  progress: Map<string, number>;

  /**
   * Whether encryption is currently in progress
   */
  isEncrypting: boolean;
}

/**
 * Displays encryption progress for multiple files
 *
 * Shows individual file progress bars with percentage indicators
 *
 * @example
 * ```tsx
 * const progress = new Map([['file1.pdf', 45], ['file2.jpg', 78]]);
 * <EncryptionProgress progress={progress} isEncrypting={true} />
 * ```
 */
export function EncryptionProgress({
  progress,
  isEncrypting,
}: EncryptionProgressProps) {
  if (!isEncrypting && progress.size === 0) {
    return null;
  }

  const files = Array.from(progress.entries());

  return (
    <div
      className="border-border bg-muted mb-4 rounded-lg border p-3"
      role="status"
      aria-live="polite"
    >
      <p className="text-foreground mb-2 text-base/6 font-semibold sm:text-sm/6">
        <Trans>Encrypting files...</Trans>
      </p>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(([filename, percentage]) => (
            <div key={filename}>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-muted-foreground flex-1 truncate text-sm">
                  {filename}
                </p>
                <p className="text-foreground ml-2 text-sm font-semibold">
                  {percentage}%
                </p>
              </div>
              <div className="bg-accent h-2 w-full rounded-full">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                  role="progressbar"
                  aria-valuenow={percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && (
        <div className="bg-accent h-2 w-full rounded-full">
          <div className="bg-primary h-2 w-full animate-pulse rounded-full" />
        </div>
      )}
    </div>
  );
}
