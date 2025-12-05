// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback, useMemo } from "react";
import { Trans, t } from "@lingui/macro";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogActions,
} from "./dialog";
import { Button } from "./button";
import { Listbox, ListboxOption, ListboxLabel } from "./listbox";
import { Field, Label, Description } from "./fieldset";
import { Text } from "./text";
import type {
  OrganizationalUnit,
  OrganizationalUnitType,
} from "../types/organizational";
import {
  listOrganizationalUnits,
  attachOrganizationalUnitParent,
  detachOrganizationalUnitParent,
} from "../services/organizationalUnitApi";
import { getTypeLabel } from "../lib/organizationalUnitUtils";

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
        <svg
          className={`${className} text-blue-500`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          data-slot="icon"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
          />
        </svg>
      );
    case "department":
    case "division":
      return (
        <svg
          className={`${className} text-green-500`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          data-slot="icon"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
          />
        </svg>
      );
    case "branch":
      return (
        <svg
          className={`${className} text-purple-500`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          data-slot="icon"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
          />
        </svg>
      );
    case "region":
      return (
        <svg
          className={`${className} text-orange-500`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          data-slot="icon"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
          />
        </svg>
      );
    default:
      return (
        <svg
          className={`${className} text-gray-500`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          data-slot="icon"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
          />
        </svg>
      );
  }
}

/**
 * Root icon for the "no parent" option
 */
function RootIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`${className} text-gray-400`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      data-slot="icon"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
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

  // Load available units when dialog opens
  const loadUnits = useCallback(async () => {
    if (!unit) return;

    setIsLoading(true);
    setLoadError(null);

    try {
      // Fetch all units with pagination to avoid missing parent options for large orgs
      let allUnits: OrganizationalUnit[] = [];
      let page = 1;
      let hasMore = true;
      const perPage = 100;

      while (hasMore) {
        const response = await listOrganizationalUnits({
          per_page: perPage,
          page,
        });
        allUnits = allUnits.concat(response.data);
        // If fewer than perPage returned, we've reached the last page
        hasMore = response.data.length === perPage;
        page += 1;
      }

      // Filter out the unit itself (can't be its own parent)
      // Note: Backend API will prevent circular references with 409 Conflict
      const filtered = allUnits.filter((u) => u.id !== unit.id);

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
            <Listbox
              value={selectedParentId}
              onChange={setSelectedParentId}
              disabled={isLoading || isMoving}
              aria-label={t`Select new parent`}
            >
              {/* Root option */}
              <ListboxOption value="">
                <RootIcon className="h-4 w-4" />
                <ListboxLabel>{t`Make root unit (no parent)`}</ListboxLabel>
              </ListboxOption>

              {/* Hierarchically sorted units with indentation and icons */}
              {sortedUnits.map((u) => (
                <ListboxOption key={u.id} value={u.id}>
                  <span
                    className="flex items-center gap-2"
                    style={{ paddingLeft: `${u.depth * 16}px` }}
                  >
                    <UnitTypeIcon type={u.type} className="h-4 w-4 shrink-0" />
                    <span className="truncate">{u.name}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      ({getTypeLabel(u.type)})
                    </span>
                  </span>
                </ListboxOption>
              ))}
            </Listbox>
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
