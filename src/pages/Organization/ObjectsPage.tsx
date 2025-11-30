// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { Heading } from "../../components/heading";
import { Text } from "../../components/text";
import { Button } from "../../components/button";
import { ObjectManager } from "../../components/ObjectManager";
import type { SecPalObject, ObjectArea } from "../../types";

/**
 * Objects Page
 *
 * Displays objects and areas for a specific customer.
 * Part of Epic #228 - Organizational Structure Hierarchy.
 */
export function ObjectsPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  if (!customerId) {
    return (
      <div className="space-y-4">
        <Heading>
          <Trans>Objects</Trans>
        </Heading>
        <Text className="text-red-600">
          <Trans>No customer selected. Please select a customer first.</Trans>
        </Text>
        <Button href="/customers">
          <Trans>Go to Customers</Trans>
        </Button>
      </div>
    );
  }

  const handleObjectSelect = (object: SecPalObject) => {
    setSelectedObjectId(object.id);
  };

  const handleAreaEdit = (area: ObjectArea) => {
    // Navigate to guard books for this area
    const objId = area.object?.id || selectedObjectId;
    if (objId) {
      navigate(
        `/customers/${customerId}/objects/${objId}/areas/${area.id}/guard-books`
      );
    }
  };

  const handleObjectCreate = () => {
    // TODO: Open create object modal
  };

  const handleAreaCreate = (objectId: string) => {
    // TODO: Open create area modal
    void objectId;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-zinc-500">
            <Link
              to="/customers"
              className="hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              <Trans>Customers</Trans>
            </Link>
            <span>/</span>
            <span className="text-zinc-900 dark:text-white">
              <Trans>Objects</Trans>
            </span>
          </div>
          <Heading>
            <Trans>Objects & Areas</Trans>
          </Heading>
          <Text className="mt-2">
            <Trans>
              Manage protected objects and their areas for this customer.
            </Trans>
          </Text>
        </div>
      </div>

      <ObjectManager
        customerId={customerId}
        onSelect={handleObjectSelect}
        onEditArea={handleAreaEdit}
        onCreate={handleObjectCreate}
        onCreateArea={handleAreaCreate}
        selectedId={selectedObjectId}
      />
    </div>
  );
}

export default ObjectsPage;
