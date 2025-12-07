// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  lazy,
  Suspense,
} from "react";
import { Trans, t } from "@lingui/macro";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Heading } from "../../components/heading";
import { Text } from "../../components/text";
import { Button } from "../../components/button";
import { Badge } from "../../components/badge";
import { OrganizationalUnitTree } from "../../components/OrganizationalUnitTree";
import { SpinnerContainer } from "../../components/spinner";

// Lazy load dialog for better performance
const OrganizationalUnitFormDialog = lazy(() =>
  import("../../components/OrganizationalUnitFormDialog").then((m) => ({
    default: m.OrganizationalUnitFormDialog,
  }))
);
import {
  getTypeLabel,
  getTypeBadgeColor,
} from "../../lib/organizationalUnitUtils";
import type { OrganizationalUnit } from "../../types";
import { useOrganizationalUnitsWithOffline } from "../../hooks/useOrganizationalUnitsWithOffline";

/**
 * Optimistic UI state for tree updates without reloading
 * @see Issue #303: UX improvement - avoid full tree reload
 * Each update has a unique key to ensure React triggers the useEffect
 */
interface OptimisticTreeUpdate {
  createdUnit: {
    unit: OrganizationalUnit;
    parentId: string | null;
    key: number;
  } | null;
  updatedUnit: { unit: OrganizationalUnit; key: number } | null;
}

/**
 * Organization Page
 *
 * Displays the internal organizational structure (departments, branches, teams).
 * Features Create/Edit functionality via modal dialogs.
 * Fully offline-capable: Data is cached in IndexedDB and available offline.
 *
 * Part of Epic #228 - Organizational Structure Hierarchy.
 * @see Issue #294: Frontend: Organizational unit Create/Edit forms
 * @see Issue #306: Detail panel close functionality (close button, ESC key, toggle selection)
 * @see Issue #283: Epic - Organizational Structure Management (CRUD) - Offline Support
 */
export function OrganizationPage() {
  // Offline-first organizational units hook
  const { isOffline, isStale } = useOrganizationalUnitsWithOffline();
  const [selectedUnit, setSelectedUnit] = useState<OrganizationalUnit | null>(
    null
  );

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogParentId, setDialogParentId] = useState<string | null>(null);
  const [dialogParentName, setDialogParentName] = useState<string | null>(null);
  const [dialogParentType, setDialogParentType] = useState<
    OrganizationalUnit["type"] | null
  >(null);
  const [editingUnit, setEditingUnit] = useState<OrganizationalUnit | null>(
    null
  );

  // Success toast state
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Optimistic UI state for tree updates (Issue #303)
  const [optimisticUpdate, setOptimisticUpdate] =
    useState<OptimisticTreeUpdate>({
      createdUnit: null,
      updatedUnit: null,
    });

  // Ref for timeout cleanup
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref for click-outside detection
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  // ESC key handler to close detail panel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedUnit) {
        setSelectedUnit(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedUnit]);

  // Click-outside handler to close detail panel
  // Note: Skip when dialog is open, as dialogs are rendered via Portal outside the grid
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectedUnit &&
        !dialogOpen &&
        gridContainerRef.current &&
        !gridContainerRef.current.contains(event.target as Node)
      ) {
        setSelectedUnit(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedUnit, dialogOpen]);

  // Toggle selection: clicking the same unit deselects it
  const handleSelect = useCallback(
    (unit: OrganizationalUnit) => {
      if (selectedUnit?.id === unit.id) {
        setSelectedUnit(null);
      } else {
        setSelectedUnit(unit);
      }
    },
    [selectedUnit?.id]
  );

  // Close detail panel handler
  const handleCloseDetail = useCallback(() => {
    setSelectedUnit(null);
  }, []);

  const handleEdit = useCallback((unit: OrganizationalUnit) => {
    setDialogMode("edit");
    setEditingUnit(unit);
    setDialogParentId(null);
    setDialogParentName(null);
    setDialogParentType(null);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    (unit: OrganizationalUnit) => {
      // Delete is handled by OrganizationalUnitTree internally
      // This callback is for post-delete actions
      if (unit.id === selectedUnit?.id) {
        setSelectedUnit(null);
      }
    },
    [selectedUnit?.id]
  );

  const handleCreate = useCallback(() => {
    // Create at root level (no parent)
    setDialogMode("create");
    setEditingUnit(null);
    setDialogParentId(null);
    setDialogParentName(null);
    setDialogParentType(null);
    setDialogOpen(true);
  }, []);

  const handleCreateChild = useCallback((unit: OrganizationalUnit) => {
    setDialogMode("create");
    setEditingUnit(null);
    setDialogParentId(unit.id);
    setDialogParentName(unit.name);
    setDialogParentType(unit.type);
    setDialogOpen(true);
  }, []);

  const handleMove = useCallback(() => {
    // Move is handled with optimistic UI in OrganizationalUnitTree
    // This callback is for post-move actions
    setSelectedUnit(null);
  }, []);

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setEditingUnit(null);
  }, []);

  const handleDialogSuccess = useCallback(
    (unit: OrganizationalUnit) => {
      // Optimistic UI update (Issue #303) - update tree without reload
      // Use Date.now() as key to ensure each update triggers useEffect
      if (dialogMode === "create") {
        setOptimisticUpdate({
          createdUnit: { unit, parentId: dialogParentId, key: Date.now() },
          updatedUnit: null,
        });
      } else {
        setOptimisticUpdate({
          createdUnit: null,
          updatedUnit: { unit, key: Date.now() },
        });
        // Update selected unit if editing
        setSelectedUnit(unit);
      }

      // Show success message
      const message =
        dialogMode === "create"
          ? t`"${unit.name}" created successfully`
          : t`"${unit.name}" updated successfully`;
      setSuccessMessage(message);

      // Clear any existing timeout before setting a new one
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setSuccessMessage(null);
        successTimeoutRef.current = null;
      }, 3000);
    },
    [dialogMode, dialogParentId]
  );

  return (
    <div className="space-y-6">
      <div>
        <Heading>
          <Trans>Organization Structure</Trans>
        </Heading>
        <Text className="mt-2">
          <Trans>
            Manage your internal organizational units including departments,
            branches, and teams.
          </Trans>
        </Text>
      </div>

      {/* Offline indicator banner */}
      {isOffline && (
        <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
          <Trans>You're offline. Viewing cached organizational units.</Trans>
        </div>
      )}

      {/* Stale data indicator banner */}
      {!isOffline && isStale && (
        <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
          <Trans>
            Viewing cached data. Some organizational units may be outdated.
          </Trans>
        </div>
      )}

      {/* Success toast */}
      {successMessage && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {successMessage}
        </div>
      )}

      <div
        ref={gridContainerRef}
        className="grid grid-cols-1 gap-6 lg:grid-cols-3"
      >
        {/* Tree View */}
        <div className="lg:col-span-2">
          <OrganizationalUnitTree
            onSelect={handleSelect}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreateChild={handleCreateChild}
            onCreate={handleCreate}
            onMove={handleMove}
            createdUnit={optimisticUpdate.createdUnit}
            updatedUnit={optimisticUpdate.updatedUnit}
            selectedId={selectedUnit?.id}
          />
        </div>

        {/* Detail Panel */}
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          {selectedUnit ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <Heading level={3}>{selectedUnit.name}</Heading>
                <div className="flex items-center gap-2">
                  <Badge color={getTypeBadgeColor(selectedUnit.type)}>
                    {getTypeLabel(selectedUnit.type)}
                  </Badge>
                  <button
                    type="button"
                    onClick={handleCloseDetail}
                    className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                    aria-label={t`Close detail panel`}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                    <Trans>Type</Trans>
                  </dt>
                  <dd className="text-zinc-900 dark:text-white">
                    {getTypeLabel(selectedUnit.type)}
                  </dd>
                </div>
                {selectedUnit.description && (
                  <div>
                    <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                      <Trans>Description</Trans>
                    </dt>
                    <dd className="text-zinc-900 dark:text-white">
                      {selectedUnit.description}
                    </dd>
                  </div>
                )}
                {selectedUnit.parent && (
                  <div>
                    <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                      <Trans>Parent</Trans>
                    </dt>
                    <dd className="text-zinc-900 dark:text-white">
                      {selectedUnit.parent.name}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                    <Trans>Created</Trans>
                  </dt>
                  <dd className="text-zinc-900 dark:text-white">
                    {new Date(selectedUnit.created_at).toLocaleDateString()}
                  </dd>
                </div>
              </dl>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                <Button onClick={() => handleEdit(selectedUnit)}>
                  <Trans>Edit</Trans>
                </Button>
                <Button outline onClick={() => handleCreateChild(selectedUnit)}>
                  <Trans>Add Child Unit</Trans>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center text-center">
              <Text className="text-zinc-500">
                <Trans>Select an organizational unit to view details</Trans>
              </Text>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog - Lazy loaded for better performance */}
      <Suspense
        fallback={
          <SpinnerContainer className="fixed inset-0 bg-zinc-950/25 dark:bg-zinc-950/50" />
        }
      >
        <OrganizationalUnitFormDialog
          open={dialogOpen}
          onClose={handleDialogClose}
          mode={dialogMode}
          parentId={dialogParentId}
          parentName={dialogParentName}
          parentType={dialogParentType}
          unit={editingUnit}
          onSuccess={handleDialogSuccess}
        />
      </Suspense>
    </div>
  );
}

export default OrganizationPage;
