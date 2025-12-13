// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Trans } from "@lingui/macro";
import {
  fetchEmployee,
  updateEmployee,
  type Employee,
  type EmployeeFormData,
} from "../../services/employeeApi";
import { listOrganizationalUnits } from "../../services/organizationalUnitApi";
import type { OrganizationalUnit } from "../../types/organizational";
import { Heading } from "../../components/heading";
import { Button } from "../../components/button";
import { Text } from "../../components/text";
import {
  Fieldset,
  Legend,
  FieldGroup,
  Field,
  Label,
} from "../../components/fieldset";
import { Input } from "../../components/input";
import { Select } from "../../components/select";

/**
 * Employee Edit Form
 */
export function EmployeeEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationalUnits, setOrganizationalUnits] = useState<
    OrganizationalUnit[]
  >([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [formData, setFormData] = useState<EmployeeFormData>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    position: "",
    contract_start_date: "",
    organizational_unit_id: "",
    status: "pre_contract",
    contract_type: "full_time",
  });

  useEffect(() => {
    async function loadOrganizationalUnits() {
      try {
        const response = await listOrganizationalUnits();
        setOrganizationalUnits(response.data);
      } catch (err) {
        console.error("Failed to load organizational units:", err);
      } finally {
        setUnitsLoading(false);
      }
    }
    loadOrganizationalUnits();
  }, []);

  const loadEmployee = useCallback(async () => {
    if (!id) return;

    try {
      setFetchLoading(true);
      setError(null);
      const employee: Employee = await fetchEmployee(id);

      // Populate form with existing data
      setFormData({
        first_name: employee.first_name || "",
        last_name: employee.last_name || "",
        email: employee.email,
        phone: employee.phone || "",
        date_of_birth: employee.date_of_birth,
        position: employee.position,
        contract_start_date: employee.contract_start_date,
        organizational_unit_id: employee.organizational_unit.id,
        status: employee.status,
        contract_type: employee.contract_type || "full_time",
      });
    } catch (err) {
      console.error("Failed to load employee:", err);
      let errorMessage = "Failed to load employee";

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err !== null && "message" in err) {
        errorMessage = String(err.message);
      }

      setError(errorMessage);
    } finally {
      setFetchLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadEmployee();
  }, [loadEmployee]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      await updateEmployee(id, formData);
      navigate(`/employees/${id}`);
    } catch (err) {
      console.error("Failed to update employee:", err);
      let errorMessage = "Failed to update employee";

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err !== null && "message" in err) {
        errorMessage = String(err.message);
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field: keyof EmployeeFormData, value: string) {
    setFormData((prev: EmployeeFormData) => ({ ...prev, [field]: value }));
  }

  if (fetchLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Text>
          <Trans>Loading employee...</Trans>
        </Text>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-900/20">
          <div className="mb-4 text-4xl">❌</div>
          <Heading level={3} className="text-red-900 dark:text-red-400">
            <Trans>Error Loading Employee</Trans>
          </Heading>
          <Text className="mt-2 text-red-700 dark:text-red-500">{error}</Text>
          <div className="mt-4">
            <Button href="/employees" color="red">
              <Trans>Back to Employees</Trans>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Button plain onClick={() => navigate(`/employees/${id}`)}>
          <Trans>← Back to Employee</Trans>
        </Button>
      </div>

      <div className="rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 p-6 dark:bg-zinc-900 dark:ring-white/10">
        <Heading className="mb-6">
          <Trans>Edit Employee</Trans>
        </Heading>

        {error && !fetchLoading && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-900/20">
            <div className="mb-2 text-4xl">⚠️</div>
            <Heading level={3} className="text-red-900 dark:text-red-400">
              <Trans>Error</Trans>
            </Heading>
            <Text className="mt-2 text-red-700 dark:text-red-500">{error}</Text>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal Information */}
          <Fieldset>
            <Legend>
              <Trans>Personal Information</Trans>
            </Legend>
            <FieldGroup>
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <Field>
                  <Label>
                    <Trans>First Name</Trans> *
                  </Label>
                  <Input
                    type="text"
                    name="first_name"
                    required
                    value={formData.first_name}
                    onChange={(e) => handleChange("first_name", e.target.value)}
                  />
                </Field>

                <Field>
                  <Label>
                    <Trans>Last Name</Trans> *
                  </Label>
                  <Input
                    type="text"
                    name="last_name"
                    required
                    value={formData.last_name}
                    onChange={(e) => handleChange("last_name", e.target.value)}
                  />
                </Field>

                <Field>
                  <Label>
                    <Trans>Date of Birth</Trans> *
                  </Label>
                  <Input
                    type="date"
                    name="date_of_birth"
                    required
                    value={formData.date_of_birth}
                    onChange={(e) =>
                      handleChange("date_of_birth", e.target.value)
                    }
                  />
                </Field>

                <Field>
                  <Label>
                    <Trans>Email</Trans> *
                  </Label>
                  <Input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                  />
                </Field>

                <Field>
                  <Label>
                    <Trans>Phone</Trans>
                  </Label>
                  <Input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                  />
                </Field>
              </div>
            </FieldGroup>
          </Fieldset>

          {/* Employment Details */}
          <Fieldset>
            <Legend>
              <Trans>Employment Details</Trans>
            </Legend>
            <FieldGroup>
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <Field>
                  <Label>
                    <Trans>Position</Trans> *
                  </Label>
                  <Input
                    type="text"
                    name="position"
                    required
                    value={formData.position}
                    onChange={(e) => handleChange("position", e.target.value)}
                  />
                </Field>

                <Field>
                  <Label>
                    <Trans>Contract Start Date</Trans> *
                  </Label>
                  <Input
                    type="date"
                    name="contract_start_date"
                    required
                    value={formData.contract_start_date}
                    onChange={(e) =>
                      handleChange("contract_start_date", e.target.value)
                    }
                  />
                </Field>

                <Field>
                  <Label>
                    <Trans>Organizational Unit</Trans> *
                  </Label>
                  <Select
                    name="organizational_unit_id"
                    required
                    value={formData.organizational_unit_id}
                    onChange={(e) =>
                      handleChange("organizational_unit_id", e.target.value)
                    }
                    disabled={unitsLoading}
                  >
                    <option value="">
                      {unitsLoading ? (
                        <Trans>Loading...</Trans>
                      ) : (
                        <Trans>Select organizational unit</Trans>
                      )}
                    </option>
                    {organizationalUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </FieldGroup>
          </Fieldset>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              outline
              onClick={() => navigate(`/employees/${id}`)}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Trans>Saving...</Trans> : <Trans>Save Changes</Trans>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EmployeeEdit;
