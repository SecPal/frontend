// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Trans, t } from "@lingui/macro";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogActions,
} from "./dialog";
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
 * Warning icon for the dialog
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate derived state - use defaults when unit is null
  const hasChildren = unit?.children && unit.children.length > 0;
  const childCount = unit?.children?.length ?? 0;
  const unitName = unit?.name ?? "";

  // Dialog should only be open when both open=true AND unit is provided
  // This prevents flickering when switching between units
  const isOpen = open && unit !== null;

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

  // Render blocked state (unit has children)
  if (hasChildren) {
    return (
      <Dialog open={isOpen} onClose={handleClose} size="md">
        <div className="flex items-start gap-4">
          <div className="shrink-0 rounded-full bg-amber-100 p-2 dark:bg-amber-900/50">
            <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <DialogTitle>
              <Trans>Cannot Delete "{unitName}"</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>
                This unit has {childCount} child units. Please delete or move
                the child units before deleting this unit.
              </Trans>
            </DialogDescription>
          </div>
        </div>

        <DialogBody>
          <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
            <Text className="text-amber-800 dark:text-amber-200">
              <Trans>
                Child units must be deleted or reassigned to a different parent
                before this organizational unit can be removed.
              </Trans>
            </Text>
          </div>
        </DialogBody>

        <DialogActions>
          <Button onClick={handleClose}>
            <Trans>OK</Trans>
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // Render delete confirmation (unit has no children)
  return (
    <Dialog open={isOpen} onClose={handleClose} size="md">
      <div className="flex items-start gap-4">
        <div className="shrink-0 rounded-full bg-red-100 p-2 dark:bg-red-900/50">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1">
          <DialogTitle>
            <Trans>Delete "{unitName}"?</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              This action cannot be undone. The organizational unit will be
              permanently removed.
            </Trans>
          </DialogDescription>
        </div>
      </div>

      {error && (
        <DialogBody>
          <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
            <Text className="text-red-800 dark:text-red-200">{error}</Text>
          </div>
        </DialogBody>
      )}

      <DialogActions>
        <Button plain onClick={handleClose} disabled={isDeleting}>
          <Trans>Cancel</Trans>
        </Button>
        <Button color="red" onClick={handleDelete} disabled={isDeleting}>
          {isDeleting ? <Trans>Deleting...</Trans> : <Trans>Delete</Trans>}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DeleteOrganizationalUnitDialog;
