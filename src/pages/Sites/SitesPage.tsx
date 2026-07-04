// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

/**
 * Sites Page - List view for Site Management
 * Epic #210 - Phase 6: Customer & Site Management Frontend
 */

import { useMemo, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { Eye, Plus } from "lucide-react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { LoadingRegion } from "@/ui/loading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { Skeleton } from "@/ui/skeleton";
import { listSites } from "../../services/customersApi";
import type { Site, SiteFilters } from "../../types/customers";
import {
  Alert,
  AlertDescription,
  DataTable,
  Field,
  FieldLabel,
  CustomerSiteLinkButton as LinkButton,
  CustomerSitePageLink as PageLink,
  CustomerSitePageText as PageText,
  CustomerSitePageTitle as PageTitle,
  CustomerSiteStatusBadge as StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui";
import { useUserCapabilities } from "../../hooks/useUserCapabilities";

function formatSiteAddress(site: Site): string {
  if (site.full_address) {
    return site.full_address;
  }

  return [
    site.address.street,
    `${site.address.postal_code} ${site.address.city}`.trim(),
    site.address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function SiteTableSkeletonRows({
  columns,
  rows,
}: {
  columns: number;
  rows: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }, (_, columnIndex) => (
            <TableCell key={columnIndex}>
              <Skeleton
                className={columnIndex === 1 ? "h-4 w-40" : "h-4 w-24"}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

const SITE_TABLE_COLUMN_COUNT = 8;
const DEFAULT_PAGINATION = {
  current_page: 1,
  last_page: 1,
  per_page: 15,
  total: 0,
};

export default function SitesPage() {
  const { customerId } = useParams<{ customerId?: string }>();

  return (
    <SitesPageContent key={customerId ?? "all-sites"} customerId={customerId} />
  );
}

function SitesPageContent({ customerId }: { customerId?: string }) {
  const { _ } = useLingui();
  const capabilities = useUserCapabilities();
  const [filters, setFilters] = useState<SiteFilters>({
    page: 1,
    per_page: 15,
  });
  const effectiveFilters = useMemo<SiteFilters>(
    () => ({ ...filters, customer_id: customerId }),
    [customerId, filters]
  );
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);

  useEffect(() => {
    let active = true;

    void listSites(effectiveFilters)
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

        setError(
          err instanceof Error ? err.message : _(msg`Failed to load sites`)
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [_, effectiveFilters]);

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
      is_active: value === "all" ? undefined : value === "true",
      page: 1,
    });
  }

  function handleTypeFilter(value: string) {
    setLoading(true);
    setError(null);
    setFilters({
      ...filters,
      type: value === "all" ? undefined : (value as "permanent" | "temporary"),
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
        <PageTitle>
          <Trans>Sites</Trans>
        </PageTitle>
        {capabilities.actions.sites.create && (
          <LinkButton
            to={customerId ? `/sites/new/customer/${customerId}` : "/sites/new"}
          >
            <Plus className="size-4" aria-hidden="true" />
            <Trans>New Site</Trans>
          </LinkButton>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_12rem_12rem]">
        <Field className="flex-1">
          <FieldLabel htmlFor="site-search">
            <Trans>Search</Trans>
          </FieldLabel>
          <Input
            id="site-search"
            name="search"
            type="text"
            placeholder={_(msg`Search sites...`)}
            value={filters.search || ""}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="site-type-filter">
            <Trans>Type</Trans>
          </FieldLabel>
          <Select
            name="type"
            value={filters.type || "all"}
            onValueChange={handleTypeFilter}
          >
            <SelectTrigger id="site-type-filter">
              <SelectValue placeholder={_(msg`All Types`)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{_(msg`All Types`)}</SelectItem>
              <SelectItem value="permanent">{_(msg`Permanent`)}</SelectItem>
              <SelectItem value="temporary">{_(msg`Temporary`)}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="site-status-filter">
            <Trans>Status</Trans>
          </FieldLabel>
          <Select
            name="status"
            value={
              filters.is_active === undefined
                ? "all"
                : String(filters.is_active)
            }
            onValueChange={handleStatusFilter}
          >
            <SelectTrigger id="site-status-filter">
              <SelectValue placeholder={_(msg`All Status`)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{_(msg`All Status`)}</SelectItem>
              <SelectItem value="true">{_(msg`Active`)}</SelectItem>
              <SelectItem value="false">{_(msg`Inactive`)}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      {error && (
        <Alert className="border-destructive/30 bg-destructive/10 text-foreground">
          <AlertDescription className="text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <LoadingRegion
        loading={loading}
        loadingLabel={_(msg`Loading sites table`)}
      >
        <DataTable>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>
                  <Trans>Site Number</Trans>
                </TableHeader>
                <TableHeader>
                  <Trans>Name</Trans>
                </TableHeader>
                <TableHeader>
                  <Trans>Customer</Trans>
                </TableHeader>
                <TableHeader>
                  <Trans>Type</Trans>
                </TableHeader>
                <TableHeader>
                  <Trans>Address</Trans>
                </TableHeader>
                <TableHeader>
                  <Trans>Contact Person</Trans>
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
              {loading && sites.length === 0 ? (
                <SiteTableSkeletonRows
                  columns={SITE_TABLE_COLUMN_COUNT}
                  rows={5}
                />
              ) : null}

              {sites.map((site) => (
                <TableRow key={site.id}>
                  <TableCell className="font-medium">
                    {site.site_number}
                  </TableCell>
                  <TableCell>{site.name}</TableCell>
                  <TableCell>
                    {site.customer ? (
                      <PageLink to={`/customers/${site.customer.id}`}>
                        {site.customer.name}
                      </PageLink>
                    ) : (
                      site.customer_id
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      color={site.type === "permanent" ? "blue" : "amber"}
                    >
                      {site.type === "permanent" ? (
                        <Trans>Permanent</Trans>
                      ) : (
                        <Trans>Temporary</Trans>
                      )}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatSiteAddress(site)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {site.contact?.name || "-"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge color={site.is_active ? "lime" : "zinc"}>
                      {site.is_active ? (
                        <Trans>Active</Trans>
                      ) : (
                        <Trans>Inactive</Trans>
                      )}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <PageLink to={`/sites/${site.id}`}>
                      <Eye className="inline size-4" aria-hidden="true" />{" "}
                      <Trans>View</Trans>
                    </PageLink>
                  </TableCell>
                </TableRow>
              ))}

              {!loading && sites.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={SITE_TABLE_COLUMN_COUNT}
                    className="py-12 text-center"
                  >
                    <PageText className="text-muted-foreground">
                      <Trans>No sites found</Trans>
                    </PageText>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </DataTable>
      </LoadingRegion>

      {pagination.last_page > 1 && (
        <div className="bg-card mt-6 flex items-center justify-between rounded-md border border-border px-4 py-3 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <Button
              onClick={() => handlePageChange(pagination.current_page - 1)}
              disabled={pagination.current_page === 1}
              variant="outline"
            >
              <Trans>Previous</Trans>
            </Button>
            <Button
              onClick={() => handlePageChange(pagination.current_page + 1)}
              disabled={pagination.current_page === pagination.last_page}
              variant="outline"
            >
              <Trans>Next</Trans>
            </Button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <PageText>
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
              </PageText>
            </div>
            <div>
              <nav
                className="relative z-0 inline-flex gap-2"
                aria-label={_(msg`Pagination`)}
              >
                <Button
                  onClick={() => handlePageChange(pagination.current_page - 1)}
                  disabled={pagination.current_page === 1}
                  variant="outline"
                >
                  <Trans>Previous</Trans>
                </Button>
                <Button
                  onClick={() => handlePageChange(pagination.current_page + 1)}
                  disabled={pagination.current_page === pagination.last_page}
                  variant="outline"
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
