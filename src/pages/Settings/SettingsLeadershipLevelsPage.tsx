// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useCallback } from "react";
import { Trans } from "@lingui/macro";
import { Heading } from "../../components/heading";
import { Text } from "../../components/text";
import { LeadershipLevelList } from "../../components/LeadershipLevelList";
import { LeadershipLevelForm } from "../../components/LeadershipLevelForm";
import type { LeadershipLevel } from "../../types/leadershipLevel";

/**
 * Settings - Leadership Levels Page
 *
 * Allows administrators to manage tenant-wide leadership level definitions.
 * Features:
 * - View all leadership levels (active + inactive)
 * - Create new leadership levels
 * - Edit existing levels
 * - Soft delete (deactivate) levels
 * - Restore deleted levels
 *
 * Part of Epic #399 - Leadership Levels System
 * @see Issue #426: Frontend UI for Leadership Levels
 * @see https://github.com/SecPal/.github/blob/main/docs/adr/20251221-inheritance-blocking-and-leadership-access-control.md
 */
export function SettingsLeadershipLevelsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingLevel, setEditingLevel] = useState<LeadershipLevel | null>(
    null
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Handle create button
  const handleCreate = useCallback(() => {
    setFormMode("create");
    setEditingLevel(null);
    setFormOpen(true);
  }, []);

  // Handle edit button
  const handleEdit = useCallback((level: LeadershipLevel) => {
    setFormMode("edit");
    setEditingLevel(level);
    setFormOpen(true);
  }, []);

  // Handle form close
  const handleFormClose = useCallback(() => {
    setFormOpen(false);
    setEditingLevel(null);
  }, []);

  // Handle successful save
  const handleSaveSuccess = useCallback(() => {
    // Trigger list refresh by incrementing counter
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return (
    <div className="space-y-10">
      <div>
        <Heading>
          <Trans>Leadership Levels</Trans>
        </Heading>
        <Text className="mt-2">
          <Trans>
            Manage tenant-wide leadership level definitions. Leadership levels
            define the hierarchical structure used for access control and
            permission filtering.
          </Trans>
        </Text>
      </div>

      {/* Leadership Levels List with CRUD */}
      <LeadershipLevelList
        onEdit={handleEdit}
        onCreate={handleCreate}
        refreshTrigger={refreshTrigger}
      />

      {/* Create/Edit Form Dialog */}
      <LeadershipLevelForm
        open={formOpen}
        onClose={handleFormClose}
        mode={formMode}
        level={editingLevel}
        onSuccess={handleSaveSuccess}
      />
    </div>
  );
}

export default SettingsLeadershipLevelsPage;
