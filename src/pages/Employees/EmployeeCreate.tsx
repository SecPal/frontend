// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import {
  createEmployee,
  type EmployeeFormData,
} from "../../services/employeeApi";
import { Heading } from "../../components/heading";
import { Button } from "../../components/button";
import { Text } from "../../components/text";

/**
 * Employee Create Form
 */
export function EmployeeCreate() {
  const navigate = useNavigate();
  const { _ } = useLingui();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    position: "",
    contract_start_date: "",
    organizational_unit_id: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);
      const employee = await createEmployee(formData);
      navigate(`/employees/${employee.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create employee"
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field: keyof EmployeeFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div>
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate("/employees")}
          className="text-indigo-600 hover:text-indigo-800"
        >
          <Trans>← Back to Employees</Trans>
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-lg p-6">
        <Heading className="mb-6">
          <Trans>Create New Employee</Trans>
        </Heading>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <Text className="text-red-800">{error}</Text>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              <Trans>Personal Information</Trans>
            </h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="first_name"
                  className="block text-sm font-medium text-gray-700"
                >
                  <Trans>First Name</Trans> *
                </label>
                <input
                  type="text"
                  id="first_name"
                  required
                  value={formData.first_name}
                  onChange={(e) => handleChange("first_name", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="last_name"
                  className="block text-sm font-medium text-gray-700"
                >
                  <Trans>Last Name</Trans> *
                </label>
                <input
                  type="text"
                  id="last_name"
                  required
                  value={formData.last_name}
                  onChange={(e) => handleChange("last_name", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="date_of_birth"
                  className="block text-sm font-medium text-gray-700"
                >
                  <Trans>Date of Birth</Trans> *
                </label>
                <input
                  type="date"
                  id="date_of_birth"
                  required
                  value={formData.date_of_birth}
                  onChange={(e) =>
                    handleChange("date_of_birth", e.target.value)
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  <Trans>Email</Trans> *
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700"
                >
                  <Trans>Phone</Trans>
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Employment Details */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              <Trans>Employment Details</Trans>
            </h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="position"
                  className="block text-sm font-medium text-gray-700"
                >
                  <Trans>Position</Trans> *
                </label>
                <input
                  type="text"
                  id="position"
                  required
                  value={formData.position}
                  onChange={(e) => handleChange("position", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="contract_start_date"
                  className="block text-sm font-medium text-gray-700"
                >
                  <Trans>Contract Start Date</Trans> *
                </label>
                <input
                  type="date"
                  id="contract_start_date"
                  required
                  value={formData.contract_start_date}
                  onChange={(e) =>
                    handleChange("contract_start_date", e.target.value)
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="organizational_unit_id"
                  className="block text-sm font-medium text-gray-700"
                >
                  <Trans>Organizational Unit</Trans> *
                </label>
                <input
                  type="text"
                  id="organizational_unit_id"
                  required
                  placeholder={_(msg`Enter organization unit ID`)}
                  value={formData.organizational_unit_id}
                  onChange={(e) =>
                    handleChange("organizational_unit_id", e.target.value)
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              outline
              onClick={() => navigate("/employees")}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Trans>Creating...</Trans>
              ) : (
                <Trans>Create Employee</Trans>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EmployeeCreate;
