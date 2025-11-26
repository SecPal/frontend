// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "./dialog";
import { Button } from "./button";
import type { ConflictInfo } from "../lib/conflictResolution";

interface ConflictResolutionDialogProps {
  /**
   * Conflict information including local and server versions
   */
  conflict: ConflictInfo;

  /**
   * Callback when user chooses to keep local version
   */
  onKeepLocal: () => void;

  /**
   * Callback when user chooses to keep server version
   */
  onKeepServer: () => void;

  /**
   * Callback when dialog is cancelled
   */
  onCancel: () => void;

  /**
   * Whether the dialog is open
   */
  isOpen: boolean;
}

/**
 * Dialog for resolving secret conflicts when syncing offline changes
 *
 * Displays conflicting fields and allows user to choose which version to keep.
 *
 * @example
 * ```tsx
 * <ConflictResolutionDialog
 *   conflict={conflictInfo}
 *   onKeepLocal={() => handleResolve('local')}
 *   onKeepServer={() => handleResolve('server')}
 *   onCancel={() => setShowDialog(false)}
 *   isOpen={showConflictDialog}
 * />
 * ```
 */
export function ConflictResolutionDialog({
  conflict,
  onKeepLocal,
  onKeepServer,
  onCancel,
  isOpen,
}: ConflictResolutionDialogProps) {
  const { _ } = useLingui();
  const [selectedResolution, setSelectedResolution] = useState<
    "local" | "server" | null
  >(null);

  const handleConfirm = () => {
    if (selectedResolution === "local") {
      onKeepLocal();
    } else if (selectedResolution === "server") {
      onKeepServer();
    }
  };

  const formatFieldValue = (value: unknown): string => {
    if (value === undefined || value === null) {
      return _(msg`(empty)`);
    }
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    return String(value);
  };

  return (
    <Dialog open={isOpen} onClose={onCancel}>
      <DialogTitle>
        <Trans>Sync Conflict Detected</Trans>
      </DialogTitle>
      <DialogDescription>
        <Trans>
          This secret was modified both locally and on the server. Please choose
          which version to keep.
        </Trans>
      </DialogDescription>

      <DialogBody>
        <div className="space-y-4">
          {/* Conflict Summary */}
          <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <Trans>
                <strong>{conflict.conflictFields.length} field(s)</strong> have
                conflicting changes:
              </Trans>
            </p>
            <ul className="mt-2 list-inside list-disc text-sm text-yellow-700 dark:text-yellow-300">
              {conflict.conflictFields.map((field: string) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>

          {/* Version Comparison */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Local Version */}
            <button
              type="button"
              onClick={() => setSelectedResolution("local")}
              className={`rounded-lg border-2 p-4 text-left transition-colors ${
                selectedResolution === "local"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
              }`}
            >
              <h4 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                <Trans>Your Local Version</Trans>
              </h4>
              <dl className="space-y-2 text-sm">
                {conflict.conflictFields.map((field: string) => (
                  <div key={field}>
                    <dt className="font-medium text-gray-700 dark:text-gray-300">
                      {field}:
                    </dt>
                    <dd className="mt-1 text-gray-600 dark:text-gray-400">
                      {formatFieldValue(
                        conflict.localVersion[
                          field as keyof typeof conflict.localVersion
                        ]
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                <Trans>
                  Last modified:{" "}
                  {new Date(conflict.localVersion.updated_at).toLocaleString()}
                </Trans>
              </p>
            </button>

            {/* Server Version */}
            <button
              type="button"
              onClick={() => setSelectedResolution("server")}
              className={`rounded-lg border-2 p-4 text-left transition-colors ${
                selectedResolution === "server"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
              }`}
            >
              <h4 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                <Trans>Server Version</Trans>
              </h4>
              <dl className="space-y-2 text-sm">
                {conflict.conflictFields.map((field: string) => (
                  <div key={field}>
                    <dt className="font-medium text-gray-700 dark:text-gray-300">
                      {field}:
                    </dt>
                    <dd className="mt-1 text-gray-600 dark:text-gray-400">
                      {formatFieldValue(
                        conflict.serverVersion[
                          field as keyof typeof conflict.serverVersion
                        ]
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                <Trans>
                  Last modified:{" "}
                  {new Date(conflict.serverVersion.updated_at).toLocaleString()}
                </Trans>
              </p>
            </button>
          </div>
        </div>
      </DialogBody>

      <DialogActions>
        <Button plain onClick={onCancel}>
          <Trans>Cancel</Trans>
        </Button>
        <Button
          color="blue"
          onClick={handleConfirm}
          disabled={!selectedResolution}
        >
          <Trans>Apply Selection</Trans>
        </Button>
      </DialogActions>
    </Dialog>
  );
}
