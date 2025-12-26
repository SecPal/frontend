// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
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
import { Switch } from "../../components/switch";

/**
 * Employee Create Form
 */
export function EmployeeCreate() {
  const { i18n } = useLingui();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  // Display values for date inputs
  const [birthDateDisplay, setBirthDateDisplay] = useState("");
  const [contractDateDisplay, setContractDateDisplay] = useState("");
  // Date validation errors
  const [birthDateError, setBirthDateError] = useState<string | null>(null);
  const [contractDateError, setContractDateError] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [organizationalUnits, setOrganizationalUnits] = useState<
    OrganizationalUnit[]
  >([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [isLeadership, setIsLeadership] = useState(false);
  const [formData, setFormData] = useState<EmployeeFormData>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    position: "",
    contract_start_date: "",
    organizational_unit_id: "",
    management_level: 0,
    status: "pre_contract",
    contract_type: "full_time",
  });

  // Helper function to parse display format to ISO date with validation
  const parseDateToISO = (
    displayDate: string,
    locale: string
  ): { iso: string; formatted: string; valid: boolean } => {
    if (!displayDate) return { iso: "", formatted: "", valid: false };

    let parts: string[];
    let day: number, month: number, year: number;

    try {
      if (locale === "de") {
        // DD.MM.YYYY
        parts = displayDate.split(".");
        if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
          return { iso: "", formatted: displayDate, valid: false };
        }
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      } else {
        // MM/DD/YYYY
        parts = displayDate.split("/");
        if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
          return { iso: "", formatted: displayDate, valid: false };
        }
        month = parseInt(parts[0], 10);
        day = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      }

      // Validate ranges
      if (
        isNaN(day) ||
        isNaN(month) ||
        isNaN(year) ||
        year < 1900 ||
        year > 2100 ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31
      ) {
        return { iso: "", formatted: displayDate, valid: false };
      }

      // Check if date is valid (e.g., not 31.02.2025)
      const testDate = new Date(year, month - 1, day);
      if (
        testDate.getDate() !== day ||
        testDate.getMonth() !== month - 1 ||
        testDate.getFullYear() !== year
      ) {
        return { iso: "", formatted: displayDate, valid: false };
      }

      // Format ISO and display
      const dayStr = day.toString().padStart(2, "0");
      const monthStr = month.toString().padStart(2, "0");
      const yearStr = year.toString();
      const iso = `${yearStr}-${monthStr}-${dayStr}`;
      const formatted =
        locale === "de"
          ? `${dayStr}.${monthStr}.${yearStr}`
          : `${monthStr}/${dayStr}/${yearStr}`;

      return { iso, formatted, valid: true };
    } catch (e) {
      return { iso: "", formatted: displayDate, valid: false };
    }
  };

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

  function handleChange(
    field: keyof EmployeeFormData,
    value: string | number | null
  ) {
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
                    type="text"
                    name="date_of_birth"
                    required
                    placeholder={
                      i18n.locale === "de" ? "TT.MM.JJJJ" : "MM/DD/YYYY"
                    }
                    value={birthDateDisplay}
                    onChange={(e) => {
                      setBirthDateDisplay(e.target.value);
                      setBirthDateError(null); // Clear error on change
                    }}
                    onBlur={(e) => {
                      const result = parseDateToISO(
                        e.target.value,
                        i18n.locale
                      );
                      if (result.valid) {
                        setBirthDateDisplay(result.formatted);
                        handleChange("date_of_birth", result.iso);
                        setBirthDateError(null);
                      } else if (e.target.value) {
                        setBirthDateError(
                          i18n.locale === "de"
                            ? "Ungültiges Datum. Bitte verwenden Sie das Format TT.MM.JJJJ"
                            : "Invalid date. Please use format MM/DD/YYYY"
                        );
                      }
                    }}
                  />
                  {birthDateError && (
                    <Text className="text-red-600 dark:text-red-400 text-sm mt-1">
                      {birthDateError}
                    </Text>
                  )}
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
                    type="text"
                    name="contract_start_date"
                    required
                    placeholder={
                      i18n.locale === "de" ? "TT.MM.JJJJ" : "MM/DD/YYYY"
                    }
                    value={contractDateDisplay}
                    onChange={(e) => {
                      setContractDateDisplay(e.target.value);
                      setContractDateError(null); // Clear error on change
                    }}
                    onBlur={(e) => {
                      const result = parseDateToISO(
                        e.target.value,
                        i18n.locale
                      );
                      if (result.valid) {
                        setContractDateDisplay(result.formatted);
                        handleChange("contract_start_date", result.iso);
                        setContractDateError(null);
                      } else if (e.target.value) {
                        setContractDateError(
                          i18n.locale === "de"
                            ? "Ungültiges Datum. Bitte verwenden Sie das Format TT.MM.JJJJ"
                            : "Invalid date. Please use format MM/DD/YYYY"
                        );
                      }
                    }}
                  />
                  {contractDateError && (
                    <Text className="text-red-600 dark:text-red-400 text-sm mt-1">
                      {contractDateError}
                    </Text>
                  )}
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

                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Label>
                      <Trans>Leadership Position</Trans>
                    </Label>
                    <Switch
                      name="is_leadership"
                      checked={isLeadership}
                      showIcons
                      onChange={(checked) => {
                        setIsLeadership(checked);
                        if (!checked) {
                          handleChange("management_level", 0);
                        }
                      }}
                    />
                  </div>

                  <Field>
                    <span
                      data-slot="control"
                      className="relative block w-full before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm dark:before:hidden after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500"
                    >
                      <div className="relative flex items-center rounded-lg border border-zinc-950/10 bg-transparent dark:border-white/10 dark:bg-white/5">
                        {isLeadership && (
                          <div className="shrink-0 pl-3.5 pr-2 py-2.5 text-base/6 text-gray-500 select-none sm:pl-3 sm:pr-2 sm:py-1.5 sm:text-sm/6 dark:text-gray-400">
                            <Trans>ML</Trans>
                          </div>
                        )}
                        <input
                          type="number"
                          name="management_level"
                          min="1"
                          max="255"
                          placeholder={
                            isLeadership
                              ? "?"
                              : i18n._(msg`No management position`)
                          }
                          disabled={!isLeadership}
                          required={isLeadership}
                          value={
                            isLeadership && formData.management_level > 0
                              ? formData.management_level
                              : ""
                          }
                          onChange={(e) =>
                            handleChange(
                              "management_level",
                              e.target.value ? Number(e.target.value) : 0
                            )
                          }
                          className={`relative block w-full appearance-none rounded-lg py-2.5 pr-3.5 text-base/6 text-zinc-950 placeholder:text-zinc-500 bg-transparent focus:outline-hidden sm:py-1.5 sm:pr-3 sm:text-sm/6 dark:text-white dark:placeholder:text-zinc-500 disabled:opacity-50 border-0 ${isLeadership ? "pl-0" : "pl-3.5 sm:pl-3"}`}
                        />
                      </div>
                    </span>
                  </Field>
                </div>

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
