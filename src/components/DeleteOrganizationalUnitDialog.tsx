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
  AlertTitle,
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
                hasChildren ? "bg-amber-500/10" : "bg-destructive/10"
              }`}
            >
              <TriangleAlert
                className={`h-6 w-6 ${
                  hasChildren ? "text-foreground" : "text-destructive"
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
            <Alert className="mb-4 border-destructive/30 bg-destructive/10 text-foreground">
              <AlertTitle className="text-destructive">
                <Trans>You're offline</Trans>
              </AlertTitle>
              <AlertDescription className="mt-0 text-destructive">
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
                <Alert className="border-amber-500/30 bg-amber-500/10 text-foreground">
                  <AlertDescription className="mt-0 text-foreground">
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
                  <Alert className="border-destructive/30 bg-destructive/10 text-foreground">
                    <AlertDescription className="mt-0 text-destructive">
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
