// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useMemo } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Building2, Home, MapPin, MoveHorizontal, Users } from "lucide-react";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui";
import type {
  OrganizationalUnit,
  OrganizationalUnitType,
} from "../types/organizational";
import {
  attachOrganizationalUnitParent,
  detachOrganizationalUnitParent,
} from "../services/organizationalUnitApi";
import { getTypeLabel, TYPE_HIERARCHY } from "../lib/organizationalUnitUtils";
import { useOrganizationalUnitsWithOffline } from "../hooks/useOrganizationalUnitsWithOffline";

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
  /** Callback on successful move, receives new parent ID (empty string = root) */
  onSuccess: (newParentId: string) => void;
}

/**
 * Flattened unit with hierarchy information for display
 */
interface FlattenedUnit {
  id: string;
  name: string;
  type: OrganizationalUnitType;
  depth: number;
}

const ROOT_PARENT_SELECT_VALUE = "__secpal_root_parent__";

function toParentSelectValue(value: string) {
  return value === "" ? ROOT_PARENT_SELECT_VALUE : value;
}

function fromParentSelectValue(value: string) {
  return value === ROOT_PARENT_SELECT_VALUE ? "" : value;
}

/**
 * Icon component for organizational unit types
 */
function UnitTypeIcon({
  type,
  className = "h-4 w-4",
}: {
  type: OrganizationalUnitType;
  className?: string;
}) {
  switch (type) {
    case "holding":
    case "company":
      return (
        <Building2 className={`${className} text-blue-500`} data-slot="icon" />
      );
    case "department":
    case "division":
      return (
        <Users className={`${className} text-green-500`} data-slot="icon" />
      );
    case "branch":
      return (
        <Building2
          className={`${className} text-purple-500`}
          data-slot="icon"
        />
      );
    case "region":
      return (
        <MapPin className={`${className} text-orange-500`} data-slot="icon" />
      );
    default:
      return (
        <Building2 className={`${className} text-gray-500`} data-slot="icon" />
      );
  }
}

/**
 * Root icon for the "no parent" option
 */
function RootIcon({ className = "h-4 w-4" }: { className?: string }) {
  return <Home className={`${className} text-gray-400`} data-slot="icon" />;
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
function MoveOrganizationalUnitDialogContent({
  unit,
  onClose,
  onSuccess,
}: Omit<MoveOrganizationalUnitDialogProps, "open"> & {
  unit: OrganizationalUnit;
}) {
  // Use offline-first hook for fetching available parent units
  const {
    units: allUnits,
    loading: isLoadingUnits,
    error: loadError,
    isOffline,
    isStale,
  } = useOrganizationalUnitsWithOffline();

  const [selectedParentId, setSelectedParentId] = useState<string>(
    unit.parent?.id || ""
  );
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Current parent ID for comparison
  const currentParentId = unit?.parent?.id || "";

  // Determine if the move button should be disabled
  const isMoveDisabled =
    isMoving || selectedParentId === currentParentId || isLoadingUnits;

  /**
   * Filter available units based on move constraints
   * Excludes:
   * 1. The unit itself (can't be its own parent)
   * 2. Units that would violate hierarchy rules (parent must be higher rank)
   */
  const availableUnits = useMemo(() => {
    const unitRank = TYPE_HIERARCHY[unit.type];
    return allUnits.filter((u) => {
      // Can't be its own parent
      if (u.id === unit.id) return false;

      // Parent must be higher in hierarchy (lower rank number)
      const parentRank = TYPE_HIERARCHY[u.type];
      return parentRank < unitRank;
    });
  }, [allUnits, unit]);

  /**
   * Build a hierarchically sorted list of units for display in the dropdown.
   * This preserves the tree structure as a flat list with depth indicators.
   */
  const sortedUnits = useMemo((): FlattenedUnit[] => {
    if (availableUnits.length === 0) return [];

    // Create a map of parent ID to children
    const childrenMap = new Map<string, OrganizationalUnit[]>();
    const rootUnits: OrganizationalUnit[] = [];

    // Build parent-children relationships
    availableUnits.forEach((u) => {
      const parentId = u.parent?.id || "";
      if (!parentId) {
        rootUnits.push(u);
      } else {
        const children = childrenMap.get(parentId) || [];
        children.push(u);
        childrenMap.set(parentId, children);
      }
    });

    // Sort children alphabetically within each level
    rootUnits.sort((a, b) => a.name.localeCompare(b.name));
    childrenMap.forEach((children) => {
      children.sort((a, b) => a.name.localeCompare(b.name));
    });

    // Flatten the tree with depth information (pre-order traversal)
    const result: FlattenedUnit[] = [];

    const traverse = (units: OrganizationalUnit[], depth: number) => {
      units.forEach((u) => {
        result.push({
          id: u.id,
          name: u.name,
          type: u.type,
          depth,
        });
        const children = childrenMap.get(u.id);
        if (children) {
          traverse(children, depth + 1);
        }
      });
    };

    traverse(rootUnits, 0);
    return result;
  }, [availableUnits]);

  // Handle move action
  const handleMove = async () => {
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

      onSuccess(selectedParentId);
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

  return (
    <>
      <div className="flex items-center gap-4">
        <div className="shrink-0 rounded-full bg-blue-100 p-2 dark:bg-blue-900/50">
          <MoveHorizontal className="h-6 w-6 text-blue-600 dark:text-blue-400" />
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
        {/* Offline warning banner - mutations not possible */}
        {isOffline && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
            <div className="font-semibold mb-1">
              <Trans>You're offline</Trans>
            </div>
            <Trans>
              Moving organizational units is not possible while offline. Please
              reconnect to make changes.
            </Trans>
          </div>
        )}

        {/* Stale data indicator banner */}
        {!isOffline && isStale && (
          <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
            <Trans>Viewing cached data. Some units may be outdated.</Trans>
          </div>
        )}

        {/* Current parent info */}
        <div className="mb-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <Trans>Current parent:</Trans>
          </p>
          <p className="font-medium text-zinc-950 dark:text-zinc-50">
            {unit.parent ? (
              unit.parent.name
            ) : (
              <Trans>No parent (root unit)</Trans>
            )}
          </p>
        </div>

        {/* Load error */}
        {loadError && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
            <p className="text-sm text-red-800 dark:text-red-200">
              {loadError}
            </p>
          </div>
        )}

        {/* Parent selection */}
        {!loadError && (
          <Field>
            <FieldLabel>
              <Trans>New parent</Trans>
            </FieldLabel>
            <FieldDescription>
              <Trans>Choose a new parent unit or make this a root unit.</Trans>
            </FieldDescription>
            <Select
              value={toParentSelectValue(selectedParentId)}
              onValueChange={(nextValue) =>
                setSelectedParentId(fromParentSelectValue(nextValue))
              }
              disabled={isLoadingUnits || isMoving}
            >
              <SelectTrigger aria-label={t`Select new parent`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* Root option */}
                <SelectItem value={ROOT_PARENT_SELECT_VALUE}>
                  <RootIcon className="h-4 w-4" />
                  <span className="ml-2.5 truncate first:ml-0 sm:ml-2 sm:first:ml-0">
                    {t`Make root unit (no parent)`}
                  </span>
                </SelectItem>

                {/* Hierarchically sorted units with indentation and icons */}
                {sortedUnits.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    <span
                      className="flex items-center gap-2"
                      style={{ paddingLeft: `${u.depth * 16}px` }}
                    >
                      <UnitTypeIcon
                        type={u.type}
                        className="h-4 w-4 shrink-0"
                      />
                      <span className="truncate">{u.name}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        ({getTypeLabel(u.type)})
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {/* Move error */}
        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
      </DialogBody>

      <DialogActions>
        <Button variant="ghost" onClick={onClose} disabled={isMoving}>
          <Trans>Cancel</Trans>
        </Button>
        <Button onClick={handleMove} disabled={isMoveDisabled || isOffline}>
          {isMoving ? <Trans>Moving...</Trans> : <Trans>Move</Trans>}
        </Button>
      </DialogActions>
    </>
  );
}

export function MoveOrganizationalUnitDialog({
  open,
  unit,
  onClose,
  onSuccess,
}: MoveOrganizationalUnitDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent size="md">
          {!unit ? (
            <>
              <DialogBody>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  <Trans>No unit selected</Trans>
                </p>
              </DialogBody>
              <DialogActions>
                <Button onClick={onClose}>
                  <Trans>Close</Trans>
                </Button>
              </DialogActions>
            </>
          ) : open ? (
            <MoveOrganizationalUnitDialogContent
              key={`${unit.id}:${unit.parent?.id ?? "root"}`}
              unit={unit}
              onClose={onClose}
              onSuccess={onSuccess}
            />
          ) : null}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

export default MoveOrganizationalUnitDialog;
