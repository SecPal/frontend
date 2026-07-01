// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Customers Page - List view for Customer & Site Management
 * Epic #210 - Phase 6: Customer & Site Management Frontend
 */

import { useState, useEffect } from "react";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { Eye, Plus } from "lucide-react";
import { LoadingRegion, Skeleton } from "@/ui";
import { listCustomers } from "../../services/customersApi";
import type { Customer, CustomerFilters } from "../../types/customers";
import {
  Alert,
  AlertDescription,
  Button,
  DataTable,
  Field,
  FieldLabel,
  Input,
  CustomerSiteLinkButton as LinkButton,
  CustomerSitePageLink as PageLink,
  CustomerSitePageText as PageText,
  CustomerSitePageTitle as PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  CustomerSiteStatusBadge as StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui";
import { useUserCapabilities } from "../../hooks/useUserCapabilities";

const CUSTOMERS_DESKTOP_MEDIA_QUERY = "(min-width: 40rem)";

function readUseDesktopTable(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return true;
  }

  return window.matchMedia(CUSTOMERS_DESKTOP_MEDIA_QUERY).matches;
}

function getCustomerSitesSummary(customer: Customer): string {
  if (Array.isArray(customer.sites)) {
    return String(customer.sites.length);
  }

  if (typeof customer.sites_count === "number" && customer.sites_count > 0) {
    return String(customer.sites_count);
  }

  return "—";
}

function CustomerTableSkeletonRows({
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

export default function CustomersPage() {
  const { _ } = useLingui();
  const capabilities = useUserCapabilities();
  const [filters, setFilters] = useState<CustomerFilters>({
    page: 1,
    per_page: 15,
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  });
  const [useDesktopTable, setUseDesktopTable] = useState(readUseDesktopTable);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQuery = window.matchMedia(CUSTOMERS_DESKTOP_MEDIA_QUERY);
    const updateLayout = () => {
      setUseDesktopTable(mediaQuery.matches);
    };

    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);

    return () => {
      mediaQuery.removeEventListener("change", updateLayout);
    };
  }, []);

  useEffect(() => {
    let active = true;

    void listCustomers(filters)
      .then((response) => {
        if (!active) {
          return;
        }

        setCustomers(response.data);
        setPagination(response.meta);
        setError(null);
      })
      .catch((err) => {
        if (!active) {
          return;
        }

        setError(
          err instanceof Error ? err.message : _(msg`Failed to load customers`)
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
  }, [_, filters]);

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

  function handlePageChange(page: number) {
    setLoading(true);
    setError(null);
    setFilters({ ...filters, page });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageTitle>
          <Trans>Customers</Trans>
        </PageTitle>
        {capabilities.actions.customers.create && (
          <LinkButton to="/customers/new">
            <Plus className="size-4" aria-hidden="true" />
            <Trans>New Customer</Trans>
          </LinkButton>
        )}
      </div>

      {/* Search and Filter */}
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Field className="flex-1">
          <FieldLabel htmlFor="customer-search">
            <Trans>Search</Trans>
          </FieldLabel>
          <Input
            id="customer-search"
            name="search"
            type="text"
            placeholder={_(msg`Search customers...`)}
            value={filters.search || ""}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="customer-status-filter">
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
            <SelectTrigger id="customer-status-filter">
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

      {/* Error State */}
      {error && (
        <Alert className="border-destructive/30 bg-destructive/10 text-foreground">
          <AlertDescription className="text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Customer Table */}
      <LoadingRegion
        loading={loading}
        loadingLabel={_(msg`Loading customers table`)}
      >
        {useDesktopTable ? (
          <DataTable>
            <Table>
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
                {loading && customers.length === 0 ? (
                  <CustomerTableSkeletonRows columns={6} rows={5} />
                ) : null}

                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">
                      {customer.customer_number}
                    </TableCell>
                    <TableCell>{customer.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.contact?.email || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getCustomerSitesSummary(customer)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge color={customer.is_active ? "lime" : "zinc"}>
                        {customer.is_active ? (
                          <Trans>Active</Trans>
                        ) : (
                          <Trans>Inactive</Trans>
                        )}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <PageLink to={`/customers/${customer.id}`}>
                        <Eye className="inline size-4" aria-hidden="true" />{" "}
                        <Trans>View</Trans>
                      </PageLink>
                    </TableCell>
                  </TableRow>
                ))}

                {!loading && customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <PageText className="text-muted-foreground">
                        <Trans>No customers found</Trans>
                      </PageText>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </DataTable>
        ) : (
          <div className="space-y-3">
            {loading && customers.length === 0
              ? Array.from({ length: 5 }, (_, index) => (
                  <div
                    key={index}
                    className="rounded-md border border-border bg-card p-4"
                    aria-hidden="true"
                  >
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="mt-3 h-5 w-40" />
                    <Skeleton className="mt-2 h-4 w-32" />
                    <Skeleton className="mt-4 h-9 w-24" />
                  </div>
                ))
              : null}

            {customers.map((customer) => (
              <div
                key={customer.id}
                className="rounded-md border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      {customer.customer_number}
                    </p>
                    <p className="text-foreground mt-1 text-sm font-semibold">
                      {customer.name}
                    </p>
                  </div>
                  <StatusBadge color={customer.is_active ? "lime" : "zinc"}>
                    {customer.is_active ? (
                      <Trans>Active</Trans>
                    ) : (
                      <Trans>Inactive</Trans>
                    )}
                  </StatusBadge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">
                      <Trans>Contact</Trans>
                    </p>
                    <p className="text-foreground break-words">
                      {customer.contact?.email || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      <Trans>Sites</Trans>
                    </p>
                    <p className="text-foreground">
                      {getCustomerSitesSummary(customer)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">
                      <Trans>Billing Address</Trans>
                    </p>
                    <p className="text-foreground break-words">
                      {customer.billing_address.postal_code}{" "}
                      {customer.billing_address.city}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <LinkButton
                    to={`/customers/${customer.id}`}
                    variant="outline"
                    aria-label={_(msg`View ${customer.name}`)}
                  >
                    <Eye className="size-4" aria-hidden="true" />
                    <Trans>View</Trans>
                  </LinkButton>
                </div>
              </div>
            ))}

            {!loading && customers.length === 0 ? (
              <div className="rounded-md border border-border bg-card px-4 py-12 text-center">
                <PageText className="text-muted-foreground">
                  <Trans>No customers found</Trans>
                </PageText>
              </div>
            ) : null}
          </div>
        )}
      </LoadingRegion>

      {/* Pagination */}
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
                  customers
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
