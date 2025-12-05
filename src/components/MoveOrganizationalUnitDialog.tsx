// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from "react";
import { Trans, t } from "@lingui/macro";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogActions,
} from "./dialog";
import { Button } from "./button";
import { Select } from "./select";
import { Field, Label, Description } from "./fieldset";
import { Text } from "./text";
import type { OrganizationalUnit } from "../types/organizational";
import {
  listOrganizationalUnits,
  attachOrganizationalUnitParent,
  detachOrganizationalUnitParent,
} from "../services/organizationalUnitApi";

/**
 * Props for MoveOrganizationalUnitDialog
 */
export interface MoveOrganizationalUnitDialogProps {
  /** Dialog open state */
  open: boolean;
  /** Unit to move (or null if no unit selected) */
  unit: OrganizationalUnit | null;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback on successful move */
  onSuccess: () => void;
}

/**
 * Arrow icon component for move indication
 */
function ArrowsRightLeftIcon({
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
        d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
      />
    </svg>
  );
}

/**
 * Move/Reparent dialog for organizational units
 *
 * Allows users to:
 * - Move a unit under a different parent
 * - Make a unit a root unit (detach from current parent)
 *
 * Uses the attachOrganizationalUnitParent and detachOrganizationalUnitParent
 * API functions to perform the actual move operation.
 *
 * @see Issue #305: Frontend: UI for moving/reparenting units in hierarchy
 */
export function MoveOrganizationalUnitDialog({
  open,
  unit,
  onClose,
  onSuccess,
}: MoveOrganizationalUnitDialogProps) {
  const [availableUnits, setAvailableUnits] = useState<OrganizationalUnit[]>(
    []
  );
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Current parent ID for comparison
  const currentParentId = unit?.parent?.id || "";

  // Determine if the move button should be disabled
  const isMoveDisabled =
    isMoving || selectedParentId === currentParentId || isLoading;

  // Load available units when dialog opens
  const loadUnits = useCallback(async () => {
    if (!unit) return;

    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await listOrganizationalUnits({ per_page: 100 });

      // Filter out the unit itself (can't be its own parent)
      // Also filter out descendants to prevent circular references
      const filtered = response.data.filter((u) => u.id !== unit.id);

      setAvailableUnits(filtered);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : t`Failed to load units`
      );
    } finally {
      setIsLoading(false);
    }
  }, [unit]);

  // Reset state when dialog opens/closes or unit changes
  useEffect(() => {
    if (open && unit) {
      setSelectedParentId(unit.parent?.id || "");
      setError(null);
      loadUnits();
    }
  }, [open, unit, loadUnits]);

  // Handle move action
  const handleMove = async () => {
    if (!unit) return;

    setError(null);
    setIsMoving(true);

    try {
      if (selectedParentId === "") {
        // Make root unit - detach from current parent
        if (unit.parent?.id) {
          await detachOrganizationalUnitParent(unit.id, unit.parent.id);
        }
      } else {
        // Move to new parent
        await attachOrganizationalUnitParent(unit.id, selectedParentId);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t`Failed to move organizational unit`
      );
    } finally {
      setIsMoving(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  // Handle null unit gracefully
  if (!unit) {
    return (
      <Dialog open={open} onClose={handleClose} size="md">
        <DialogBody>
          <Text>
            <Trans>No unit selected</Trans>
          </Text>
        </DialogBody>
        <DialogActions>
          <Button onClick={handleClose}>
            <Trans>Close</Trans>
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} size="md">
      <div className="flex items-center gap-4">
        <div className="shrink-0 rounded-full bg-blue-100 p-2 dark:bg-blue-900/50">
          <ArrowsRightLeftIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <DialogTitle>
            <Trans>Move "{unit.name}"</Trans>
          </DialogTitle>
        </div>
      </div>

      <DialogDescription>
        <Trans>Select a new parent for this organizational unit.</Trans>
      </DialogDescription>

      <DialogBody>
        {/* Current parent info */}
        <div className="mb-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            <Trans>Current parent:</Trans>
          </Text>
          <Text className="font-medium">
            {unit.parent ? (
              unit.parent.name
            ) : (
              <Trans>No parent (root unit)</Trans>
            )}
          </Text>
        </div>

        {/* Load error */}
        {loadError && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
            <Text className="text-red-800 dark:text-red-200">{loadError}</Text>
          </div>
        )}

        {/* Parent selection */}
        {!loadError && (
          <Field>
            <Label>
              <Trans>New parent</Trans>
            </Label>
            <Description>
              <Trans>Choose a new parent unit or make this a root unit.</Trans>
            </Description>
            <Select
              value={selectedParentId}
              onChange={(e) => setSelectedParentId(e.target.value)}
              disabled={isLoading || isMoving}
            >
              <option value="">{t`Make root unit (no parent)`}</option>
              {availableUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.type})
                </option>
              ))}
            </Select>
          </Field>
        )}

        {/* Move error */}
        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
            <Text className="text-red-800 dark:text-red-200">{error}</Text>
          </div>
        )}
      </DialogBody>

      <DialogActions>
        <Button plain onClick={handleClose} disabled={isMoving}>
          <Trans>Cancel</Trans>
        </Button>
        <Button color="blue" onClick={handleMove} disabled={isMoveDisabled}>
          {isMoving ? <Trans>Moving...</Trans> : <Trans>Move</Trans>}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default MoveOrganizationalUnitDialog;
