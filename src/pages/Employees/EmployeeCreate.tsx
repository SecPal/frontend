// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trans } from "@lingui/macro";
import {
  createEmployee,
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
 * Employee Create Form
 */
export function EmployeeCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);
      const employee = await createEmployee(formData);
      navigate(`/employees/${employee.id}`);
    } catch (err) {
      console.error("Failed to create employee:", err);
      let errorMessage = "Failed to create employee";

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
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts editing
    if (error) {
      setError(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Button plain onClick={() => navigate("/employees")}>
          <Trans>← Back to Employees</Trans>
        </Button>
      </div>

      <div className="rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 p-6 dark:bg-zinc-900 dark:ring-white/10">
        <Heading className="mb-6">
          <Trans>Create New Employee</Trans>
        </Heading>

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

                <Field>
                  <Label>
                    <Trans>Status</Trans> *
                  </Label>
                  <Select
                    name="status"
                    required
                    value={formData.status}
                    onChange={(e) => handleChange("status", e.target.value)}
                  >
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

                <Field>
                  <Label>
                    <Trans>Contract Type</Trans> *
                  </Label>
                  <Select
                    name="contract_type"
                    required
                    value={formData.contract_type}
                    onChange={(e) =>
                      handleChange("contract_type", e.target.value)
                    }
                  >
                    <option value="full_time">
                      <Trans>Full Time</Trans>
                    </option>
                    <option value="part_time">
                      <Trans>Part Time</Trans>
                    </option>
                    <option value="minijob">
                      <Trans>Minijob</Trans>
                    </option>
                    <option value="freelance">
                      <Trans>Freelance</Trans>
                    </option>
                  </Select>
                </Field>
              </div>
            </FieldGroup>
          </Fieldset>

          {error && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-900/20"
              role="alert"
              aria-live="assertive"
            >
              <Text className="text-red-800 dark:text-red-400">{error}</Text>
            </div>
          )}

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
