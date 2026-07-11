// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import type { Employee, EmployeeAddress, EmployeeFormData } from "@/types/api";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { FormSkeleton, LoadingRegion } from "@/ui/loading";
import { Skeleton } from "@/ui/skeleton";
import { fetchEmployee, updateEmployee } from "../../services/employeeApi";
import { listOrganizationalUnits } from "../../services/organizationalUnitApi";
import type { OrganizationalUnit } from "../../types/organizational";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  FieldGroup,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  EmployeeFieldset as Fieldset,
  EmployeeLegend as Legend,
  EmployeeLinkButton as LinkButton,
  EmployeePageText as PageText,
  EmployeePageTitle as PageTitle,
} from "@/ui";
import { EmployeeStatusSelectItems } from "./EmployeeStatusOptions";
import { EmployeeAddressFields } from "./EmployeeAddressFields";
import {
  employeeAddressToDraft,
  emptyPostalAddressDraft,
  hasPostalAddressDraftValue,
} from "./employeeAddressDraft";
import {
  buildAddressesPayloadForCurrentEdit,
  getCurrentAddressFromList,
  mergeAddressBaseList,
  type PostalAddressDraft,
} from "../../lib/employeeAddresses";
import {
  formatEmployeeDateForDisplay,
  GERMAN_CONTRACT_START_DATE_FORMAT,
  GERMAN_CONTRACT_START_DATE_HINT,
  parseEmployeeDateToISO,
} from "./employeeDateUtils";
import { EmployeeManagementLevelField } from "./EmployeeManagementLevelField";

/**
 * Employee Edit Form
 */
export function EmployeeEdit() {
  const { i18n } = useLingui();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  // Display values for date inputs
  const [birthDateDisplay, setBirthDateDisplay] = useState("");
  const [contractDateDisplay, setContractDateDisplay] = useState("");
  const [birthDateDirty, setBirthDateDirty] = useState(false);
  const [contractDateDirty, setContractDateDirty] = useState(false);
  // Date validation errors
  const [birthDateError, setBirthDateError] = useState<string | null>(null);
  const [contractDateError, setContractDateError] = useState<string | null>(
    null
  );
  const [fetchLoading, setFetchLoading] = useState(id !== undefined);
  const [error, setError] = useState<string | null>(
    id === undefined ? i18n._(msg`Employee ID is missing.`) : null
  );
  const [organizationalUnits, setOrganizationalUnits] = useState<
    OrganizationalUnit[]
  >([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [isLeadership, setIsLeadership] = useState(false);
  const [addressDraft, setAddressDraft] = useState<PostalAddressDraft>(
    emptyPostalAddressDraft
  );
  const [addressRowsSnapshot, setAddressRowsSnapshot] = useState<
    EmployeeAddress[]
  >([]);
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

  useEffect(() => {
    async function loadOrganizationalUnits() {
      try {
        const response = await listOrganizationalUnits();
        setOrganizationalUnits(
          response.data.filter((unit) => unit.is_assignable !== false)
        );
      } catch (err) {
        console.error("Failed to load organizational units:", err);
      } finally {
        setUnitsLoading(false);
      }
    }

    loadOrganizationalUnits();
  }, []);

  useEffect(() => {
    if (!id) {
      return;
    }

    let active = true;

    void fetchEmployee(id)
      .then((employee: Employee) => {
        if (!active) {
          return;
        }

        setError(null);
        setFormData({
          first_name: employee.first_name || "",
          last_name: employee.last_name || "",
          email: employee.email,
          phone: employee.phone || "",
          date_of_birth: employee.date_of_birth || "",
          position: employee.position || "",
          contract_start_date: employee.contract_start_date || "",
          organizational_unit_id: employee.organizational_unit?.id || "",
          management_level: employee.management_level,
          status: employee.status,
          contract_type: employee.contract_type || "full_time",
        });
        const addressRows = mergeAddressBaseList(
          employee.addresses,
          employee.current_address
        );
        setAddressRowsSnapshot(addressRows);
        setAddressDraft(
          employeeAddressToDraft(
            employee.current_address ?? getCurrentAddressFromList(addressRows)
          )
        );
        setIsLeadership(employee.management_level > 0);

        setBirthDateDirty(false);
        setContractDateDirty(false);
      })
      .catch((err) => {
        if (!active) {
          return;
        }

        console.error("Failed to load employee:", err);
        let errorMessage = "Failed to load employee";

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
      })
      .finally(() => {
        if (active) {
          setFetchLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  const dateDisplayLocale = i18n.locale === "de" ? "de" : "en";
  const birthDateInputValue = birthDateDirty
    ? birthDateDisplay
    : formatEmployeeDateForDisplay(formData.date_of_birth, dateDisplayLocale);
  const contractDateInputValue = contractDateDirty
    ? contractDateDisplay
    : formatEmployeeDateForDisplay(
        formData.contract_start_date,
        dateDisplayLocale
      );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) {
      console.error("Cannot submit employee form: missing employee ID.");
      setError(i18n._(msg`Employee ID is missing. Cannot submit form.`));
      return;
    }

    let normalizedBirthDateIso = formData.date_of_birth;
    let normalizedBirthDateDisplay: string;
    if (birthDateDirty) {
      const birthDateResult = parseEmployeeDateToISO(
        birthDateDisplay,
        i18n.locale
      );
      if (!birthDateResult.valid) {
        const format = i18n.locale === "de" ? "TT.MM.JJJJ" : "MM/DD/YYYY";
        setBirthDateError(
          i18n._(msg`Invalid date. Please use format ${format}`)
        );
        return;
      }

      normalizedBirthDateIso = birthDateResult.iso;
      normalizedBirthDateDisplay = birthDateResult.formatted;
    } else {
      normalizedBirthDateDisplay = formatEmployeeDateForDisplay(
        formData.date_of_birth,
        dateDisplayLocale
      );
    }

    let normalizedContractDateIso = formData.contract_start_date;
    let normalizedContractDateDisplay: string;
    if (contractDateDirty) {
      const contractDateResult = parseEmployeeDateToISO(
        contractDateDisplay,
        i18n.locale,
        {
          defaultCurrentYearForMissingYear: i18n.locale === "de",
        }
      );
      if (!contractDateResult.valid) {
        const format =
          i18n.locale === "de"
            ? GERMAN_CONTRACT_START_DATE_FORMAT
            : "MM/DD/YYYY";
        setContractDateError(
          i18n._(msg`Invalid date. Please use format ${format}`)
        );
        return;
      }

      normalizedContractDateIso = contractDateResult.iso;
      normalizedContractDateDisplay = contractDateResult.formatted;
    } else {
      normalizedContractDateDisplay = formatEmployeeDateForDisplay(
        formData.contract_start_date,
        dateDisplayLocale
      );
    }

    try {
      setLoading(true);
      setError(null);
      setBirthDateDisplay(normalizedBirthDateDisplay);
      setContractDateDisplay(normalizedContractDateDisplay);
      setBirthDateError(null);
      setContractDateError(null);
      setBirthDateDirty(false);
      setContractDateDirty(false);

      const updatePayload: Partial<EmployeeFormData> = {
        ...formData,
        date_of_birth: normalizedBirthDateIso,
        contract_start_date: normalizedContractDateIso,
      };
      if (
        addressRowsSnapshot.length > 0 ||
        hasPostalAddressDraftValue(addressDraft)
      ) {
        updatePayload.addresses = buildAddressesPayloadForCurrentEdit(
          addressRowsSnapshot,
          addressDraft,
          { emptyCountryCodes: ["DE"] }
        );
      }
      delete updatePayload.status;
      await updateEmployee(id, updatePayload);
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

  function handleChange(
    field: keyof EmployeeFormData,
    value: string | number | null
  ) {
    setFormData((prev: EmployeeFormData) => ({ ...prev, [field]: value }));
  }

  function handleAddressChange(field: keyof PostalAddressDraft, value: string) {
    setAddressDraft((prev) => ({ ...prev, [field]: value }));
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <Alert className="max-w-md border-destructive/30 bg-destructive/10 p-6 text-center text-foreground">
          <AlertTitle className="text-destructive">
            <Trans>Error Loading Employee</Trans>
          </AlertTitle>
          <AlertDescription className="text-destructive mt-2">
            {error}
          </AlertDescription>
          <div className="mt-4">
            <LinkButton to="/employees" variant="destructive">
              <Trans>Back to Employees</Trans>
            </LinkButton>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(`/employees/${id}`)}>
          <Trans>← Back to Employee</Trans>
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <PageTitle className="mb-6">
            <Trans>Edit Employee</Trans>
          </PageTitle>

          {fetchLoading ? (
            <FormSkeleton
              loadingLabel={i18n._(msg`Loading employee form`)}
              fields={10}
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Personal Information */}
              <Fieldset>
                <Legend>
                  <Trans>Personal Information</Trans>
                </Legend>
                <FieldGroup>
                  <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="first_name">
                        <Trans>First Name</Trans> *
                      </FieldLabel>
                      <Input
                        id="first_name"
                        type="text"
                        name="first_name"
                        required
                        value={formData.first_name}
                        onChange={(e) =>
                          handleChange("first_name", e.target.value)
                        }
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="last_name">
                        <Trans>Last Name</Trans> *
                      </FieldLabel>
                      <Input
                        id="last_name"
                        type="text"
                        name="last_name"
                        required
                        value={formData.last_name}
                        onChange={(e) =>
                          handleChange("last_name", e.target.value)
                        }
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="date_of_birth">
                        <Trans>Date of Birth</Trans> *
                      </FieldLabel>
                      <Input
                        id="date_of_birth"
                        type="text"
                        name="date_of_birth"
                        required
                        aria-invalid={birthDateError ? true : undefined}
                        aria-describedby={
                          birthDateError ? "date_of_birth-error" : undefined
                        }
                        placeholder={
                          i18n.locale === "de" ? "TT.MM.JJJJ" : "MM/DD/YYYY"
                        }
                        value={birthDateInputValue}
                        onChange={(e) => {
                          setBirthDateDisplay(e.target.value);
                          setBirthDateDirty(true);
                          setBirthDateError(null); // Clear error on change
                        }}
                        onBlur={(e) => {
                          const result = parseEmployeeDateToISO(
                            e.target.value,
                            i18n.locale
                          );
                          if (result.valid) {
                            setBirthDateDisplay(result.formatted);
                            handleChange("date_of_birth", result.iso);
                            setBirthDateDirty(false);
                            setBirthDateError(null);
                          } else if (e.target.value) {
                            const format =
                              i18n.locale === "de"
                                ? "TT.MM.JJJJ"
                                : "MM/DD/YYYY";
                            setBirthDateError(
                              i18n._(
                                msg`Invalid date. Please use format ${format}`
                              )
                            );
                          }
                        }}
                      />
                      {birthDateError && (
                        <FieldError id="date_of_birth-error">
                          {birthDateError}
                        </FieldError>
                      )}
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="email">
                        <Trans>Email</Trans> *
                      </FieldLabel>
                      <Input
                        id="email"
                        type="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="phone">
                        <Trans>Phone</Trans>
                      </FieldLabel>
                      <Input
                        id="phone"
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                      />
                    </Field>

                    <div className="sm:col-span-2">
                      <PageText className="text-foreground text-sm font-semibold">
                        <Trans>Current Address</Trans>
                      </PageText>
                    </div>

                    <EmployeeAddressFields
                      draft={addressDraft}
                      onChange={handleAddressChange}
                    />
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
                      <FieldLabel htmlFor="position">
                        <Trans>Position</Trans> *
                      </FieldLabel>
                      <Input
                        id="position"
                        type="text"
                        name="position"
                        required
                        value={formData.position}
                        onChange={(e) =>
                          handleChange("position", e.target.value)
                        }
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="contract_start_date">
                        <Trans>Contract Start Date</Trans> *
                      </FieldLabel>
                      <Input
                        id="contract_start_date"
                        type="text"
                        name="contract_start_date"
                        required
                        aria-invalid={contractDateError ? true : undefined}
                        aria-describedby={
                          contractDateError
                            ? "contract_start_date-error"
                            : undefined
                        }
                        placeholder={
                          i18n.locale === "de" ? "TT.MM.JJJJ" : "MM/DD/YYYY"
                        }
                        value={contractDateInputValue}
                        onChange={(e) => {
                          setContractDateDisplay(e.target.value);
                          setContractDateDirty(true);
                          setContractDateError(null); // Clear error on change
                        }}
                        onBlur={(e) => {
                          const result = parseEmployeeDateToISO(
                            e.target.value,
                            i18n.locale,
                            {
                              defaultCurrentYearForMissingYear:
                                i18n.locale === "de",
                            }
                          );
                          if (result.valid) {
                            setContractDateDisplay(result.formatted);
                            handleChange("contract_start_date", result.iso);
                            setContractDateDirty(false);
                            setContractDateError(null);
                          } else if (e.target.value) {
                            const format =
                              i18n.locale === "de"
                                ? GERMAN_CONTRACT_START_DATE_FORMAT
                                : "MM/DD/YYYY";
                            setContractDateError(
                              i18n._(
                                msg`Invalid date. Please use format ${format}`
                              )
                            );
                          }
                        }}
                      />
                      {i18n.locale === "de" && (
                        <FieldDescription>
                          {GERMAN_CONTRACT_START_DATE_HINT}
                        </FieldDescription>
                      )}
                      {contractDateError && (
                        <FieldError id="contract_start_date-error">
                          {contractDateError}
                        </FieldError>
                      )}
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="organizational_unit_id">
                        <Trans>Organizational Unit</Trans> *
                      </FieldLabel>
                      <LoadingRegion
                        loading={unitsLoading}
                        loadingLabel={i18n._(msg`Loading unit options`)}
                      >
                        <Select
                          value={
                            unitsLoading ? "" : formData.organizational_unit_id
                          }
                          onValueChange={(value) =>
                            handleChange("organizational_unit_id", value)
                          }
                          disabled={unitsLoading}
                        >
                          <SelectTrigger id="organizational_unit_id">
                            <SelectValue
                              placeholder={
                                unitsLoading
                                  ? i18n._(msg`Loading...`)
                                  : i18n._(msg`Select organizational unit`)
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {organizationalUnits.map((unit) => (
                              <SelectItem
                                key={unit.id}
                                value={unit.id}
                                data-value={unit.id}
                              >
                                {unit.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {unitsLoading ? (
                          <Skeleton className="mt-2 h-4 w-48 max-w-full" />
                        ) : null}
                      </LoadingRegion>
                    </Field>

                    <EmployeeManagementLevelField
                      checked={isLeadership}
                      noManagementPlaceholder={i18n._(
                        msg`No management position`
                      )}
                      onCheckedChange={(checked) => {
                        setIsLeadership(checked);
                        if (!checked) {
                          handleChange("management_level", 0);
                        }
                      }}
                      onValueChange={(value) =>
                        handleChange("management_level", value)
                      }
                      value={formData.management_level}
                    />

                    <Field>
                      <FieldLabel htmlFor="status">
                        <Trans>Status</Trans>
                      </FieldLabel>
                      <Select value={formData.status} disabled>
                        <SelectTrigger id="status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <EmployeeStatusSelectItems />
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        <Trans>
                          Applicant / Pre-Contract / Active / On Leave /
                          Terminated
                        </Trans>
                      </FieldDescription>
                      <FieldDescription>
                        <Trans>
                          Invitations are only available for employees in
                          pre-contract status.
                        </Trans>
                      </FieldDescription>
                    </Field>
                  </div>
                </FieldGroup>
              </Fieldset>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/employees/${id}`)}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <Trans>Saving...</Trans>
                  ) : (
                    <Trans>Save Changes</Trans>
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default EmployeeEdit;
