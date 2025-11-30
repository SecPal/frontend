// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Trans } from "@lingui/macro";
import { Heading } from "../../components/heading";
import { Text } from "../../components/text";
import { OrganizationalUnitTree } from "../../components/OrganizationalUnitTree";
import type { OrganizationalUnit } from "../../types";

/**
 * Organization Page
 *
 * Displays the internal organizational structure (departments, branches, teams).
 * Part of Epic #228 - Organizational Structure Hierarchy.
 */
export function OrganizationPage() {
  const [selectedUnit, setSelectedUnit] = useState<OrganizationalUnit | null>(
    null
  );

  const handleSelect = (unit: OrganizationalUnit) => {
    setSelectedUnit(unit);
  };

  const handleEdit = (unit: OrganizationalUnit) => {
    // TODO: Open edit modal/dialog
    console.log("Edit unit:", unit);
  };

  const handleDelete = (unit: OrganizationalUnit) => {
    // TODO: Open delete confirmation dialog
    console.log("Delete unit:", unit);
  };

  const handleCreate = (parentId?: string) => {
    // TODO: Open create modal/dialog
    console.log("Create unit with parent:", parentId);
  };

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Tree View */}
        <div className="lg:col-span-2">
          <OrganizationalUnitTree
            onSelect={handleSelect}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreate={handleCreate}
            selectedId={selectedUnit?.id}
          />
        </div>

        {/* Detail Panel */}
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          {selectedUnit ? (
            <div className="space-y-4">
              <Heading level={3}>{selectedUnit.name}</Heading>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                    <Trans>Type</Trans>
                  </dt>
                  <dd className="text-zinc-900 dark:text-white">
                    {selectedUnit.type}
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
              </dl>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-center">
              <Text className="text-zinc-500">
                <Trans>Select an organizational unit to view details</Trans>
              </Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrganizationPage;
