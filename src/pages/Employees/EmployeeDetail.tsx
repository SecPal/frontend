// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { msg, Trans } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import type {
  Employee,
  EmployeeBwrExportFormat,
  EmployeeBwrManagedStatus,
  EmployeeBwrStatus,
  EmployeeOnboardingInvitationStatus,
} from "@/types/api";
import { formatDate, formatDateTime } from "../../lib/dateUtils";
import {
  fetchEmployee,
  activateEmployee,
  confirmEmployeeOnboarding,
  exportEmployeeBwr,
  terminateEmployee,
  updateEmployeeBwrStatus,
} from "../../services/employeeApi";
import { ApiError } from "../../services/ApiError";
import {
  fetchEmployeeQualifications,
  type EmployeeQualification,
} from "../../services/qualificationApi";
import {
  fetchEmployeeDocuments,
  type EmployeeDocument,
} from "../../services/employeeDocumentApi";
import { Heading } from "../../components/heading";
import { Button } from "../../components/button";
import { Text } from "../../components/text";
import { Badge } from "../../components/badge";
import {
  Description as FieldDescription,
  ErrorMessage,
  Field,
  Label,
} from "../../components/fieldset";
import { Input } from "../../components/input";
import { Select } from "../../components/select";
import { Textarea } from "../../components/textarea";
import { useUserCapabilities } from "../../hooks/useUserCapabilities";
import {
  DescriptionList,
  DescriptionTerm,
  DescriptionDetails,
} from "../../components/description-list";

type BwrPanelFieldErrors = Partial<
  Record<"general" | "status" | "bwr_id" | "notes", string[]>
>;

const BWR_EXPORT_FORMATS: EmployeeBwrExportFormat[] = ["csv", "xml"];

function getBwrStatusColor(status: EmployeeBwrStatus) {
  switch (status) {
    case "not_registered":
      return "zinc" as const;
    case "pending":
      return "yellow" as const;
    case "active":
      return "green" as const;
    case "suspended":
      return "orange" as const;
    case "revoked":
      return "rose" as const;
  }
}

function getBwrStatusLabel(
  status: EmployeeBwrStatus,
  translate: ReturnType<typeof useLingui>["_"]
) {
  switch (status) {
    case "not_registered":
      return translate(msg`Not registered`);
    case "pending":
      return translate(msg`Pending`);
    case "active":
      return translate(msg`Active`);
    case "suspended":
      return translate(msg`Suspended`);
    case "revoked":
      return translate(msg`Revoked`);
  }
}

function getManagedBwrStatuses(
  currentStatus: EmployeeBwrStatus
): EmployeeBwrManagedStatus[] {
  const allowedTransitions: Record<
    EmployeeBwrManagedStatus,
    EmployeeBwrManagedStatus[]
  > = {
    pending: ["active", "suspended", "revoked"],
    active: ["suspended", "revoked"],
    suspended: ["active", "revoked"],
    revoked: ["active"],
  };

  if (currentStatus === "not_registered") {
    return [];
  }

  return [currentStatus, ...(allowedTransitions[currentStatus] ?? [])];
}

function normalizeBwrFieldErrors(
  errors: Record<string, string[]> | undefined
): BwrPanelFieldErrors {
  if (!errors) {
    return {};
  }

  const nextErrors: BwrPanelFieldErrors = {};
  for (const key of ["general", "status", "bwr_id", "notes"] as const) {
    const messages = errors[key];
    if (messages && messages.length > 0) {
      nextErrors[key] = messages;
    }
  }

  return nextErrors;
}

function getBwrErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }

  return fallback;
}

interface EmployeeBwrPanelProps {
  employee: Employee;
  canManage: boolean;
  onRefresh: () => Promise<Employee | null>;
}

function EmployeeBwrPanel({
  employee,
  canManage,
  onRefresh,
}: EmployeeBwrPanelProps) {
  const { i18n, _ } = useLingui();
  const currentStatus = employee.bwr_status ?? "not_registered";
  const [exportFormat, setExportFormat] =
    useState<EmployeeBwrExportFormat>("csv");
  const [selectedStatus, setSelectedStatus] =
    useState<EmployeeBwrManagedStatus>(
      currentStatus === "not_registered" ? "pending" : currentStatus
    );
  const [bwrId, setBwrId] = useState(employee.bwr_id ?? "");
  const [notes, setNotes] = useState(employee.bwr_notes ?? "");
  const [latestExportUrl, setLatestExportUrl] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelFieldErrors, setPanelFieldErrors] = useState<BwrPanelFieldErrors>(
    {}
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const managedStatusOptions = getManagedBwrStatuses(currentStatus);

  function clearPanelFeedback() {
    setPanelError(null);
    setPanelFieldErrors({});
    setSuccessMessage(null);
  }

  async function handleExport() {
    clearPanelFeedback();

    try {
      setExportLoading(true);
      const response = await exportEmployeeBwr(employee.id, exportFormat);
      setLatestExportUrl(response.download_url);
      const refreshedEmployee = await onRefresh();
      if (refreshedEmployee) {
        const refreshedStatus =
          refreshedEmployee.bwr_status ?? "not_registered";
        setSelectedStatus(
          refreshedStatus === "not_registered" ? "pending" : refreshedStatus
        );
        setBwrId(refreshedEmployee.bwr_id ?? "");
        setNotes(refreshedEmployee.bwr_notes ?? "");
      }
      setSuccessMessage(_(msg`BWR export generated. Download the file below.`));
    } catch (error) {
      setPanelError(getBwrErrorMessage(error, "Failed to generate BWR export"));
      setPanelFieldErrors(
        error instanceof ApiError ? normalizeBwrFieldErrors(error.errors) : {}
      );
    } finally {
      setExportLoading(false);
    }
  }

  async function handleSaveStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearPanelFeedback();

    try {
      setSaveLoading(true);
      await updateEmployeeBwrStatus(employee.id, {
        status: selectedStatus,
        bwr_id: bwrId.trim() === "" ? null : bwrId.trim(),
        notes: notes.trim() === "" ? null : notes.trim(),
      });
      const refreshedEmployee = await onRefresh();
      if (refreshedEmployee) {
        const refreshedStatus =
          refreshedEmployee.bwr_status ?? "not_registered";
        setSelectedStatus(
          refreshedStatus === "not_registered" ? "pending" : refreshedStatus
        );
        setBwrId(refreshedEmployee.bwr_id ?? "");
        setNotes(refreshedEmployee.bwr_notes ?? "");
      }
      setSuccessMessage(_(msg`BWR status updated.`));
    } catch (error) {
      setPanelError(getBwrErrorMessage(error, "Failed to update BWR status"));
      setPanelFieldErrors(
        error instanceof ApiError ? normalizeBwrFieldErrors(error.errors) : {}
      );
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-950/10 p-5 dark:border-white/10">
      <div className="space-y-1">
        <Heading level={2}>
          <Trans>Bewacherregister</Trans>
        </Heading>
        <Text className="text-sm text-zinc-500 dark:text-zinc-400">
          <Trans>
            Manage the employee's BWR export and registration state from the
            dedicated runtime endpoints.
          </Trans>
        </Text>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1 rounded-xl bg-zinc-50 p-4 dark:bg-white/5">
          <Text className="text-sm text-zinc-500 dark:text-zinc-400">
            <Trans>BWR Status</Trans>
          </Text>
          <Badge color={getBwrStatusColor(currentStatus)}>
            {getBwrStatusLabel(currentStatus, _)}
          </Badge>
        </div>
        <div className="space-y-1 rounded-xl bg-zinc-50 p-4 dark:bg-white/5">
          <Text className="text-sm text-zinc-500 dark:text-zinc-400">
            <Trans>BWR ID</Trans>
          </Text>
          <Text>{employee.bwr_id || "-"}</Text>
        </div>
        <div className="space-y-1 rounded-xl bg-zinc-50 p-4 dark:bg-white/5">
          <Text className="text-sm text-zinc-500 dark:text-zinc-400">
            <Trans>BWR Submission Date</Trans>
          </Text>
          <Text>
            {employee.bwr_submission_date
              ? formatDate(employee.bwr_submission_date, i18n.locale)
              : "-"}
          </Text>
        </div>
        <div className="space-y-1 rounded-xl bg-zinc-50 p-4 dark:bg-white/5">
          <Text className="text-sm text-zinc-500 dark:text-zinc-400">
            <Trans>BWR Registered At</Trans>
          </Text>
          <Text>
            {employee.bwr_registered_at
              ? formatDateTime(employee.bwr_registered_at, i18n.locale)
              : "-"}
          </Text>
        </div>
      </div>

      <div className="space-y-1 rounded-xl bg-zinc-50 p-4 dark:bg-white/5">
        <Text className="text-sm text-zinc-500 dark:text-zinc-400">
          <Trans>BWR Notes</Trans>
        </Text>
        <Text>{employee.bwr_notes || "-"}</Text>
      </div>

      {panelError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          <Text>{panelError}</Text>
          {panelFieldErrors.general && panelFieldErrors.general.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {panelFieldErrors.general.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
          {successMessage}
        </div>
      ) : null}

      {latestExportUrl ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-zinc-50 p-4 dark:bg-white/5">
          <Text className="text-sm text-zinc-500 dark:text-zinc-400">
            <Trans>Latest export</Trans>
          </Text>
          <a
            className="inline-flex items-center justify-center rounded-lg border border-zinc-950/10 px-3.5 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-950/2.5 sm:px-3 sm:py-1.5 dark:border-white/15 dark:text-white dark:hover:bg-white/5"
            href={latestExportUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Trans>Download Latest Export</Trans>
          </a>
        </div>
      ) : null}

      {!canManage ? (
        <Text className="text-sm text-zinc-500 dark:text-zinc-400">
          <Trans>
            You can inspect BWR data, but write permission is required to manage
            it.
          </Trans>
        </Text>
      ) : currentStatus === "not_registered" ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,14rem)_auto] md:items-end">
          <Field>
            <Label htmlFor="bwr-export-format">
              <Trans>Export Format</Trans>
            </Label>
            <Select
              id="bwr-export-format"
              value={exportFormat}
              onChange={(event) =>
                setExportFormat(event.target.value as EmployeeBwrExportFormat)
              }
            >
              {BWR_EXPORT_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {format.toUpperCase()}
                </option>
              ))}
            </Select>
            <FieldDescription>
              <Trans>
                Generate the initial export to move this employee into the
                pending BWR state.
              </Trans>
            </FieldDescription>
          </Field>

          <Button disabled={exportLoading} onClick={() => void handleExport()}>
            {exportLoading ? (
              <Trans>Generating BWR Export...</Trans>
            ) : (
              <Trans>Generate BWR Export</Trans>
            )}
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSaveStatus}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <Label htmlFor="bwr-status">
                <Trans>BWR Status</Trans>
              </Label>
              <Select
                id="bwr-status"
                value={selectedStatus}
                onChange={(event) =>
                  setSelectedStatus(
                    event.target.value as EmployeeBwrManagedStatus
                  )
                }
              >
                {managedStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {getBwrStatusLabel(status, _)}
                  </option>
                ))}
              </Select>
              {panelFieldErrors.status?.[0] ? (
                <ErrorMessage>{panelFieldErrors.status[0]}</ErrorMessage>
              ) : null}
            </Field>

            <Field>
              <Label htmlFor="bwr-id">
                <Trans>BWR ID</Trans>
              </Label>
              <Input
                id="bwr-id"
                value={bwrId}
                onChange={(event) => setBwrId(event.target.value)}
                inputMode="numeric"
                maxLength={7}
              />
              {panelFieldErrors.bwr_id?.[0] ? (
                <ErrorMessage>{panelFieldErrors.bwr_id[0]}</ErrorMessage>
              ) : null}
            </Field>
          </div>

          <Field>
            <Label htmlFor="bwr-notes">
              <Trans>BWR Notes</Trans>
            </Label>
            <Textarea
              id="bwr-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
            />
            {panelFieldErrors.notes?.[0] ? (
              <ErrorMessage>{panelFieldErrors.notes[0]}</ErrorMessage>
            ) : null}
          </Field>

          <Button type="submit" disabled={saveLoading}>
            {saveLoading ? (
              <Trans>Saving BWR Status...</Trans>
            ) : (
              <Trans>Save BWR Status</Trans>
            )}
          </Button>
        </form>
      )}
    </section>
  );
}

function InvitationStatusLabel({
  status,
}: {
  status: EmployeeOnboardingInvitationStatus;
}) {
  switch (status) {
    case "sent":
      return <Trans>Sent</Trans>;
    case "created_not_sent":
      return <Trans>Created, but not sent</Trans>;
    case "failed":
      return <Trans>Failed</Trans>;
    case "not_requested":
      return <Trans>Not requested</Trans>;
    default:
      return <>{status}</>;
  }
}

/**
 * Status badge component using Catalyst Badge
 */
function StatusBadge({ status }: { status: string }) {
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
    <Badge color={colors[status as keyof typeof colors] ?? "zinc"}>
      {labels[status as keyof typeof labels] ?? status}
    </Badge>
  );
}

/**
 * Profile Tab using Catalyst DescriptionList
 */
function ProfileTab({ employee }: { employee: Employee }) {
  const { i18n } = useLingui();
  const onboardingInvitation = employee.onboarding_invitation;

  return (
    <DescriptionList>
      <DescriptionTerm>
        <Trans>Employee Number</Trans>
      </DescriptionTerm>
      <DescriptionDetails>{employee.employee_number}</DescriptionDetails>

      <DescriptionTerm>
        <Trans>Full Name</Trans>
      </DescriptionTerm>
      <DescriptionDetails>{employee.full_name}</DescriptionDetails>

      <DescriptionTerm>
        <Trans>Email</Trans>
      </DescriptionTerm>
      <DescriptionDetails>{employee.email}</DescriptionDetails>

      <DescriptionTerm>
        <Trans>Phone</Trans>
      </DescriptionTerm>
      <DescriptionDetails>{employee.phone || "-"}</DescriptionDetails>

      <DescriptionTerm>
        <Trans>Management Level</Trans>
      </DescriptionTerm>
      <DescriptionDetails>
        {employee.management_level > 0 ? (
          <span className="font-medium">
            <Trans>ML</Trans> {employee.management_level}
          </span>
        ) : (
          <span className="text-zinc-500 dark:text-zinc-400">
            <Trans>No management position</Trans>
          </span>
        )}
      </DescriptionDetails>

      <DescriptionTerm>
        <Trans>Position</Trans>
      </DescriptionTerm>
      <DescriptionDetails>{employee.position}</DescriptionDetails>

      <DescriptionTerm>
        <Trans>Status</Trans>
      </DescriptionTerm>
      <DescriptionDetails>
        <StatusBadge status={employee.status} />
      </DescriptionDetails>

      <DescriptionTerm>
        <Trans>Date of Birth</Trans>
      </DescriptionTerm>
      <DescriptionDetails>
        {employee.date_of_birth
          ? formatDate(employee.date_of_birth, i18n.locale)
          : "-"}
      </DescriptionDetails>

      <DescriptionTerm>
        <Trans>Contract Start Date</Trans>
      </DescriptionTerm>
      <DescriptionDetails>
        {employee.contract_start_date
          ? formatDate(employee.contract_start_date, i18n.locale)
          : "-"}
      </DescriptionDetails>

      <DescriptionTerm>
        <Trans>Organizational Unit</Trans>
      </DescriptionTerm>
      <DescriptionDetails>
        {employee.organizational_unit?.name || "-"}
      </DescriptionDetails>

      <DescriptionTerm>
        <Trans>Onboarding Invitation</Trans>
      </DescriptionTerm>
      <DescriptionDetails>
        {onboardingInvitation ? (
          <div className="space-y-1">
            <div>
              <InvitationStatusLabel status={onboardingInvitation.status} />
            </div>
            {onboardingInvitation.available === false &&
              onboardingInvitation.rule_message && (
                <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                  {onboardingInvitation.rule_message}
                </Text>
              )}
          </div>
        ) : (
          "-"
        )}
      </DescriptionDetails>

      <DescriptionTerm>
        <Trans>Invitation Requested</Trans>
      </DescriptionTerm>
      <DescriptionDetails>
        {onboardingInvitation?.requested_at
          ? formatDateTime(onboardingInvitation.requested_at, i18n.locale)
          : "-"}
      </DescriptionDetails>

      <DescriptionTerm>
        <Trans>Invitation Mail Sent</Trans>
      </DescriptionTerm>
      <DescriptionDetails>
        {onboardingInvitation?.mail_sent_at
          ? formatDateTime(onboardingInvitation.mail_sent_at, i18n.locale)
          : "-"}
      </DescriptionDetails>

      <DescriptionTerm>
        <Trans>Invitation Failure Reason</Trans>
      </DescriptionTerm>
      <DescriptionDetails>
        {onboardingInvitation?.failure_reason || "-"}
      </DescriptionDetails>
    </DescriptionList>
  );
}

/**
 * Qualifications Tab
 */
function QualificationsTab({ employeeId }: { employeeId: string }) {
  const [qualifications, setQualifications] = useState<EmployeeQualification[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void fetchEmployeeQualifications(employeeId)
      .then((data) => {
        if (active) {
          setQualifications(data);
        }
      })
      .catch((err) => {
        if (active) {
          console.error("Failed to load qualifications", err);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [employeeId]);

  if (loading) {
    return (
      <Text>
        <Trans>Loading qualifications...</Trans>
      </Text>
    );
  }

  if (qualifications.length === 0) {
    return (
      <Text className="text-gray-500">
        <Trans>No qualifications assigned</Trans>
      </Text>
    );
  }

  return (
    <div className="space-y-4">
      {qualifications.map((eq) => (
        <div
          key={eq.id}
          className="rounded-lg border border-zinc-950/10 p-4 dark:border-white/10"
        >
          <div className="flex items-start justify-between">
            <div>
              <Text className="font-medium">{eq.qualification.name}</Text>
              {eq.certificate_number && (
                <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                  <Trans>Certificate:</Trans> {eq.certificate_number}
                </Text>
              )}
            </div>
            <StatusBadge status={eq.status} />
          </div>
          {eq.expiry_date && (
            <Text className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
              <Trans>Expires:</Trans> {eq.expiry_date}
            </Text>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Documents Tab
 */
function DocumentsTab({ employeeId }: { employeeId: string }) {
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void fetchEmployeeDocuments(employeeId)
      .then((data) => {
        if (active) {
          setDocuments(data);
        }
      })
      .catch((err) => {
        if (active) {
          console.error("Failed to load documents", err);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [employeeId]);

  if (loading) {
    return (
      <Text>
        <Trans>Loading documents...</Trans>
      </Text>
    );
  }

  if (documents.length === 0) {
    return (
      <Text className="text-gray-500">
        <Trans>No documents uploaded</Trans>
      </Text>
    );
  }

  return (
    <div className="space-y-4">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="rounded-lg border border-zinc-950/10 p-4 dark:border-white/10"
        >
          <div className="flex items-center justify-between">
            <div>
              <Text className="font-medium">{doc.filename}</Text>
              <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                {doc.document_type}
              </Text>
            </div>
            <Button
              href={`/employees/${employeeId}/documents/${doc.id}/download`}
              outline
            >
              <Trans>Download</Trans>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Employee Detail Page
 */
export function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const capabilities = useUserCapabilities();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [actionLoading, setActionLoading] = useState(false);

  async function refreshEmployee(): Promise<Employee | null> {
    if (!id) {
      return null;
    }

    const data = await fetchEmployee(id);
    setEmployee(data);
    setError(null);
    return data;
  }

  useEffect(() => {
    if (!id) {
      return;
    }

    let active = true;

    void fetchEmployee(id)
      .then((data) => {
        if (!active) {
          return;
        }

        setEmployee(data);
        setError(null);
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
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  async function handleActivate() {
    if (!id || !confirm("Activate this employee?")) return;

    try {
      setActionLoading(true);
      await activateEmployee(id);
      await refreshEmployee();
    } catch (err) {
      console.error("Failed to activate employee:", err);
      let errorMessage = "Failed to activate employee";

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err !== null && "message" in err) {
        errorMessage = String(err.message);
      }

      setError(errorMessage);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTerminate() {
    if (!id || !confirm("Terminate this employee?")) return;

    try {
      setActionLoading(true);
      await terminateEmployee(id);
      await refreshEmployee();
    } catch (err) {
      console.error("Failed to terminate employee:", err);
      let errorMessage = "Failed to terminate employee";

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err !== null && "message" in err) {
        errorMessage = String(err.message);
      }

      setError(errorMessage);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmOnboarding() {
    if (!id || !confirm("Confirm this onboarding dossier?")) return;

    try {
      setActionLoading(true);
      await confirmEmployeeOnboarding(id, undefined);
      await refreshEmployee();
    } catch (err) {
      console.error("Failed to confirm onboarding:", err);
      let errorMessage = "Failed to confirm onboarding";

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err !== null && "message" in err) {
        errorMessage = String(err.message);
      }

      setError(errorMessage);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Text>
          <Trans>Loading employee...</Trans>
        </Text>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-900/20">
          <div className="mb-4 text-4xl">❌</div>
          <Heading level={3} className="text-red-900 dark:text-red-400">
            <Trans>Error Loading Employee</Trans>
          </Heading>
          <Text className="mt-2 text-red-700 dark:text-red-500">
            {error || "Employee not found"}
          </Text>
          <div className="mt-4">
            <Button href="/employees" color="red">
              <Trans>Back to Employees</Trans>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const onboardingWorkflowStatus = employee.onboarding_workflow?.status;
  const canConfirmOnboarding =
    employee.status === "pre_contract" &&
    employee.onboarding_completed === true &&
    onboardingWorkflowStatus === "submitted_for_review" &&
    capabilities.actions.employees.confirmOnboarding;
  const canActivateEmployee =
    employee.status === "pre_contract" &&
    onboardingWorkflowStatus === "ready_for_activation" &&
    capabilities.actions.employees.activate;

  return (
    <div>
      <div className="mb-6">
        <Button href="/employees" plain>
          <Trans>← Back to Employees</Trans>
        </Button>
      </div>

      <div className="rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
        <div className="border-b border-zinc-950/5 p-6 dark:border-white/5">
          <div className="flex items-start justify-between">
            <div>
              <Heading>{employee.full_name}</Heading>
              <Text className="text-zinc-500 dark:text-zinc-400">
                {employee.employee_number}
              </Text>
            </div>
            <div className="flex gap-2">
              {canConfirmOnboarding && (
                <Button
                  onClick={handleConfirmOnboarding}
                  disabled={actionLoading}
                >
                  <Trans>Confirm Onboarding</Trans>
                </Button>
              )}
              {canActivateEmployee && (
                <Button onClick={handleActivate} disabled={actionLoading}>
                  <Trans>Activate</Trans>
                </Button>
              )}
              {(employee.status === "active" ||
                employee.status === "on_leave") &&
                capabilities.actions.employees.terminate && (
                  <Button onClick={handleTerminate} disabled={actionLoading}>
                    <Trans>Terminate</Trans>
                  </Button>
                )}
              {capabilities.actions.employees.update && (
                <Button href={`/employees/${id}/edit`} outline>
                  <Trans>Edit</Trans>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="border-b border-zinc-950/5 dark:border-white/5">
          <nav className="flex gap-6 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("profile")}
              className={`
                border-b-2 py-4 text-sm font-medium
                ${
                  activeTab === "profile"
                    ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
                }
              `}
            >
              <Trans>Profile</Trans>
            </button>
            <button
              onClick={() => setActiveTab("qualifications")}
              className={`
                border-b-2 py-4 text-sm font-medium
                ${
                  activeTab === "qualifications"
                    ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
                }
              `}
            >
              <Trans>Qualifications</Trans>
            </button>
            <button
              onClick={() => setActiveTab("documents")}
              className={`
                border-b-2 py-4 text-sm font-medium
                ${
                  activeTab === "documents"
                    ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
                }
              `}
            >
              <Trans>Documents</Trans>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "profile" && (
            <div className="space-y-8">
              <ProfileTab employee={employee} />
              <EmployeeBwrPanel
                employee={employee}
                canManage={capabilities.actions.employees.update}
                onRefresh={refreshEmployee}
              />
            </div>
          )}
          {activeTab === "qualifications" && (
            <QualificationsTab employeeId={employee.id} />
          )}
          {activeTab === "documents" && (
            <DocumentsTab employeeId={employee.id} />
          )}
        </div>
      </div>
    </div>
  );
}

export default EmployeeDetail;
