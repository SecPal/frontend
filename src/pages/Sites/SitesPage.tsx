// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Sites Page - List view for Site Management
 * Epic #210 - Phase 6: Customer & Site Management Frontend
 */

import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { listSites } from "../../services/customersApi";
import type { Site, SiteFilters } from "../../types/customers";
import { Heading } from "../../components/heading";
import { Button } from "../../components/button";
import { Text } from "../../components/text";
import { Input } from "../../components/input";
import { Select } from "../../components/select";
import { Field, Label } from "../../components/fieldset";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "../../components/table";
import { Badge } from "../../components/badge";
import { useUserCapabilities } from "../../hooks/useUserCapabilities";

export default function SitesPage() {
  const { _ } = useLingui();
  const { customerId } = useParams<{ customerId?: string }>();
  const capabilities = useUserCapabilities();
  const [filters, setFilters] = useState<SiteFilters>({
    page: 1,
    per_page: 15,
    customer_id: customerId,
  });
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  });

  useEffect(() => {
    let active = true;

    void listSites(filters)
      .then((response) => {
        if (!active) {
          return;
        }

        setSites(response.data);
        setPagination(response.meta);
        setError(null);
      })
      .catch((err) => {
        if (!active) {
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to load sites");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [filters]);

  function handleSearch(value: string) {
    setLoading(true);
    setError(null);
    setFilters({ ...filters, search: value, page: 1 });
  }

  function handleStatusFilter(value: string) {
    setLoading(true);
    setError(null);
    setFilters({
      ...filters,
      is_active: value === "" ? undefined : value === "true",
      page: 1,
    });
  }

  function handleTypeFilter(value: string) {
    setLoading(true);
    setError(null);
    setFilters({
      ...filters,
      type: value === "" ? undefined : (value as "permanent" | "temporary"),
      page: 1,
    });
  }

  function handlePageChange(page: number) {
    setLoading(true);
    setError(null);
    setFilters({ ...filters, page });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Heading>
          <Trans>Sites</Trans>
        </Heading>
        {capabilities.actions.sites.create && (
          <Button
            href={
              customerId ? `/sites/new/customer/${customerId}` : "/sites/new"
            }
          >
            <Trans>New Site</Trans>
          </Button>
        )}
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <Field className="flex-1">
          <Label>
            <Trans>Search</Trans>
          </Label>
          <Input
            name="search"
            type="text"
            placeholder={_(msg`Search sites...`)}
            value={filters.search || ""}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </Field>
        <Field>
          <Label>
            <Trans>Type</Trans>
          </Label>
          <Select
            name="type"
            value={filters.type || ""}
            onChange={(e) => handleTypeFilter(e.target.value)}
          >
            <option value="">{_(msg`All Types`)}</option>
            <option value="permanent">{_(msg`Permanent`)}</option>
            <option value="temporary">{_(msg`Temporary`)}</option>
          </Select>
        </Field>
        <Field>
          <Label>
            <Trans>Status</Trans>
          </Label>
          <Select
            name="status"
            value={
              filters.is_active === undefined ? "" : String(filters.is_active)
            }
            onChange={(e) => handleStatusFilter(e.target.value)}
          >
            <option value="">{_(msg`All Status`)}</option>
            <option value="true">{_(msg`Active`)}</option>
            <option value="false">{_(msg`Inactive`)}</option>
          </Select>
        </Field>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
          <Text className="text-red-800 dark:text-red-200">{error}</Text>
        </div>
      )}

      {/* Site Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Text>
            <Trans>Loading...</Trans>
          </Text>
        </div>
      ) : sites.length === 0 ? (
        <div className="text-center py-12">
          <Text className="text-gray-500 dark:text-gray-400">
            <Trans>No sites found</Trans>
          </Text>
        </div>
      ) : (
        <Table className="[--gutter:--spacing-6] lg:[--gutter:--spacing-10]">
          <TableHead>
            <TableRow>
              <TableHeader>
                <Trans>Site Number</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Name</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Type</Trans>
              </TableHeader>
              <TableHeader>
                <Trans>Address</Trans>
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
            {sites.map((site) => (
              <TableRow key={site.id}>
                <TableCell className="font-medium">
                  {site.site_number}
                </TableCell>
                <TableCell>{site.name}</TableCell>
                <TableCell>
                  <Badge color={site.type === "permanent" ? "blue" : "amber"}>
                    {site.type === "permanent" ? (
                      <Trans>Permanent</Trans>
                    ) : (
                      <Trans>Temporary</Trans>
                    )}
                  </Badge>
                </TableCell>
                <TableCell className="text-zinc-500">
                  {site.address.city}, {site.address.country}
                </TableCell>
                <TableCell>
                  <Badge color={site.is_active ? "lime" : "zinc"}>
                    {site.is_active ? (
                      <Trans>Active</Trans>
                    ) : (
                      <Trans>Inactive</Trans>
                    )}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    to={`/sites/${site.id}`}
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

      {/* Pagination */}
      {pagination.last_page > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-6 rounded-lg dark:bg-zinc-900 dark:border-zinc-700">
          <div className="flex-1 flex justify-between sm:hidden">
            <Button
              onClick={() => handlePageChange(pagination.current_page - 1)}
              disabled={pagination.current_page === 1}
              outline
            >
              <Trans>Previous</Trans>
            </Button>
            <Button
              onClick={() => handlePageChange(pagination.current_page + 1)}
              disabled={pagination.current_page === pagination.last_page}
              outline
            >
              <Trans>Next</Trans>
            </Button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <Text className="text-sm text-gray-700 dark:text-gray-300">
                <Trans>
                  Showing{" "}
                  <span className="font-medium">
                    {(pagination.current_page - 1) * pagination.per_page + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium">
                    {Math.min(
                      pagination.current_page * pagination.per_page,
                      pagination.total
                    )}
                  </span>{" "}
                  of <span className="font-medium">{pagination.total}</span>{" "}
                  sites
                </Trans>
              </Text>
            </div>
            <div>
              <nav
                className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                aria-label="Pagination"
              >
                <Button
                  onClick={() => handlePageChange(pagination.current_page - 1)}
                  disabled={pagination.current_page === 1}
                  outline
                  className="rounded-l-md"
                >
                  <Trans>Previous</Trans>
                </Button>
                <Button
                  onClick={() => handlePageChange(pagination.current_page + 1)}
                  disabled={pagination.current_page === pagination.last_page}
                  outline
                  className="rounded-r-md"
                >
                  <Trans>Next</Trans>
                </Button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
