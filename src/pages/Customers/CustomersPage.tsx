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
                    {customer.sites_count || 0}
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
