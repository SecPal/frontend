// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Trans, t } from "@lingui/macro";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import {
  Alert,
  AlertTitle,
  AlertDescription,
  AlertBody,
  AlertActions,
} from "./alert";
import { Button } from "./button";
import { Text } from "./text";
import type { OrganizationalUnit } from "../types/organizational";
import { deleteOrganizationalUnit } from "../services/organizationalUnitApi";

/**
 * Props for DeleteOrganizationalUnitDialog
 */
export interface DeleteOrganizationalUnitDialogProps {
  /** Dialog open state */
  open: boolean;
  /** Unit to delete (or null if no unit selected) */
  unit: OrganizationalUnit | null;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback on successful deletion */
  onSuccess: () => void;
}

/**
 * Warning icon component
 */
function ExclamationTriangleIcon({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
      />
    </svg>
  );
}

/**
 * Delete confirmation dialog for organizational units
 *
 * Uses Catalyst Alert component for proper confirmation dialog semantics.
 * Shows different content based on whether the unit has children:
 * - Without children: Standard delete confirmation with Delete/Cancel buttons
 * - With children: Warning that unit cannot be deleted, with OK button only
 *
 * Handles API errors gracefully, including 409 Conflict when the server
 * detects children that weren't visible to the frontend.
 *
 * @see Issue #295: Frontend: Organizational unit delete confirmation
 */
export function DeleteOrganizationalUnitDialog({
  open,
  unit,
  onClose,
  onSuccess,
}: DeleteOrganizationalUnitDialogProps) {
  const isOnline = useOnlineStatus();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate derived state - unit is kept stable by parent during close animation
  const hasChildren = unit?.children && unit.children.length > 0;
  const childCount = unit?.children?.length ?? 0;
  const unitName = unit?.name ?? "";

  const handleDelete = async () => {
    if (!unit) return;

    setError(null);
    setIsDeleting(true);

    try {
      await deleteOrganizationalUnit(unit.id);
      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t`Failed to delete organizational unit`
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  // Single Alert with conditional content - prevents flickering
  return (
    <Alert open={open} onClose={handleClose} size="md">
      <div className="flex items-center gap-4">
        <div
          className={`shrink-0 rounded-full p-2 ${
            hasChildren
              ? "bg-amber-100 dark:bg-amber-900/50"
              : "bg-red-100 dark:bg-red-900/50"
          }`}
        >
          <ExclamationTriangleIcon
            className={`h-6 w-6 ${
              hasChildren
                ? "text-amber-600 dark:text-amber-400"
                : "text-red-600 dark:text-red-400"
            }`}
          />
        </div>
        <div className="flex-1">
          {hasChildren ? (
            <AlertTitle>
              <Trans>Cannot Delete "{unitName}"</Trans>
            </AlertTitle>
          ) : (
            <AlertTitle>
              <Trans>Delete "{unitName}"?</Trans>
            </AlertTitle>
          )}
        </div>
      </div>

      {/* Offline warning banner - mutations not possible */}
      {!isOnline && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <div className="font-semibold mb-1">
            <Trans>You're offline</Trans>
          </div>
          <Trans>
            Deleting organizational units is not possible while offline. Please
            reconnect to make changes.
          </Trans>
        </div>
      )}

      {hasChildren ? (
        <>
          <AlertDescription>
            <Trans>
              This unit has {childCount} child unit(s). Please delete or move
              the child units before deleting this unit.
            </Trans>
          </AlertDescription>
          <AlertBody>
            <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
              <Text className="text-amber-800 dark:text-amber-200">
                <Trans>
                  Child units must be deleted or reassigned to a different
                  parent before this organizational unit can be removed.
                </Trans>
              </Text>
            </div>
          </AlertBody>
          <AlertActions>
            <Button onClick={handleClose}>
              <Trans>OK</Trans>
            </Button>
          </AlertActions>
        </>
      ) : (
        <>
          <AlertDescription>
            <Trans>
              This action cannot be undone. The organizational unit will be
              permanently removed.
            </Trans>
          </AlertDescription>
          {error && (
            <AlertBody>
              <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                <Text className="text-red-800 dark:text-red-200">{error}</Text>
              </div>
            </AlertBody>
          )}
          <AlertActions>
            <Button plain onClick={handleClose} disabled={isDeleting}>
              <Trans>Cancel</Trans>
            </Button>
            <Button
              color="red"
              onClick={handleDelete}
              disabled={isDeleting || !isOnline}
            >
              {isDeleting ? <Trans>Deleting...</Trans> : <Trans>Delete</Trans>}
            </Button>
          </AlertActions>
        </>
      )}
    </Alert>
  );
}

export default DeleteOrganizationalUnitDialog;
