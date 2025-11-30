// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useParams, Link } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { Heading } from "../../components/heading";
import { Text } from "../../components/text";
import { Button } from "../../components/button";
import { GuardBookManager } from "../../components/GuardBookManager";
import type { GuardBook } from "../../types";

/**
 * Guard Books Page
 *
 * Displays guard books and reports for a specific object/area.
 * Part of Epic #228 - Organizational Structure Hierarchy.
 */
export function GuardBooksPage() {
  const { customerId, objectId, areaId } = useParams<{
    customerId: string;
    objectId: string;
    areaId?: string;
  }>();

  if (!customerId || !objectId) {
    return (
      <div className="space-y-4">
        <Heading>
          <Trans>Guard Books</Trans>
        </Heading>
        <Text className="text-red-600">
          <Trans>
            No object selected. Please navigate from the objects page.
          </Trans>
        </Text>
        <Button href="/customers">
          <Trans>Go to Customers</Trans>
        </Button>
      </div>
    );
  }

  const handleGuardBookSelect = (guardBook: GuardBook) => {
    console.log("Selected guard book:", guardBook);
  };

  const handleCreate = () => {
    // TODO: Open create guard book modal
    console.log("Create guard book for object:", objectId, "area:", areaId);
  };

  const handleGenerateReport = (guardBook: GuardBook) => {
    // TODO: Trigger report generation
    console.log("Generate report for guard book:", guardBook.id);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm text-zinc-500">
          <Link
            to="/customers"
            className="hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            <Trans>Customers</Trans>
          </Link>
          <span>/</span>
          <Link
            to={`/customers/${customerId}/objects`}
            className="hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            <Trans>Objects</Trans>
          </Link>
          <span>/</span>
          <span className="text-zinc-900 dark:text-white">
            <Trans>Guard Books</Trans>
          </span>
        </div>
        <Heading>
          <Trans>Guard Books</Trans>
        </Heading>
        <Text className="mt-2">
          <Trans>
            Manage digital guard books and generate reports for this location.
          </Trans>
        </Text>
      </div>

      <GuardBookManager
        objectId={objectId}
        objectAreaId={areaId}
        onSelect={handleGuardBookSelect}
        onCreate={handleCreate}
        onGenerateReport={handleGenerateReport}
      />
    </div>
  );
}

export default GuardBooksPage;
