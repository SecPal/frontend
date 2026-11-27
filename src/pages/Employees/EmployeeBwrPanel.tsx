// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { Textarea } from "@/ui/textarea";
import type {
  Employee,
  EmployeeBwrManagedStatus,
  EmployeeBwrStatus,
} from "@/types/api";
import { formatDate, formatDateTime } from "../../lib/dateUtils";
import {
  Alert,
  AlertDescription,
  Card,
  CardContent,
  Field,
  FieldError,
  FieldLabel,
  EmployeePageText as PageText,
  EmployeePageTitle as PageTitle,
  EmployeeStatusBadge as StatusBadge,
} from "@/ui";
import { ApiError } from "../../services/ApiError";
import {
  updateEmployee,
  updateEmployeeBwrStatus,
} from "../../services/employeeApi";

type BwrPanelFieldErrors = Partial<
  Record<
    "general" | "bwr_submission_date" | "status" | "bwr_id" | "notes",
    string[]
  >
>;
type BwrSaveAction = "reportDate" | "status";

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
    return ["pending"];
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
      key === "bwr_submission_date" ||
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
  routeOwner: object;
  onRefresh: (
    employeeId: string,
    routeOwner: object
  ) => Promise<Employee | null>;
}

export function EmployeeBwrPanel({
  employee,
  canManage,
  routeOwner,
  onRefresh,
}: EmployeeBwrPanelProps) {
  const { i18n, _ } = useLingui();
  const currentStatus = employee.bwr_status ?? "not_registered";
  const [submissionDate, setSubmissionDate] = useState(
    employee.bwr_submission_date ?? ""
  );
  const [selectedStatus, setSelectedStatus] =
    useState<EmployeeBwrManagedStatus>(
      currentStatus === "not_registered" ? "pending" : currentStatus
    );
  const [bwrId, setBwrId] = useState(employee.bwr_id ?? "");
  const [notes, setNotes] = useState(employee.bwr_notes ?? "");
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelFieldErrors, setPanelFieldErrors] = useState<BwrPanelFieldErrors>(
    {}
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<BwrSaveAction | null>(null);
  const activeEmployeeId = useRef<string | null>(employee.id);

  useLayoutEffect(() => {
    const employeeId = employee.id;
    activeEmployeeId.current = employeeId;
    return () => {
      if (activeEmployeeId.current === employeeId) {
        activeEmployeeId.current = null;
      }
    };
  }, [employee.id]);

  const managedStatusOptions = getManagedBwrStatuses(currentStatus);
  const canRecordStatus =
    currentStatus !== "not_registered" || Boolean(employee.bwr_submission_date);

  function clearPanelFeedback() {
    setPanelError(null);
    setPanelFieldErrors({});
    setSuccessMessage(null);
  }

  async function saveBwr(
    action: BwrSaveAction,
    write: () => Promise<Employee>,
    success: MessageDescriptor,
    failure: MessageDescriptor
  ) {
    if (!canManage || saving) return;
    const employeeId = employee.id;
    clearPanelFeedback();

    try {
      setSaving(action);
      await write();
      if (activeEmployeeId.current !== employeeId) return;
      const refreshedEmployee = await onRefresh(employeeId, routeOwner);
      if (activeEmployeeId.current !== employeeId) return;
      if (!refreshedEmployee) {
        setPanelError(
          _(
            msg`The BWR change was saved, but the employee details could not be refreshed.`
          )
        );
        return;
      }

      if (action === "reportDate") {
        setSubmissionDate(refreshedEmployee.bwr_submission_date ?? "");
      } else {
        const refreshedStatus =
          refreshedEmployee.bwr_status ?? "not_registered";
        setSelectedStatus(
          refreshedStatus === "not_registered" ? "pending" : refreshedStatus
        );
        setBwrId(refreshedEmployee.bwr_id ?? "");
        setNotes(refreshedEmployee.bwr_notes ?? "");
      }
      setSuccessMessage(_(success));
    } catch (error) {
      if (activeEmployeeId.current !== employeeId) return;
      setPanelError(getBwrErrorMessage(error, _(failure)));
      setPanelFieldErrors(
        error instanceof ApiError ? normalizeBwrFieldErrors(error.errors) : {}
      );
    } finally {
      if (activeEmployeeId.current === employeeId) setSaving(null);
    }
  }

  function handleSaveReportDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionDate === (employee.bwr_submission_date ?? "")) return;
    void saveBwr(
      "reportDate",
      () =>
        updateEmployee(employee.id, {
          bwr_submission_date: submissionDate || null,
        }),
      msg`BWR submission date saved.`,
      msg`Failed to save the BWR submission date`
    );
  }

  function handleSaveStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRecordStatus) return;
    void saveBwr(
      "status",
      () =>
        updateEmployeeBwrStatus(employee.id, {
          status: selectedStatus,
          ...(selectedStatus !== "pending" && { bwr_id: bwrId.trim() || null }),
          notes: notes.trim() || null,
        }),
      msg`BWR status updated.`,
      msg`Failed to update BWR status`
    );
  }

  return (
    <section className="space-y-4 rounded-md border border-border p-5">
      <div className="space-y-1">
        <PageTitle level={2}>
          <Trans>Bewacherregister</Trans>
        </PageTitle>
        {canManage && currentStatus === "not_registered" ? (
          <PageText className="text-muted-foreground text-sm">
            <Trans>
              Report the employee in the Bewacherregister, save the submission
              date here, and then set the status to Pending.
            </Trans>
          </PageText>
        ) : null}
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

      {!canManage ? (
        <PageText className="text-muted-foreground text-sm">
          <Trans>
            You can inspect BWR data, but write permission is required to manage
            it.
          </Trans>
        </PageText>
      ) : (
        <>
          <form className="space-y-3" onSubmit={handleSaveReportDate}>
            <Field className="max-w-xs">
              <FieldLabel htmlFor="bwr-submission-date">
                <Trans>BWR Submission Date</Trans>
              </FieldLabel>
              <Input
                id="bwr-submission-date"
                type="date"
                value={submissionDate}
                disabled={saving !== null}
                onChange={(event) => setSubmissionDate(event.target.value)}
                aria-invalid={
                  panelFieldErrors.bwr_submission_date?.[0] ? true : undefined
                }
                aria-describedby={
                  panelFieldErrors.bwr_submission_date?.[0]
                    ? "bwr-submission-date-error"
                    : undefined
                }
              />
              {panelFieldErrors.bwr_submission_date?.[0] ? (
                <FieldError id="bwr-submission-date-error">
                  {panelFieldErrors.bwr_submission_date[0]}
                </FieldError>
              ) : null}
            </Field>
            <Button
              type="submit"
              disabled={
                saving !== null ||
                submissionDate === (employee.bwr_submission_date ?? "")
              }
            >
              {saving === "reportDate" ? (
                <Trans>Saving BWR Submission Date...</Trans>
              ) : (
                <Trans>Save BWR Submission Date</Trans>
              )}
            </Button>
          </form>

          <form className="space-y-4" onSubmit={handleSaveStatus}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="bwr-status">
                  <Trans>BWR Status</Trans>
                </FieldLabel>
                <Select
                  value={selectedStatus}
                  disabled={saving !== null}
                  onValueChange={(value) =>
                    setSelectedStatus(value as EmployeeBwrManagedStatus)
                  }
                >
                  <SelectTrigger
                    id="bwr-status"
                    aria-invalid={
                      panelFieldErrors.status?.[0] ? true : undefined
                    }
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
                      <SelectItem
                        key={status}
                        value={status}
                        data-value={status}
                      >
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

              {selectedStatus !== "pending" ? (
                <Field>
                  <FieldLabel htmlFor="bwr-id">
                    <Trans>BWR ID</Trans>
                  </FieldLabel>
                  <Input
                    id="bwr-id"
                    value={bwrId}
                    disabled={saving !== null}
                    onChange={(event) => setBwrId(event.target.value)}
                    inputMode="numeric"
                    maxLength={7}
                    aria-invalid={
                      panelFieldErrors.bwr_id?.[0] ? true : undefined
                    }
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
              ) : null}
            </div>

            <Field>
              <FieldLabel htmlFor="bwr-notes">
                <Trans>BWR Notes</Trans>
              </FieldLabel>
              <Textarea
                id="bwr-notes"
                value={notes}
                disabled={saving !== null}
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

            <Button
              type="submit"
              disabled={saving !== null || !canRecordStatus}
            >
              {saving === "status" ? (
                <Trans>Saving BWR Status...</Trans>
              ) : (
                <Trans>Save BWR Status</Trans>
              )}
            </Button>
          </form>
        </>
      )}
    </section>
  );
}
