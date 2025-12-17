// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Sites Page - List view for Site Management
 * Epic #210 - Phase 6: Customer & Site Management Frontend
 */

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { listSites } from "../../services/customersApi";
import type { Site, SiteFilters } from "../../types/customers";
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

export default function SitesPage() {
  const { _ } = useLingui();
  const [filters, setFilters] = useState<SiteFilters>({
    page: 1,
    per_page: 15,
  });
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const loadSites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listSites(filters);
      setSites(response.data);
      setTotal(response.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sites");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

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

  function handleTypeFilter(value: string) {
    setFilters({
      ...filters,
      type: value === "" ? undefined : (value as "permanent" | "temporary"),
      page: 1,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Heading>
          <Trans>Sites</Trans>
        </Heading>
        <Button href="/sites/new" color="indigo">
          <Trans>New Site</Trans>
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <Field className="flex-1">
          <Input
            name="search"
            type="text"
            placeholder={_(msg`Search sites...`)}
            value={filters.search || ""}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </Field>
        <Field>
          <Select
            name="type"
            value={filters.type || ""}
            onChange={(e) => handleTypeFilter(e.target.value)}
          >
            <option value="">
              <Trans>All Types</Trans>
            </option>
            <option value="permanent">
              <Trans>Permanent</Trans>
            </option>
            <option value="temporary">
              <Trans>Temporary</Trans>
            </option>
          </Select>
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

      {/* Pagination Info */}
      {!loading && sites.length > 0 && (
        <div className="flex items-center justify-between">
          <Text className="text-sm text-zinc-500">
            <Trans>
              Showing {sites.length} of {total} sites
            </Trans>
          </Text>
        </div>
      )}
    </div>
  );
}
