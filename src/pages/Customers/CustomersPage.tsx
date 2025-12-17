// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Customers Page - List view for Customer & Site Management
 * Epic #210 - Phase 6: Customer & Site Management Frontend
 */

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { listCustomers } from "../../services/customersApi";
import type { Customer, CustomerFilters } from "../../types/customers";
import { Heading } from "../../components/heading";
import { Button } from "../../components/button";
import { Text } from "../../components/text";
import { Input } from "../../components/input";
import { Select } from "../../components/select";
import { Field } from "../../components/fieldset";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "../../components/table";
import { Badge } from "../../components/badge";

export default function CustomersPage() {
  const { _ } = useLingui();
  const [filters, setFilters] = useState<CustomerFilters>({
    page: 1,
    per_page: 15,
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listCustomers(filters);
      setCustomers(response.data);
      setTotal(response.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  function handleSearch(value: string) {
    setFilters({ ...filters, search: value, page: 1 });
  }

  function handleStatusFilter(value: string) {
    setFilters({
      ...filters,
      is_active: value === "" ? undefined : value === "true",
      page: 1,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Heading>
          <Trans>Customers</Trans>
        </Heading>
        <Button href="/customers/new" color="indigo">
          <Trans>New Customer</Trans>
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <Field className="flex-1">
          <Input
            name="search"
            type="text"
            placeholder={_(msg`Search customers...`)}
            value={filters.search || ""}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </Field>
        <Field>
          <Select
            name="status"
            value={
              filters.is_active === undefined ? "" : String(filters.is_active)
            }
            onChange={(e) => handleStatusFilter(e.target.value)}
          >
            <option value="">
              <Trans>All Status</Trans>
            </option>
            <option value="true">
              <Trans>Active</Trans>
            </option>
            <option value="false">
              <Trans>Inactive</Trans>
            </option>
          </Select>
        </Field>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
          <Text className="text-red-800 dark:text-red-200">{error}</Text>
        </div>
      )}

      {/* Customer Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Text>
            <Trans>Loading...</Trans>
          </Text>
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12">
          <Text className="text-gray-500 dark:text-gray-400">
            <Trans>No customers found</Trans>
          </Text>
        </div>
      ) : (
        <Table className="[--gutter:theme(spacing.6)] lg:[--gutter:theme(spacing.10)]">
          <TableHead>
            <TableRow>
              <TableHeader>
                <Trans>Customer Number</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Name</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Contact</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Sites</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Status</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Actions</Trans>
              </TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">
                  {customer.customer_number}
                </TableCell>
                <TableCell>{customer.name}</TableCell>
                <TableCell className="text-zinc-500">
                  {customer.contact?.email || "-"}
                </TableCell>
                <TableCell className="text-zinc-500">
                  {customer.sites_count || 0}
                </TableCell>
                <TableCell>
                  <Badge color={customer.is_active ? "lime" : "zinc"}>
                    {customer.is_active ? (
                      <Trans>Active</Trans>
                    ) : (
                      <Trans>Inactive</Trans>
                    )}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    to={`/customers/${customer.id}`}
                    className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
                  >
                    <Trans>View</Trans>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Pagination Info */}
      {!loading && customers.length > 0 && (
        <div className="flex items-center justify-between">
          <Text className="text-sm text-zinc-500">
            <Trans>
              Showing {customers.length} of {total} customers
            </Trans>
          </Text>
        </div>
      )}
    </div>
  );
}
