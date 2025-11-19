// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/macro";
import { Text } from "./text";

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
      className="mb-4 p-3 bg-blue-100 rounded"
      role="status"
      aria-live="polite"
    >
      <Text className="text-blue-900 font-semibold mb-2">
        <Trans>Encrypting files...</Trans>
      </Text>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(([filename, percentage]) => (
            <div key={filename}>
              <div className="flex justify-between items-center mb-1">
                <Text className="text-sm text-blue-800 truncate flex-1">
                  {filename}
                </Text>
                <Text className="text-sm text-blue-800 font-semibold ml-2">
                  {percentage}%
                </Text>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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
        <div className="w-full bg-blue-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full animate-pulse w-full" />
        </div>
      )}
    </div>
  );
}
