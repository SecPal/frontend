// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { useState, useEffect } from "react";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import type { Employee, EmployeeFilters, EmployeeStatus } from "@/types/api";
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
import { fetchEmployees } from "../../services/employeeApi";
import { listOrganizationalUnits } from "../../services/organizationalUnitApi";
import type { OrganizationalUnit } from "../../types/organizational";
import { OrganizationalUnitPicker } from "../../components/OrganizationalUnitPicker";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  EmployeeDataTable as DataTable,
  Field,
  FieldLabel,
  EmployeeLinkButton as LinkButton,
  EmployeePageText as PageText,
  EmployeePageTitle as PageTitle,
  EmployeeStatusBadge,
  EmployeeTable as Table,
  EmployeeTableBody as TableBody,
  EmployeeTableCell as TableCell,
  EmployeeTableHead as TableHead,
  EmployeeTableHeader as TableHeader,
  EmployeeTableRow as TableRow,
} from "@/ui";
import { useUserCapabilities } from "../../hooks/useUserCapabilities";

const EMPLOYEES_DESKTOP_MEDIA_QUERY = "(min-width: 40rem)";

function readUseDesktopTable(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return true;
  }

  return window.matchMedia(EMPLOYEES_DESKTOP_MEDIA_QUERY).matches;
}

function StatusBadge({ status }: { status: EmployeeStatus }) {
  const colors = {
    applicant: "orange",
    pre_contract: "yellow",
    active: "lime",
    on_leave: "sky",
    terminated: "zinc",
  } as const;

  const labels = {
    applicant: <Trans>Applicant</Trans>,
    pre_contract: <Trans>Pre-Contract</Trans>,
    active: <Trans>Active</Trans>,
    on_leave: <Trans>On Leave</Trans>,
    terminated: <Trans>Terminated</Trans>,
  };

  return (
    <EmployeeStatusBadge color={colors[status]}>
      {labels[status]}
    </EmployeeStatusBadge>
  );
}

function EmployeeTableSkeletonRows({
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
                className={
                  columnIndex === 0
                    ? "h-4 w-44 max-w-full"
                    : "h-4 w-24 max-w-full"
                }
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/**
 * Employee List Page
 */
export function EmployeeList() {
  const { _ } = useLingui();
  const capabilities = useUserCapabilities();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<EmployeeFilters>({
    page: 1,
    per_page: 15,
  });
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  });
  const [organizationalUnits, setOrganizationalUnits] = useState<
    OrganizationalUnit[]
  >([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [useDesktopTable, setUseDesktopTable] = useState(readUseDesktopTable);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQuery = window.matchMedia(EMPLOYEES_DESKTOP_MEDIA_QUERY);
    const updateLayout = () => {
      setUseDesktopTable(mediaQuery.matches);
    };

    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);

    return () => {
      mediaQuery.removeEventListener("change", updateLayout);
    };
  }, []);

  // Load organizational units on mount
  useEffect(() => {
    async function loadUnits() {
      try {
        setUnitsLoading(true);
        const response = await listOrganizationalUnits();
        setOrganizationalUnits(response.data);
      } catch (err) {
        console.error("Failed to load organizational units:", err);
        // Don't block the UI if units fail to load
      } finally {
        setUnitsLoading(false);
      }
    }
    loadUnits();
  }, []);

  useEffect(() => {
    let active = true;

    void fetchEmployees(filters)
      .then((response) => {
        if (!active) {
          return;
        }

        setEmployees(response.data);
        setPagination(response.meta);
        setError(null);
      })
      .catch((err) => {
        if (!active) {
          return;
        }

        console.error("Failed to load employees:", err);
        let errorMessage = _(msg`Failed to load employees`);

        if (err instanceof Error) {
          errorMessage = err.message;
        } else if (
          typeof err === "object" &&
          err !== null &&
          "message" in err
        ) {
          errorMessage = String(err.message);
        }

        setError(errorMessage);
        setEmployees([]);
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

  function handleStatusFilter(status: EmployeeStatus | undefined) {
    setLoading(true);
    setError(null);
    setFilters({ ...filters, status, page: 1 });
  }

  function handleOrganizationalUnitFilter(
    organizational_unit_id: string | undefined
  ) {
    setLoading(true);
    setError(null);
    setFilters({ ...filters, organizational_unit_id, page: 1 });
  }

  function handleSearch(search: string) {
    setLoading(true);
    setError(null);
    setFilters({ ...filters, search, page: 1 });
  }

  function handlePageChange(page: number) {
    setLoading(true);
    setError(null);
    setFilters({ ...filters, page });
  }

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <PageTitle>
          <Trans>Employee Management</Trans>
        </PageTitle>
        {capabilities.actions.employees.create && (
          <div className="mt-4 sm:mt-0">
            <LinkButton to="/employees/create">
              <Trans>Add Employee</Trans>
            </LinkButton>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field>
              <FieldLabel htmlFor="employee-search">
                <Trans>Search</Trans>
              </FieldLabel>
              <Input
                id="employee-search"
                type="text"
                name="search"
                placeholder={_(msg`Search by name or email...`)}
                value={filters.search || ""}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="employee-organizational-unit">
                <Trans>Organizational Unit</Trans>
              </FieldLabel>
              <OrganizationalUnitPicker
                id="employee-organizational-unit"
                units={organizationalUnits}
                value={filters.organizational_unit_id ?? ""}
                onChange={(unitId) =>
                  handleOrganizationalUnitFilter(unitId || undefined)
                }
                disabled={unitsLoading}
                ariaLabel={_(msg`Organizational Unit`)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="employee-status-filter">
                <Trans>Status</Trans>
              </FieldLabel>
              <Select
                name="status"
                value={filters.status || "all"}
                onValueChange={(value) =>
                  handleStatusFilter(
                    value === "all" ? undefined : (value as EmployeeStatus)
                  )
                }
              >
                <SelectTrigger id="employee-status-filter">
                  <SelectValue placeholder={_(msg`All`)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-value="all">
                    {_(msg`All`)}
                  </SelectItem>
                  <SelectItem value="applicant" data-value="applicant">
                    {_(msg`Applicant`)}
                  </SelectItem>
                  <SelectItem value="pre_contract" data-value="pre_contract">
                    {_(msg`Pre-Contract`)}
                  </SelectItem>
                  <SelectItem value="active" data-value="active">
                    {_(msg`Active`)}
                  </SelectItem>
                  <SelectItem value="on_leave" data-value="on_leave">
                    {_(msg`On Leave`)}
                  </SelectItem>
                  <SelectItem value="terminated" data-value="terminated">
                    {_(msg`Terminated`)}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Alert className="border-destructive/30 bg-destructive/10 text-foreground">
          <AlertTitle className="text-destructive">
            <Trans>Error Loading Employees</Trans>
          </AlertTitle>
          <AlertDescription className="text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Employee Table */}
      <LoadingRegion
        loading={loading}
        loadingLabel={_(msg`Loading employees table`)}
      >
        {useDesktopTable ? (
          <DataTable>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>
                    <Trans>Employee</Trans>
                  </TableHeader>
                  <TableHeader>
                    <Trans>Employee #</Trans>
                  </TableHeader>
                  <TableHeader>
                    <Trans>Position</Trans>
                  </TableHeader>
                  <TableHeader>
                    <Trans>Status</Trans>
                  </TableHeader>
                  <TableHeader>
                    <Trans>Unit</Trans>
                  </TableHeader>
                  <TableHeader>
                    <span className="sr-only">
                      <Trans>Actions</Trans>
                    </span>
                  </TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && employees.length === 0 ? (
                  <EmployeeTableSkeletonRows columns={6} rows={5} />
                ) : null}

                {employees.map((employee) => (
                  <TableRow
                    key={employee.id}
                    to={`/employees/${employee.id}`}
                    title={employee.full_name}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{employee.full_name}</div>
                        <div className="text-muted-foreground">
                          {employee.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {employee.employee_number}
                    </TableCell>
                    <TableCell>
                      {employee.management_level > 0 ? (
                        <>
                          <span className="font-medium">
                            <Trans>ML</Trans> {employee.management_level}
                          </span>
                          {" - "}
                          {employee.position}
                        </>
                      ) : (
                        employee.position
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={employee.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {employee.organizational_unit?.name || "-"}
                    </TableCell>
                    <TableCell>
                      <LinkButton
                        variant="outline"
                        to={`/employees/${employee.id}`}
                        className="relative z-10"
                      >
                        <Trans>View</Trans>
                      </LinkButton>
                    </TableCell>
                  </TableRow>
                ))}

                {!loading && !error && employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <PageText className="text-muted-foreground">
                        <Trans>No employees found</Trans>
                      </PageText>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </DataTable>
        ) : (
          <div className="space-y-3">
            {loading && employees.length === 0
              ? Array.from({ length: 5 }, (_, index) => (
                  <div
                    key={index}
                    className="rounded-md border border-border bg-card p-4"
                    aria-hidden="true"
                  >
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="mt-2 h-4 w-40" />
                    <Skeleton className="mt-4 h-4 w-24" />
                    <Skeleton className="mt-4 h-9 w-24" />
                  </div>
                ))
              : null}

            {employees.map((employee) => (
              <div
                key={employee.id}
                className="rounded-md border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-foreground text-sm font-semibold">
                      {employee.full_name}
                    </p>
                    <p className="text-muted-foreground mt-1 break-words text-sm">
                      {employee.email}
                    </p>
                  </div>
                  <StatusBadge status={employee.status} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">
                      <Trans>Employee #</Trans>
                    </p>
                    <p className="text-foreground">
                      {employee.employee_number}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      <Trans>Unit</Trans>
                    </p>
                    <p className="text-foreground">
                      {employee.organizational_unit?.name || "-"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">
                      <Trans>Position</Trans>
                    </p>
                    <p className="text-foreground">
                      {employee.management_level > 0 ? (
                        <>
                          <Trans>ML</Trans> {employee.management_level} -{" "}
                          {employee.position}
                        </>
                      ) : (
                        employee.position
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <LinkButton
                    variant="outline"
                    to={`/employees/${employee.id}`}
                    aria-label={_(msg`View ${employee.full_name}`)}
                  >
                    <Trans>View</Trans>
                  </LinkButton>
                </div>
              </div>
            ))}

            {!loading && !error && employees.length === 0 ? (
              <div className="rounded-md border border-border bg-card px-4 py-12 text-center">
                <PageText className="text-muted-foreground">
                  <Trans>No employees found</Trans>
                </PageText>
              </div>
            ) : null}
          </div>
        )}
      </LoadingRegion>

      {/* Pagination */}
      {pagination.last_page > 1 && (
        <div className="bg-card flex items-center justify-between rounded-md border border-border px-4 py-3 sm:px-6">
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
                  employees
                </Trans>
              </PageText>
            </div>
            <div>
              <nav
                className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                aria-label={_(msg`Pagination`)}
              >
                <Button
                  onClick={() => handlePageChange(pagination.current_page - 1)}
                  disabled={pagination.current_page === 1}
                  variant="outline"
                  className="rounded-l-md"
                >
                  <Trans>Previous</Trans>
                </Button>
                <Button
                  onClick={() => handlePageChange(pagination.current_page + 1)}
                  disabled={pagination.current_page === pagination.last_page}
                  variant="outline"
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

export default EmployeeList;
