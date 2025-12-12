// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import {
  fetchEmployees,
  type Employee,
  type EmployeeStatus,
  type EmployeeFilters,
} from "../../services/employeeApi";
import { Heading } from "../../components/heading";
import { Button } from "../../components/button";
import { Text } from "../../components/text";

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: EmployeeStatus }) {
  const colors = {
    pre_contract: "bg-yellow-100 text-yellow-800",
    active: "bg-green-100 text-green-800",
    on_leave: "bg-blue-100 text-blue-800",
    terminated: "bg-gray-100 text-gray-800",
  };

  const labels = {
    pre_contract: <Trans>Pre-Contract</Trans>,
    active: <Trans>Active</Trans>,
    on_leave: <Trans>On Leave</Trans>,
    terminated: <Trans>Terminated</Trans>,
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}
    >
      {labels[status]}
    </span>
  );
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

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchEmployees(filters);
      setEmployees(response.data);
      setPagination(response.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  function handleStatusFilter(status: EmployeeStatus | undefined) {
    setFilters({ ...filters, status, page: 1 });
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
      <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              htmlFor="search"
              className="block text-sm font-medium text-gray-700"
            >
              <Trans>Search</Trans>
            </label>
            <input
              type="text"
              id="search"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder={_(msg`Search by name or email...`)}
              value={filters.search || ""}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium text-gray-700"
            >
              <Trans>Status</Trans>
            </label>
            <select
              id="status"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
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
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <Text className="text-red-800">{error}</Text>
        </div>
      )}

      {/* Employee Table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <Trans>Employee</Trans>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <Trans>Employee #</Trans>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <Trans>Position</Trans>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <Trans>Status</Trans>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <Trans>Unit</Trans>
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">
                  <Trans>Actions</Trans>
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employees.map((employee) => (
              <tr key={employee.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {employee.full_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {employee.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {employee.employee_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {employee.position}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={employee.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {employee.organizational_unit.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link
                    to={`/employees/${employee.id}`}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    <Trans>View</Trans>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
