// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from "react";
import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import {
  fetchEmployees,
  type Employee,
  type EmployeeStatus,
  type EmployeeFilters,
} from "../../services/employeeApi";
import { listOrganizationalUnits } from "../../services/organizationalUnitApi";
import type { OrganizationalUnit } from "../../types/organizational";
import { Heading } from "../../components/heading";
import { Button } from "../../components/button";
import { Text } from "../../components/text";
import { Input } from "../../components/input";
import { Select } from "../../components/select";
import { Field, Label } from "../../components/fieldset";
import { OrganizationalUnitPicker } from "../../components/OrganizationalUnitPicker";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "../../components/table";
import { Badge } from "../../components/badge";

/**
 * Status badge component using Catalyst Badge
 */
function StatusBadge({ status }: { status: EmployeeStatus }) {
  const colors = {
    pre_contract: "yellow",
    active: "lime",
    on_leave: "sky",
    terminated: "zinc",
  } as const;

  const labels = {
    pre_contract: <Trans>Pre-Contract</Trans>,
    active: <Trans>Active</Trans>,
    on_leave: <Trans>On Leave</Trans>,
    terminated: <Trans>Terminated</Trans>,
  };

  return <Badge color={colors[status]}>{labels[status]}</Badge>;
}

/**
 * Employee List Page
 */
export function EmployeeList() {
  const { _ } = useLingui();
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

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchEmployees(filters);
      setEmployees(response.data);
      setPagination(response.meta);
    } catch (err) {
      console.error("Failed to load employees:", err);
      let errorMessage = "Failed to load employees";

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err !== null && "message" in err) {
        errorMessage = String(err.message);
      }

      setError(errorMessage);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

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
    loadEmployees();
  }, [loadEmployees]);

  function handleStatusFilter(status: EmployeeStatus | undefined) {
    setFilters({ ...filters, status, page: 1 });
  }

  function handleOrganizationalUnitFilter(
    organizational_unit_id: string | undefined
  ) {
    setFilters({ ...filters, organizational_unit_id, page: 1 });
  }

  function handleSearch(search: string) {
    setFilters({ ...filters, search, page: 1 });
  }

  function handlePageChange(page: number) {
    setFilters({ ...filters, page });
  }

  if (loading && employees.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Text>
          <Trans>Loading employees...</Trans>
        </Text>
      </div>
    );
  }

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <Heading>
          <Trans>Employee Management</Trans>
        </Heading>
        <div className="mt-4 sm:mt-0">
          <Button href="/employees/create">
            <Trans>Add Employee</Trans>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow-sm rounded-lg p-4 mb-6 dark:bg-zinc-900">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field>
            <Label>
              <Trans>Search</Trans>
            </Label>
            <Input
              type="text"
              name="search"
              placeholder={_(msg`Search by name or email...`)}
              value={filters.search || ""}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </Field>

          <Field>
            <Label>
              <Trans>Organizational Unit</Trans>
            </Label>
            <OrganizationalUnitPicker
              units={organizationalUnits}
              value={filters.organizational_unit_id ?? ""}
              onChange={(unitId) =>
                handleOrganizationalUnitFilter(unitId || undefined)
              }
              disabled={unitsLoading}
            />
          </Field>

          <Field>
            <Label>
              <Trans>Status</Trans>
            </Label>
            <Select
              name="status"
              value={filters.status || ""}
              onChange={(e) =>
                handleStatusFilter(
                  e.target.value
                    ? (e.target.value as EmployeeStatus)
                    : undefined
                )
              }
            >
              <option value="">
                <Trans>All</Trans>
              </option>
              <option value="pre_contract">
                <Trans>Pre-Contract</Trans>
              </option>
              <option value="active">
                <Trans>Active</Trans>
              </option>
              <option value="on_leave">
                <Trans>On Leave</Trans>
              </option>
              <option value="terminated">
                <Trans>Terminated</Trans>
              </option>
            </Select>
          </Field>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-900/20">
          <div className="mb-2 text-4xl">⚠️</div>
          <Heading level={3} className="text-red-900 dark:text-red-400">
            <Trans>Error Loading Employees</Trans>
          </Heading>
          <Text className="mt-2 text-red-700 dark:text-red-500">{error}</Text>
        </div>
      )}

      {/* Employee Table */}
      <Table className="[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
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
            <TableRow key={employee.id} href={`/employees/${employee.id}`}>
              <TableCell>
                <div>
                  <div className="font-medium">{employee.full_name}</div>
                  <div className="text-zinc-500 dark:text-zinc-400">
                    {employee.email}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-zinc-500">
                {employee.employee_number}
              </TableCell>
              <TableCell>{employee.position}</TableCell>
              <TableCell>
                <StatusBadge status={employee.status} />
              </TableCell>
              <TableCell className="text-zinc-500">
                {employee.organizational_unit.name}
              </TableCell>
              <TableCell>
                <div className="-mx-3 -my-1.5 sm:-mx-2.5">
                  <Button outline href={`/employees/${employee.id}`}>
                    <Trans>View</Trans>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      {pagination.last_page > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-6 rounded-lg">
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
              <Text className="text-sm text-gray-700">
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

export default EmployeeList;
