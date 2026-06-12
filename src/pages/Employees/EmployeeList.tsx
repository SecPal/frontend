// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect } from "react";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import type { Employee, EmployeeFilters, EmployeeStatus } from "@/types/api";
import { fetchEmployees } from "../../services/employeeApi";
import { listOrganizationalUnits } from "../../services/organizationalUnitApi";
import type { OrganizationalUnit } from "../../types/organizational";
import { OrganizationalUnitPicker } from "../../components/OrganizationalUnitPicker";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  DataTable,
  Field,
  FieldLabel,
  Input,
  LinkButton,
  PageText,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  StatusBadge as EmployeeStatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui";
import { useUserCapabilities } from "../../hooks/useUserCapabilities";

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

  if (loading && employees.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
        <Spinner aria-label={_(msg`Loading employees...`)} />
        <span>
          <Trans>Loading employees...</Trans>
        </span>
      </div>
    );
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
        <Alert className="border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          <PageTitle level={3} className="text-red-900 dark:text-red-200">
            <Trans>Error Loading Employees</Trans>
          </PageTitle>
          <AlertDescription className="text-red-700 dark:text-red-300">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Employee Table */}
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
            {employees.map((employee) => (
              <TableRow
                key={employee.id}
                to={`/employees/${employee.id}`}
                title={employee.full_name}
              >
                <TableCell>
                  <div>
                    <div className="font-medium">{employee.full_name}</div>
                    <div className="text-zinc-500 dark:text-zinc-400">
                      {employee.email}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-zinc-500 dark:text-zinc-400">
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
                <TableCell className="text-zinc-500 dark:text-zinc-400">
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
          </TableBody>
        </Table>
      </DataTable>

      {/* Pagination */}
      {pagination.last_page > 1 && (
        <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950 sm:px-6">
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
