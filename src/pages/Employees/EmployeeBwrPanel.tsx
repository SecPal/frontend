// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, type FormEvent } from "react";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import type {
  Employee,
  EmployeeBwrExportFormat,
  EmployeeBwrManagedStatus,
  EmployeeBwrStatus,
} from "@/types/api";
import { formatDate, formatDateTime } from "../../lib/dateUtils";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  EmployeePageText as PageText,
  EmployeePageTitle as PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  EmployeeStatusBadge as StatusBadge,
  Textarea,
} from "@/ui";
import { ApiError } from "../../services/ApiError";
import {
  exportEmployeeBwr,
  updateEmployeeBwrStatus,
} from "../../services/employeeApi";
import { isSafeHttpUrl } from "../../utils/safeUrl";

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
  const unknownMessages: string[] = [];
  for (const [key, messages] of Object.entries(errors)) {
    if (!messages || messages.length === 0) {
      continue;
    }
    if (
      key === "general" ||
      key === "status" ||
      key === "bwr_id" ||
      key === "notes"
    ) {
      nextErrors[key as keyof BwrPanelFieldErrors] = messages;
    } else {
      unknownMessages.push(...messages);
    }
  }
  if (unknownMessages.length > 0) {
    nextErrors.general = [...(nextErrors.general ?? []), ...unknownMessages];
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

export interface EmployeeBwrPanelProps {
  employee: Employee;
  canManage: boolean;
  onRefresh: () => Promise<Employee | null>;
}

export function EmployeeBwrPanel({
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
      if (!isSafeHttpUrl(response.download_url)) {
        setPanelError(
          _(
            msg`The export download link returned by the server is not safe to open.`
          )
        );
        return;
      }
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
      setPanelError(
        getBwrErrorMessage(error, _(msg`Failed to generate BWR export`))
      );
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
      setPanelError(
        getBwrErrorMessage(error, _(msg`Failed to update BWR status`))
      );
      setPanelFieldErrors(
        error instanceof ApiError ? normalizeBwrFieldErrors(error.errors) : {}
      );
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-md border border-border p-5">
      <div className="space-y-1">
        <PageTitle level={2}>
          <Trans>Bewacherregister</Trans>
        </PageTitle>
        <PageText className="text-muted-foreground text-sm">
          <Trans>
            Manage the employee's BWR export and registration state from the
            dedicated runtime endpoints.
          </Trans>
        </PageText>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-none">
          <CardContent className="space-y-1 p-4">
            <PageText className="text-muted-foreground text-sm">
              <Trans>BWR Status</Trans>
            </PageText>
            <StatusBadge color={getBwrStatusColor(currentStatus)}>
              {getBwrStatusLabel(currentStatus, _)}
            </StatusBadge>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="space-y-1 p-4">
            <PageText className="text-muted-foreground text-sm">
              <Trans>BWR ID</Trans>
            </PageText>
            <PageText className="text-foreground">
              {employee.bwr_id || "-"}
            </PageText>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="space-y-1 p-4">
            <PageText className="text-muted-foreground text-sm">
              <Trans>BWR Submission Date</Trans>
            </PageText>
            <PageText className="text-foreground">
              {employee.bwr_submission_date
                ? formatDate(employee.bwr_submission_date, i18n.locale)
                : "-"}
            </PageText>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="space-y-1 p-4">
            <PageText className="text-muted-foreground text-sm">
              <Trans>BWR Registered At</Trans>
            </PageText>
            <PageText className="text-foreground">
              {employee.bwr_registered_at
                ? formatDateTime(employee.bwr_registered_at, i18n.locale)
                : "-"}
            </PageText>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardContent className="space-y-1 p-4">
          <PageText className="text-muted-foreground text-sm">
            <Trans>BWR Notes</Trans>
          </PageText>
          <PageText className="text-foreground">
            {employee.bwr_notes || "-"}
          </PageText>
        </CardContent>
      </Card>

      {panelError ? (
        <Alert
          aria-live="assertive"
          className="border-destructive/30 bg-destructive/10 text-foreground"
        >
          <AlertDescription className="text-destructive">
            {panelError}
          </AlertDescription>
          {panelFieldErrors.general && panelFieldErrors.general.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {panelFieldErrors.general.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      {successMessage ? (
        <Alert
          role="status"
          aria-live="polite"
          className="border-emerald-500/30 bg-emerald-500/10 text-foreground"
        >
          <AlertDescription className="mt-0 text-foreground">
            {successMessage}
          </AlertDescription>
        </Alert>
      ) : null}

      {latestExportUrl ? (
        <div className="bg-card flex flex-wrap items-center gap-3 rounded-md border border-border p-4">
          <PageText className="text-muted-foreground text-sm">
            <Trans>Latest export</Trans>
          </PageText>
          <a
            className="text-foreground hover:bg-accent inline-flex items-center justify-center rounded-lg border border-border px-3.5 py-2 text-sm font-semibold sm:px-3 sm:py-1.5"
            href={latestExportUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Trans>Download Latest Export</Trans>
          </a>
        </div>
      ) : null}

      {!canManage ? (
        <PageText className="text-muted-foreground text-sm">
          <Trans>
            You can inspect BWR data, but write permission is required to manage
            it.
          </Trans>
        </PageText>
      ) : currentStatus === "not_registered" ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,14rem)_auto] md:items-end">
          <Field>
            <FieldLabel htmlFor="bwr-export-format">
              <Trans>Export Format</Trans>
            </FieldLabel>
            <Select
              value={exportFormat}
              onValueChange={(value) =>
                setExportFormat(value as EmployeeBwrExportFormat)
              }
            >
              <SelectTrigger id="bwr-export-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BWR_EXPORT_FORMATS.map((format) => (
                  <SelectItem key={format} value={format} data-value={format}>
                    {format.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
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
              <FieldLabel htmlFor="bwr-status">
                <Trans>BWR Status</Trans>
              </FieldLabel>
              <Select
                value={selectedStatus}
                onValueChange={(value) =>
                  setSelectedStatus(value as EmployeeBwrManagedStatus)
                }
              >
                <SelectTrigger
                  id="bwr-status"
                  aria-invalid={panelFieldErrors.status?.[0] ? true : undefined}
                  aria-describedby={
                    panelFieldErrors.status?.[0]
                      ? "bwr-status-error"
                      : undefined
                  }
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {managedStatusOptions.map((status) => (
                    <SelectItem key={status} value={status} data-value={status}>
                      {getBwrStatusLabel(status, _)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {panelFieldErrors.status?.[0] ? (
                <FieldError id="bwr-status-error">
                  {panelFieldErrors.status[0]}
                </FieldError>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="bwr-id">
                <Trans>BWR ID</Trans>
              </FieldLabel>
              <Input
                id="bwr-id"
                value={bwrId}
                onChange={(event) => setBwrId(event.target.value)}
                inputMode="numeric"
                maxLength={7}
                aria-invalid={panelFieldErrors.bwr_id?.[0] ? true : undefined}
                aria-describedby={
                  panelFieldErrors.bwr_id?.[0] ? "bwr-id-error" : undefined
                }
              />
              {panelFieldErrors.bwr_id?.[0] ? (
                <FieldError id="bwr-id-error">
                  {panelFieldErrors.bwr_id[0]}
                </FieldError>
              ) : null}
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="bwr-notes">
              <Trans>BWR Notes</Trans>
            </FieldLabel>
            <Textarea
              id="bwr-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              aria-invalid={panelFieldErrors.notes?.[0] ? true : undefined}
              aria-describedby={
                panelFieldErrors.notes?.[0] ? "bwr-notes-error" : undefined
              }
            />
            {panelFieldErrors.notes?.[0] ? (
              <FieldError id="bwr-notes-error">
                {panelFieldErrors.notes[0]}
              </FieldError>
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
