// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useCallback, useEffect, lazy, Suspense, memo } from "react";
import { Trans, t } from "@lingui/macro";
import { Button } from "./button";
import { Badge } from "./badge";
import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
} from "./dropdown";
import { Heading, Subheading } from "./heading";
import { Text } from "./text";
import type {
  OrganizationalUnit,
  OrganizationalUnitType,
} from "../types/organizational";
import { listOrganizationalUnits } from "../services/organizationalUnitApi";
import {
  getTypeLabel,
  getTypeBadgeColor,
} from "../lib/organizationalUnitUtils";

// Lazy load heavy dialogs for better initial performance
const DeleteOrganizationalUnitDialog = lazy(() =>
  import("./DeleteOrganizationalUnitDialog").then((m) => ({
    default: m.DeleteOrganizationalUnitDialog,
  }))
);
const MoveOrganizationalUnitDialog = lazy(() =>
  import("./MoveOrganizationalUnitDialog").then((m) => ({
    default: m.MoveOrganizationalUnitDialog,
  }))
);

/**
 * Icon components for tree visualization
 */
function ChevronRightIcon({ className = "h-4 w-4" }: { className?: string }) {
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
        d="M8.25 4.5l7.5 7.5-7.5 7.5"
      />
    </svg>
  );
}

function ChevronDownIcon({ className = "h-4 w-4" }: { className?: string }) {
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
        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
      />
    </svg>
  );
}

function BuildingOfficeIcon({ className = "h-5 w-5" }: { className?: string }) {
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
        d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
      />
    </svg>
  );
}

function UsersIcon({ className = "h-5 w-5" }: { className?: string }) {
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
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    </svg>
  );
}

function MapPinIcon({ className = "h-5 w-5" }: { className?: string }) {
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
        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
      />
    </svg>
  );
}

/**
 * Get icon for organizational unit type
 */
function getUnitIcon(type: OrganizationalUnitType) {
  switch (type) {
    case "holding":
    case "company":
      return <BuildingOfficeIcon className="h-5 w-5 text-blue-500" />;
    case "department":
    case "division":
      return <UsersIcon className="h-5 w-5 text-green-500" />;
    case "branch":
      return <BuildingOfficeIcon className="h-5 w-5 text-purple-500" />;
    case "region":
      return <MapPinIcon className="h-5 w-5 text-orange-500" />;
    default:
      return <BuildingOfficeIcon className="h-5 w-5 text-gray-500" />;
  }
}

// Badge color is now provided by getTypeBadgeColor from organizationalUnitUtils

interface TreeNodeProps {
  unit: OrganizationalUnit;
  level: number;
  onSelect?: (unit: OrganizationalUnit) => void;
  onEdit?: (unit: OrganizationalUnit) => void;
  onDelete?: (unit: OrganizationalUnit) => void;
  onMove?: (unit: OrganizationalUnit) => void;
  onCreateChild?: (unit: OrganizationalUnit) => void;
  selectedId?: string | null;
}

/**
 * Single tree node component
 *
 * Performance: Memoized to prevent re-renders when unrelated tree nodes change
 */
const TreeNode = memo(
  function TreeNode({
    unit,
    level,
    onSelect,
    onEdit,
    onDelete,
    onMove,
    onCreateChild,
    selectedId,
  }: TreeNodeProps) {
    const [isExpanded, setIsExpanded] = useState(level < 2);
    const hasChildren = unit.children && unit.children.length > 0;
    const isSelected = selectedId === unit.id;

    const handleToggle = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
      },
      [isExpanded]
    );

    const handleSelect = useCallback(() => {
      onSelect?.(unit);
    }, [onSelect, unit]);

    const handleEdit = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit?.(unit);
      },
      [onEdit, unit]
    );

    const handleDelete = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete?.(unit);
      },
      [onDelete, unit]
    );

    const handleCreateChild = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onCreateChild?.(unit);
      },
      [onCreateChild, unit]
    );

    const handleMove = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onMove?.(unit);
      },
      [onMove, unit]
    );

    return (
      <div className="select-none">
        <div
          className={`group flex items-center gap-1.5 py-2 px-2 rounded-lg cursor-pointer transition-colors ${
            isSelected
              ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
              : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
          }`}
          style={{ paddingLeft: `${Math.min(level * 16, 64) + 8}px` }}
          onClick={handleSelect}
          role="treeitem"
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-selected={isSelected}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleSelect();
            }
          }}
        >
          {/* Expand/Collapse Button */}
          <button
            type="button"
            className={`shrink-0 p-0.5 rounded transition-colors ${
              hasChildren
                ? "hover:bg-gray-200 dark:hover:bg-gray-700"
                : "invisible"
            }`}
            onClick={handleToggle}
            aria-label={isExpanded ? t`Collapse` : t`Expand`}
          >
            {isExpanded ? (
              <ChevronDownIcon className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 text-gray-500" />
            )}
          </button>

          {/* Icon */}
          <span className="shrink-0">{getUnitIcon(unit.type)}</span>

          {/* Name */}
          <span className="flex-1 min-w-0 font-medium text-gray-900 dark:text-gray-100 truncate">
            {unit.name}
          </span>

          {/* Type Badge - hidden on small screens */}
          <span className="hidden sm:inline-flex shrink-0">
            <Badge color={getTypeBadgeColor(unit.type)}>
              {getTypeLabel(unit.type)}
            </Badge>
          </span>

          {/* Actions Menu */}
          {(onEdit || onDelete || onMove || onCreateChild) && (
            <Dropdown>
              <DropdownButton
                plain
                aria-label={t`Actions for ${unit.name}`}
                className="shrink-0 p-1"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <svg
                  className="h-5 w-5 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
                  />
                </svg>
              </DropdownButton>
              <DropdownMenu anchor="bottom end">
                {onCreateChild && (
                  <DropdownItem onClick={handleCreateChild}>
                    <svg
                      data-slot="icon"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                    <Trans>Add child</Trans>
                  </DropdownItem>
                )}
                {onEdit && (
                  <DropdownItem onClick={handleEdit}>
                    <svg
                      data-slot="icon"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                      />
                    </svg>
                    <Trans>Edit</Trans>
                  </DropdownItem>
                )}
                {onMove && (
                  <DropdownItem onClick={handleMove}>
                    <svg
                      data-slot="icon"
                      className="h-4 w-4"
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
                    <Trans>Move</Trans>
                  </DropdownItem>
                )}
                {onDelete && (
                  <DropdownItem onClick={handleDelete}>
                    <svg
                      data-slot="icon"
                      className="h-4 w-4 text-red-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                      />
                    </svg>
                    <span className="text-red-600 dark:text-red-400">
                      <Trans>Delete</Trans>
                    </span>
                  </DropdownItem>
                )}
              </DropdownMenu>
            </Dropdown>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div role="group">
            {unit.children!.map((child) => (
              <TreeNode
                key={child.id}
                unit={child}
                level={level + 1}
                onSelect={onSelect}
                onEdit={onEdit}
                onDelete={onDelete}
                onMove={onMove}
                onCreateChild={onCreateChild}
                selectedId={selectedId}
              />
            ))}
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison: only re-render if unit, selection, or callbacks change
    // This prevents cascading re-renders when sibling nodes update
    return (
      prevProps.unit === nextProps.unit &&
      prevProps.selectedId === nextProps.selectedId &&
      prevProps.level === nextProps.level &&
      prevProps.onSelect === nextProps.onSelect &&
      prevProps.onEdit === nextProps.onEdit &&
      prevProps.onDelete === nextProps.onDelete &&
      prevProps.onMove === nextProps.onMove &&
      prevProps.onCreateChild === nextProps.onCreateChild
    );
  }
);

/**
 * Optimistic UI helper: Add a new unit to the tree
 * @param units - Current tree structure
 * @param newUnit - Unit to add
 * @param parentId - Parent ID (null for root units)
 * @returns Updated tree with new unit inserted
 */
function addUnitToTree(
  units: OrganizationalUnit[],
  newUnit: OrganizationalUnit,
  parentId: string | null
): OrganizationalUnit[] {
  if (!parentId) {
    // Add as root unit, preserving existing children if any (for move operations)
    return [...units, { ...newUnit, children: newUnit.children || [] }];
  }

  // Add as child of parent
  return units.map((unit) => {
    if (unit.id === parentId) {
      return {
        ...unit,
        children: [
          ...(unit.children || []),
          { ...newUnit, children: newUnit.children || [] },
        ],
      };
    }
    if (unit.children && unit.children.length > 0) {
      return {
        ...unit,
        children: addUnitToTree(unit.children, newUnit, parentId),
      };
    }
    return unit;
  });
}

/**
 * Optimistic UI helper: Move a unit to a new parent in the tree
 * @param units - Current tree structure
 * @param unitId - ID of unit to move
 * @param newParentId - New parent ID (null for root)
 * @returns Updated tree with unit moved
 */
function moveUnitInTree(
  units: OrganizationalUnit[],
  unitId: string,
  newParentId: string | null
): OrganizationalUnit[] {
  // Step 1: Find and extract the unit to move (preserving its children!)
  let unitToMove: OrganizationalUnit | null = null;

  const extractUnit = (items: OrganizationalUnit[]): OrganizationalUnit[] => {
    return items
      .filter((item) => {
        if (item.id === unitId) {
          // Deep copy including children to preserve the subtree
          unitToMove = {
            ...item,
            children: item.children ? [...item.children] : undefined,
          };
          return false;
        }
        return true;
      })
      .map((item) => ({
        ...item,
        children: item.children ? extractUnit(item.children) : undefined,
      }));
  };

  const treeWithoutUnit = extractUnit(units);

  if (!unitToMove) {
    return units; // Unit not found, return unchanged
  }

  // Step 2: Insert the unit (with its children) at the new location
  return addUnitToTree(treeWithoutUnit, unitToMove, newParentId);
}

/**
 * Optimistic UI helper: Update a unit's properties in the tree
 * @param units - Current tree structure
 * @param updatedUnit - Unit with updated properties
 * @returns Updated tree with unit modified
 */
function updateUnitInTree(
  units: OrganizationalUnit[],
  updatedUnit: OrganizationalUnit
): OrganizationalUnit[] {
  return units.map((unit) => {
    if (unit.id === updatedUnit.id) {
      // Destructure to exclude children from updatedUnit, preserving tree structure
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { children: _unusedChildren, ...updates } = updatedUnit;
      return {
        ...unit,
        ...updates,
        children: unit.children, // Preserve existing children
      };
    }
    if (unit.children && unit.children.length > 0) {
      return {
        ...unit,
        children: updateUnitInTree(unit.children, updatedUnit),
      };
    }
    return unit;
  });
}

export interface OrganizationalUnitTreeProps {
  /** Callback when a unit is selected */
  onSelect?: (unit: OrganizationalUnit) => void;
  /** Callback when edit action is triggered */
  onEdit?: (unit: OrganizationalUnit) => void;
  /** Callback when delete action is triggered */
  onDelete?: (unit: OrganizationalUnit) => void;
  /** Callback when move action is triggered */
  onMove?: (unit: OrganizationalUnit) => void;
  /** Callback when create child action is triggered on a unit */
  onCreateChild?: (unit: OrganizationalUnit) => void;
  /** Callback when create action is triggered (root level) */
  onCreate?: () => void;
  /**
   * Optimistic UI: When provided, adds the newly created unit to the tree
   * without reloading. Should contain the created unit, its parent ID (null for root),
   * and a unique key to trigger updates.
   */
  createdUnit?: {
    unit: OrganizationalUnit;
    parentId: string | null;
    key: number;
  } | null;
  /**
   * Optimistic UI: When provided, updates the unit in the tree after editing
   * without reloading. Should contain the updated unit and a unique key.
   */
  updatedUnit?: { unit: OrganizationalUnit; key: number } | null;
  /** Currently selected unit ID */
  selectedId?: string | null;
  /** Filter by unit type */
  typeFilter?: OrganizationalUnitType;
  /** Show only root units (no children) */
  flatView?: boolean;
  /** CSS class name */
  className?: string;
  /** Custom title for the tree view (defaults to i18n "My Organization") */
  title?: string;
}

/**
 * Tree view component for displaying organizational hierarchy
 *
 * Features:
 * - Permission-filtered view: Users only see units they have access to
 * - Root units determined by API's `root_unit_ids` metadata
 * - Hierarchical tree view with expand/collapse
 * - Icons for different unit types
 * - Selection support
 * - Edit/Delete actions
 * - Loading and error states
 * - Empty state
 *
 * @see ADR-007: Organizational Structure Hierarchy
 */
export function OrganizationalUnitTree({
  onSelect,
  onEdit,
  onDelete,
  onMove,
  onCreateChild,
  onCreate,
  createdUnit,
  updatedUnit,
  selectedId,
  typeFilter,
  flatView = false,
  className = "",
  title,
}: OrganizationalUnitTreeProps) {
  const [units, setUnits] = useState<OrganizationalUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<OrganizationalUnit | null>(
    null
  );
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [unitToMove, setUnitToMove] = useState<OrganizationalUnit | null>(null);

  const loadUnits = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load accessible units - API returns permission-filtered results with root_unit_ids
      const response = await listOrganizationalUnits({
        type: typeFilter,
        per_page: 100,
      });

      if (flatView) {
        setUnits(response.data);
      } else {
        // Build tree using root_unit_ids from API response
        const buildTree = (
          items: OrganizationalUnit[],
          rootUnitIds: string[]
        ): OrganizationalUnit[] => {
          const itemMap = new Map<string, OrganizationalUnit>();

          // First pass: create map with empty children arrays
          items.forEach((item) => {
            itemMap.set(item.id, { ...item, children: [] });
          });

          // Second pass: build tree structure
          const rootItems: OrganizationalUnit[] = [];
          items.forEach((item) => {
            const node = itemMap.get(item.id)!;
            if (item.parent?.id && itemMap.has(item.parent.id)) {
              // Has accessible parent - add as child
              const parent = itemMap.get(item.parent.id)!;
              parent.children = parent.children || [];
              parent.children.push(node);
            } else if (rootUnitIds.includes(item.id)) {
              // Either no parent (true root) or parent inaccessible (designated root)
              rootItems.push(node);
            }
            // Units with parents that aren't accessible and aren't in rootUnitIds are ignored
          });

          return rootItems;
        };

        // Use root_unit_ids from API response (defaults to empty array for safety)
        const rootUnitIds = response.meta.root_unit_ids || [];
        setUnits(buildTree(response.data, rootUnitIds));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t`Failed to load organizational units`
      );
    } finally {
      setIsLoading(false);
    }
  }, [flatView, typeFilter]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  // Optimistic UI: Handle newly created unit from parent component
  // Uses key property to ensure each create triggers the effect
  useEffect(() => {
    if (createdUnit) {
      setUnits((prevUnits) =>
        addUnitToTree(prevUnits, createdUnit.unit, createdUnit.parentId)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdUnit?.key]);

  // Optimistic UI: Handle updated unit from parent component
  // Uses key property to ensure each update triggers the effect
  useEffect(() => {
    if (updatedUnit) {
      setUnits((prevUnits) => updateUnitInTree(prevUnits, updatedUnit.unit));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatedUnit?.key]);

  const handleDeleteClick = useCallback((unit: OrganizationalUnit) => {
    setUnitToDelete(unit);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteSuccess = useCallback(() => {
    if (!unitToDelete) return;

    // Optimistic UI update: Remove the deleted unit from local state
    // This avoids reloading the entire tree (Issue #303)
    setUnits((prevUnits) => {
      const removeUnit = (
        units: OrganizationalUnit[]
      ): OrganizationalUnit[] => {
        return units
          .filter((unit) => unit.id !== unitToDelete.id)
          .map((unit) => ({
            ...unit,
            children: unit.children ? removeUnit(unit.children) : undefined,
          }));
      };
      return removeUnit(prevUnits);
    });

    // Notify parent component
    onDelete?.(unitToDelete);
  }, [onDelete, unitToDelete]);

  const handleDeleteDialogClose = useCallback(() => {
    setDeleteDialogOpen(false);
    // Note: We intentionally don't reset unitToDelete here to prevent
    // content flickering during the dialog's close animation.
    // The unit will be overwritten when a new delete is triggered.
  }, []);

  const handleMoveClick = useCallback((unit: OrganizationalUnit) => {
    setUnitToMove(unit);
    setMoveDialogOpen(true);
  }, []);

  const handleMoveSuccess = useCallback(
    (newParentId: string) => {
      if (!unitToMove) return;

      // Optimistic UI update: Move the unit in local state
      // This avoids reloading the entire tree (Issue #303)
      setUnits((prevUnits) =>
        moveUnitInTree(
          prevUnits,
          unitToMove.id,
          newParentId === "" ? null : newParentId
        )
      );

      // Notify parent component
      onMove?.(unitToMove);
    },
    [onMove, unitToMove]
  );

  const handleMoveDialogClose = useCallback(() => {
    setMoveDialogOpen(false);
    // Note: We intentionally don't reset unitToMove here to prevent
    // content flickering during the dialog's close animation.
    // The unit will be overwritten when a new move is triggered.
  }, []);

  if (isLoading) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`${className} text-red-600 dark:text-red-400 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg`}
      >
        <Text>{error}</Text>
        <Button plain onClick={loadUnits} className="mt-2">
          <Trans>Retry</Trans>
        </Button>
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div
        className={`${className} text-center py-8 text-gray-500 dark:text-gray-400`}
      >
        <BuildingOfficeIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <Subheading>
          <Trans>No Organizational Units</Trans>
        </Subheading>
        <Text className="mt-2">
          <Trans>Get started by creating your first organizational unit.</Trans>
        </Text>
        {onCreate && (
          <Button onClick={onCreate} className="mt-4">
            <Trans>Create Organizational Unit</Trans>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <Heading level={3}>{title || <Trans>My Organization</Trans>}</Heading>
        {onCreate && (
          <Button onClick={onCreate}>
            <Trans>Add Root Unit</Trans>
          </Button>
        )}
      </div>

      <div
        role="tree"
        aria-label={t`Organizational structure`}
        className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800"
      >
        {units.map((unit) => (
          <TreeNode
            key={unit.id}
            unit={unit}
            level={0}
            onSelect={onSelect}
            onEdit={onEdit}
            onDelete={handleDeleteClick}
            onMove={onMove ? handleMoveClick : undefined}
            onCreateChild={onCreateChild}
            selectedId={selectedId}
          />
        ))}
      </div>

      {/* Delete Confirmation Dialog - Lazy loaded */}
      {deleteDialogOpen && (
        <Suspense fallback={<div />}>
          <DeleteOrganizationalUnitDialog
            open={deleteDialogOpen}
            unit={unitToDelete}
            onClose={handleDeleteDialogClose}
            onSuccess={handleDeleteSuccess}
          />
        </Suspense>
      )}

      {/* Move/Reparent Dialog - Lazy loaded */}
      {moveDialogOpen && (
        <Suspense fallback={<div />}>
          <MoveOrganizationalUnitDialog
            open={moveDialogOpen}
            unit={unitToMove}
            onClose={handleMoveDialogClose}
            onSuccess={handleMoveSuccess}
          />
        </Suspense>
      )}
    </div>
  );
}

export default OrganizationalUnitTree;
