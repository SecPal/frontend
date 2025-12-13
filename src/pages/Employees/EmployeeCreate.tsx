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
import {
  Fieldset,
  Legend,
  FieldGroup,
  Field,
  Label,
} from "../../components/fieldset";
import { Input } from "../../components/input";

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

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <Text className="text-red-800">{error}</Text>
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
                  <Input
                    type="text"
                    name="organizational_unit_id"
                    required
                    placeholder={_(msg`Enter organization unit ID`)}
                    value={formData.organizational_unit_id}
                    onChange={(e) =>
                      handleChange("organizational_unit_id", e.target.value)
                    }
                  />
                </Field>
              </div>
            </FieldGroup>
          </Fieldset>

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
