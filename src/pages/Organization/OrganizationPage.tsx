// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useCallback, useRef } from "react";
import { Trans, t } from "@lingui/macro";
import { Heading } from "../../components/heading";
import { Text } from "../../components/text";
import { Button } from "../../components/button";
import { Badge } from "../../components/badge";
import { OrganizationalUnitTree } from "../../components/OrganizationalUnitTree";
import { OrganizationalUnitFormDialog } from "../../components/OrganizationalUnitFormDialog";
import type { OrganizationalUnit } from "../../types";

/**
 * Type label mapping for display
 */
const TYPE_LABELS: Record<string, string> = {
  holding: "Holding",
  company: "Unternehmen",
  region: "Region",
  branch: "Niederlassung",
  division: "Abteilung",
  department: "Bereich",
  custom: "Benutzerdefiniert",
};

/**
 * Organization Page
 *
 * Displays the internal organizational structure (departments, branches, teams).
 * Features Create/Edit functionality via modal dialogs.
 *
 * Part of Epic #228 - Organizational Structure Hierarchy.
 * @see Issue #294: Frontend: Organizational unit Create/Edit forms
 */
export function OrganizationPage() {
  const [selectedUnit, setSelectedUnit] = useState<OrganizationalUnit | null>(
    null
  );

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogParentId, setDialogParentId] = useState<string | null>(null);
  const [dialogParentName, setDialogParentName] = useState<string | null>(null);
  const [editingUnit, setEditingUnit] = useState<OrganizationalUnit | null>(
    null
  );

  // Success toast state
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Ref to trigger tree refresh
  const treeRefreshKey = useRef(0);
  const [, setRefreshTrigger] = useState(0);

  const handleSelect = useCallback((unit: OrganizationalUnit) => {
    setSelectedUnit(unit);
  }, []);

  const handleEdit = useCallback((unit: OrganizationalUnit) => {
    setDialogMode("edit");
    setEditingUnit(unit);
    setDialogParentId(null);
    setDialogParentName(null);
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
    setDialogOpen(true);
  }, []);

  const handleCreateChild = useCallback(() => {
    if (!selectedUnit) return;
    setDialogMode("create");
    setEditingUnit(null);
    setDialogParentId(selectedUnit.id);
    setDialogParentName(selectedUnit.name);
    setDialogOpen(true);
  }, [selectedUnit]);

  const handleDialogClose = useCallback(() => {
    setDialogOpen(false);
    setEditingUnit(null);
  }, []);

  const handleDialogSuccess = useCallback(
    (unit: OrganizationalUnit) => {
      // Refresh tree
      treeRefreshKey.current += 1;
      setRefreshTrigger((prev) => prev + 1);

      // Show success message
      const message =
        dialogMode === "create"
          ? t`"${unit.name}" created successfully`
          : t`"${unit.name}" updated successfully`;
      setSuccessMessage(message);
      setTimeout(() => setSuccessMessage(null), 3000);

      // Update selected unit if editing
      if (dialogMode === "edit") {
        setSelectedUnit(unit);
      }
    },
    [dialogMode]
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

      {/* Success toast */}
      {successMessage && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Tree View */}
        <div className="lg:col-span-2">
          <OrganizationalUnitTree
            key={treeRefreshKey.current}
            onSelect={handleSelect}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreateChild={handleCreateChild}
            onCreate={handleCreate}
            selectedId={selectedUnit?.id}
          />
        </div>

        {/* Detail Panel */}
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          {selectedUnit ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <Heading level={3}>{selectedUnit.name}</Heading>
                <Badge color="blue">
                  {TYPE_LABELS[selectedUnit.type] || selectedUnit.type}
                </Badge>
              </div>

              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                    <Trans>Type</Trans>
                  </dt>
                  <dd className="text-zinc-900 dark:text-white">
                    {TYPE_LABELS[selectedUnit.type] || selectedUnit.type}
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
                <Button outline onClick={handleCreateChild}>
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

      {/* Create/Edit Dialog */}
      <OrganizationalUnitFormDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        mode={dialogMode}
        parentId={dialogParentId}
        parentName={dialogParentName}
        unit={editingUnit}
        onSuccess={handleDialogSuccess}
      />
    </div>
  );
}

export default OrganizationPage;
