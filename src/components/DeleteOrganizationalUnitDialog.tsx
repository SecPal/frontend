// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { TriangleAlert } from "lucide-react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/ui";
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
 * Delete confirmation dialog for organizational units
 *
 * Uses the shared shadcn/Radix dialog primitives for confirmation semantics.
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
    <Dialog open={open} onClose={handleClose}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent size="md">
          <div className="flex items-center gap-4">
            <div
              className={`shrink-0 rounded-full p-2 ${
                hasChildren
                  ? "bg-amber-100 dark:bg-amber-900/50"
                  : "bg-red-100 dark:bg-red-900/50"
              }`}
            >
              <TriangleAlert
                className={`h-6 w-6 ${
                  hasChildren
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              />
            </div>
            <div className="flex-1">
              {hasChildren ? (
                <DialogTitle>
                  <Trans>Cannot Delete "{unitName}"</Trans>
                </DialogTitle>
              ) : (
                <DialogTitle>
                  <Trans>Delete "{unitName}"?</Trans>
                </DialogTitle>
              )}
            </div>
          </div>

          {!isOnline && (
            <Alert className="mb-4 border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              <div className="mb-1 font-semibold">
                <Trans>You're offline</Trans>
              </div>
              <AlertDescription className="mt-0 text-red-800 dark:text-red-400">
                <Trans>
                  Deleting organizational units is not possible while offline.
                  Please reconnect to make changes.
                </Trans>
              </AlertDescription>
            </Alert>
          )}

          {hasChildren ? (
            <>
              <DialogDescription>
                <Trans>
                  This unit has {childCount} child unit(s). Please delete or
                  move the child units before deleting this unit.
                </Trans>
              </DialogDescription>
              <DialogBody>
                <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
                  <AlertDescription className="mt-0 text-amber-800 dark:text-amber-200">
                    <Trans>
                      Child units must be deleted or reassigned to a different
                      parent before this organizational unit can be removed.
                    </Trans>
                  </AlertDescription>
                </Alert>
              </DialogBody>
              <DialogActions>
                <Button onClick={handleClose}>
                  <Trans>OK</Trans>
                </Button>
              </DialogActions>
            </>
          ) : (
            <>
              <DialogDescription>
                <Trans>
                  This action cannot be undone. The organizational unit will be
                  permanently removed.
                </Trans>
              </DialogDescription>
              {error && (
                <DialogBody>
                  <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                    <AlertDescription className="mt-0 text-red-800 dark:text-red-200">
                      {error}
                    </AlertDescription>
                  </Alert>
                </DialogBody>
              )}
              <DialogActions>
                <Button
                  variant="ghost"
                  onClick={handleClose}
                  disabled={isDeleting}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting || !isOnline}
                >
                  {isDeleting ? (
                    <Trans>Deleting...</Trans>
                  ) : (
                    <Trans>Delete</Trans>
                  )}
                </Button>
              </DialogActions>
            </>
          )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

export default DeleteOrganizationalUnitDialog;
