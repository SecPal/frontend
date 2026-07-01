// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useCallback, useMemo, lazy, Suspense, memo } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  EllipsisVertical,
  MoveHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  LoadingRegion,
  OrganizationalUnitTypeBadge,
  SectionSkeleton,
} from "@/ui";
import type {
  OrganizationalUnit,
  OrganizationalUnitType,
} from "../types/organizational";
import { useOrganizationalUnitsWithOffline } from "../hooks/useOrganizationalUnitsWithOffline";
import { OrganizationalUnitTypeIcon } from "./organizationalUnitIcons";

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
 * Get icon for organizational unit type
 */
// Badge rendering is provided by the shared ui primitive.

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
    const canCreateChild =
      !!onCreateChild && unit.permissions?.create_child === true;
    const canUpdate = unit.permissions?.update === true;
    const canEdit = !!onEdit && canUpdate;
    const canMove = !!onMove && canUpdate;
    const canDelete = !!onDelete && unit.permissions?.delete === true;
    const hasActions = canEdit || canDelete || canMove || canCreateChild;

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
            isSelected ? "border-primary/30 bg-primary/10" : "hover:bg-muted"
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
              hasChildren ? "hover:bg-accent" : "invisible"
            }`}
            onClick={handleToggle}
            aria-label={isExpanded ? t`Collapse` : t`Expand`}
          >
            {isExpanded ? (
              <ChevronDown className="text-muted-foreground h-4 w-4" />
            ) : (
              <ChevronRight className="text-muted-foreground h-4 w-4" />
            )}
          </button>

          {/* Icon */}
          <span className="shrink-0">
            <OrganizationalUnitTypeIcon type={unit.type} className="h-5 w-5" />
          </span>

          {/* Name */}
          <span className="text-foreground flex-1 min-w-0 truncate font-medium">
            {unit.name}
          </span>

          {/* Type Badge - hidden on small screens */}
          <span className="hidden sm:inline-flex shrink-0">
            <OrganizationalUnitTypeBadge type={unit.type} />
          </span>

          {/* Actions Menu */}
          {hasActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t`Actions for ${unit.name}`}
                  className="shrink-0 rounded-md p-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <EllipsisVertical className="text-muted-foreground h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent anchor="bottom end">
                {canCreateChild && (
                  <DropdownMenuItem onClick={handleCreateChild}>
                    <Plus data-slot="icon" className="h-4 w-4" />
                    <Trans>Add child</Trans>
                  </DropdownMenuItem>
                )}
                {canEdit && (
                  <DropdownMenuItem onClick={handleEdit}>
                    <Pencil data-slot="icon" className="h-4 w-4" />
                    <Trans>Edit</Trans>
                  </DropdownMenuItem>
                )}
                {canMove && (
                  <DropdownMenuItem onClick={handleMove}>
                    <MoveHorizontal data-slot="icon" className="h-4 w-4" />
                    <Trans>Move</Trans>
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem onClick={handleDelete}>
                    <Trash2 data-slot="icon" className="h-4 w-4 text-red-500" />
                    <span className="text-destructive">
                      <Trans>Delete</Trans>
                    </span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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

function upsertCreatedUnitInTree(
  units: OrganizationalUnit[],
  createdUnit: { unit: OrganizationalUnit; parentId: string | null }
): OrganizationalUnit[] {
  if (findUnitInTree(units, createdUnit.unit.id)) {
    return units;
  }

  return addUnitToTree(units, createdUnit.unit, createdUnit.parentId);
}

function findUnitInTree(
  units: OrganizationalUnit[],
  unitId: string
): OrganizationalUnit | null {
  for (const unit of units) {
    if (unit.id === unitId) {
      return unit;
    }

    if (unit.children && unit.children.length > 0) {
      const nestedMatch = findUnitInTree(unit.children, unitId);
      if (nestedMatch) {
        return nestedMatch;
      }
    }
  }

  return null;
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

  if (unitToMove === null) {
    return units; // Unit not found, return unchanged
  }

  const extractedUnit = unitToMove as OrganizationalUnit;

  const nextParent = newParentId
    ? findUnitInTree(treeWithoutUnit, newParentId)
    : null;

  const movedUnit: OrganizationalUnit = {
    ...extractedUnit,
    parent: nextParent
      ? {
          id: nextParent.id,
          type: nextParent.type,
          name: nextParent.name,
          created_at: nextParent.created_at,
          updated_at: nextParent.updated_at,
        }
      : undefined,
  };

  // Step 2: Insert the unit (with its children) at the new location
  return addUnitToTree(treeWithoutUnit, movedUnit, newParentId);
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

function removeUnitFromTree(
  units: OrganizationalUnit[],
  unitId: string
): OrganizationalUnit[] {
  return units
    .filter((unit) => unit.id !== unitId)
    .map((unit) => ({
      ...unit,
      children: unit.children
        ? removeUnitFromTree(unit.children, unitId)
        : undefined,
    }));
}

function buildTreeUnits(
  items: OrganizationalUnit[],
  rootUnitIds: string[],
  typeFilter?: OrganizationalUnitType,
  flatView = false
): OrganizationalUnit[] {
  if (items.length === 0) {
    return [];
  }

  if (flatView) {
    return typeFilter
      ? items.filter((item) => item.type === typeFilter)
      : items;
  }

  const itemMap = new Map<string, OrganizationalUnit>();
  const filteredItems = typeFilter
    ? items.filter((item) => item.type === typeFilter)
    : items;

  filteredItems.forEach((item) => {
    itemMap.set(item.id, { ...item, children: [] });
  });

  const rootItems: OrganizationalUnit[] = [];
  filteredItems.forEach((item) => {
    const node = itemMap.get(item.id)!;
    if (item.parent?.id && itemMap.has(item.parent.id)) {
      const parent = itemMap.get(item.parent.id)!;
      parent.children = parent.children || [];
      parent.children.push(node);
    } else if (rootUnitIds.length === 0 || rootUnitIds.includes(item.id)) {
      rootItems.push(node);
    }
  });

  return rootItems;
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
   * Optimistic UI: When provided, applies multiple pending creations in order.
   * Used when the parent component needs to preserve back-to-back creations until
   * the offline hook refresh catches up.
   */
  createdUnits?: Array<{
    unit: OrganizationalUnit;
    parentId: string | null;
    key: number;
  }>;
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
  createdUnits,
  updatedUnit,
  selectedId,
  typeFilter,
  flatView = false,
  className = "",
  title,
}: OrganizationalUnitTreeProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<OrganizationalUnit | null>(
    null
  );
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [unitToMove, setUnitToMove] = useState<OrganizationalUnit | null>(null);
  const [locallyDeletedUnitIds, setLocallyDeletedUnitIds] = useState<string[]>(
    []
  );
  const [locallyMovedParents, setLocallyMovedParents] = useState<
    Record<string, string | null>
  >({});

  // Use offline-first hook for organizational units
  const {
    units: rawUnits,
    loading: isLoading,
    error: hookError,
    rootUnitIds: apiRootUnitIds,
    refresh,
  } = useOrganizationalUnitsWithOffline();

  const error = hookError;

  const baseUnits = useMemo(
    () => buildTreeUnits(rawUnits, apiRootUnitIds, typeFilter, flatView),
    [rawUnits, apiRootUnitIds, typeFilter, flatView]
  );

  const units = useMemo(() => {
    let nextUnits = baseUnits;
    const pendingCreatedUnits =
      createdUnits ?? (createdUnit ? [createdUnit] : []);

    for (const pendingCreatedUnit of pendingCreatedUnits) {
      nextUnits = upsertCreatedUnitInTree(nextUnits, pendingCreatedUnit);
    }

    if (updatedUnit) {
      nextUnits = updateUnitInTree(nextUnits, updatedUnit.unit);
    }

    for (const deletedUnitId of locallyDeletedUnitIds) {
      nextUnits = removeUnitFromTree(nextUnits, deletedUnitId);
    }

    for (const [unitId, newParentId] of Object.entries(locallyMovedParents)) {
      nextUnits = moveUnitInTree(nextUnits, unitId, newParentId);
    }

    return nextUnits;
  }, [
    baseUnits,
    createdUnit,
    createdUnits,
    updatedUnit,
    locallyDeletedUnitIds,
    locallyMovedParents,
  ]);

  const handleDeleteClick = useCallback((unit: OrganizationalUnit) => {
    setUnitToDelete(unit);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteSuccess = useCallback(() => {
    if (!unitToDelete) return;

    setLocallyDeletedUnitIds((current) =>
      current.includes(unitToDelete.id)
        ? current
        : [...current, unitToDelete.id]
    );

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

      setLocallyMovedParents((current) => ({
        ...current,
        [unitToMove.id]: newParentId === "" ? null : newParentId,
      }));

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

  const loadingLabel = t`Loading organizational structure`;
  const showInitialSkeleton = isLoading && units.length === 0 && !error;
  const showTree = units.length > 0;

  if (error && !showTree) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-foreground text-lg font-semibold tracking-normal">
            {title || <Trans>My Organization</Trans>}
          </h2>
          {onCreate && (
            <Button onClick={onCreate}>
              <Trans>Add Root Unit</Trans>
            </Button>
          )}
        </div>

        <Card className="border-destructive/30 bg-destructive/10 text-destructive">
          <CardContent className="p-4">
            <p className="text-sm">{error}</p>
            <Button variant="ghost" onClick={refresh} className="mt-2">
              <Trans>Retry</Trans>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!showInitialSkeleton && !showTree) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-foreground text-lg font-semibold tracking-normal">
            {title || <Trans>My Organization</Trans>}
          </h2>
          {onCreate && (
            <Button onClick={onCreate}>
              <Trans>Add Root Unit</Trans>
            </Button>
          )}
        </div>

        <div className="text-muted-foreground py-8 text-center">
          <Building2 className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h2 className="text-foreground text-base font-semibold">
            <Trans>No Organizational Units</Trans>
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            <Trans>
              Get started by creating your first organizational unit.
            </Trans>
          </p>
          {onCreate && (
            <Button onClick={onCreate} className="mt-4">
              <Trans>Create Organizational Unit</Trans>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-foreground text-lg font-semibold tracking-normal">
          {title || <Trans>My Organization</Trans>}
        </h2>
        {onCreate && (
          <Button onClick={onCreate}>
            <Trans>Add Root Unit</Trans>
          </Button>
        )}
      </div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/10 text-destructive mb-4">
          <CardContent className="p-4">
            <p className="text-sm">{error}</p>
            <Button variant="ghost" onClick={refresh} className="mt-2">
              <Trans>Retry</Trans>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <LoadingRegion
        loading={isLoading && showTree}
        loadingLabel={loadingLabel}
      >
        {showInitialSkeleton ? (
          <SectionSkeleton
            loadingLabel={loadingLabel}
            rows={5}
            showHeader={false}
            className="border-border"
          />
        ) : (
          <div
            role="tree"
            aria-label={t`Organizational structure`}
            className="border-border divide-border rounded-lg border divide-y"
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
        )}
      </LoadingRegion>

      {/* Delete Confirmation Dialog - Lazy loaded */}
      <Suspense fallback={<div />}>
        <DeleteOrganizationalUnitDialog
          open={deleteDialogOpen}
          unit={unitToDelete}
          onClose={handleDeleteDialogClose}
          onSuccess={handleDeleteSuccess}
        />
      </Suspense>

      {/* Move/Reparent Dialog - Lazy loaded */}
      <Suspense fallback={<div />}>
        <MoveOrganizationalUnitDialog
          open={moveDialogOpen}
          unit={unitToMove}
          onClose={handleMoveDialogClose}
          onSuccess={handleMoveSuccess}
        />
      </Suspense>
    </div>
  );
}

export default OrganizationalUnitTree;
