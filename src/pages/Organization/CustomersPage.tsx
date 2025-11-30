// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { Heading } from "../../components/heading";
import { Text } from "../../components/text";
import { CustomerTree } from "../../components/CustomerTree";
import type { Customer } from "../../types";

/**
 * Customers Page
 *
 * Displays the customer hierarchy with their objects.
 * Part of Epic #228 - Organizational Structure Hierarchy.
 */
export function CustomersPage() {
  const navigate = useNavigate();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );

  const handleSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
  };

  const handleEdit = (customer: Customer) => {
    // TODO: Open edit modal/dialog
    void customer;
  };

  const handleDelete = (customer: Customer) => {
    // TODO: Open delete confirmation dialog
    void customer;
  };

  const handleCreate = (parentId?: string) => {
    // TODO: Open create modal/dialog
    void parentId;
  };

  const handleViewObjects = (customerId: string) => {
    navigate(`/customers/${customerId}/objects`);
  };

  return (
    <div className="space-y-6">
      <div>
        <Heading>
          <Trans>Customers</Trans>
        </Heading>
        <Text className="mt-2">
          <Trans>
            Manage customer organizations and their protected objects.
          </Trans>
        </Text>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Tree View */}
        <div className="lg:col-span-2">
          <CustomerTree
            onSelect={handleSelect}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreate={handleCreate}
            selectedId={selectedCustomer?.id}
          />
        </div>

        {/* Detail Panel */}
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          {selectedCustomer ? (
            <div className="space-y-4">
              <Heading level={3}>{selectedCustomer.name}</Heading>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                    <Trans>Customer Number</Trans>
                  </dt>
                  <dd className="text-zinc-900 dark:text-white">
                    {selectedCustomer.customer_number}
                  </dd>
                </div>
                {selectedCustomer.contact_email && (
                  <div>
                    <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                      <Trans>Contact Email</Trans>
                    </dt>
                    <dd className="text-zinc-900 dark:text-white">
                      <a
                        href={`mailto:${selectedCustomer.contact_email}`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {selectedCustomer.contact_email}
                      </a>
                    </dd>
                  </div>
                )}
                {selectedCustomer.contact_phone && (
                  <div>
                    <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                      <Trans>Contact Phone</Trans>
                    </dt>
                    <dd className="text-zinc-900 dark:text-white">
                      <a
                        href={`tel:${selectedCustomer.contact_phone}`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {selectedCustomer.contact_phone}
                      </a>
                    </dd>
                  </div>
                )}
                {selectedCustomer.address && (
                  <div>
                    <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                      <Trans>Address</Trans>
                    </dt>
                    <dd className="whitespace-pre-line text-zinc-900 dark:text-white">
                      {selectedCustomer.address}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="pt-4">
                <button
                  onClick={() => handleViewObjects(selectedCustomer.id)}
                  className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  <Trans>View Objects</Trans>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-center">
              <Text className="text-zinc-500">
                <Trans>Select a customer to view details</Trans>
              </Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CustomersPage;
