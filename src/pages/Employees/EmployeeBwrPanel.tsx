// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, type FormEvent } from "react";
import { msg, Trans } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import type {
  Employee,
  EmployeeBwrExportFormat,
  EmployeeBwrManagedStatus,
  EmployeeBwrStatus,
} from "@/types/api";
import { formatDate, formatDateTime } from "../../lib/dateUtils";
import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import {
  Description as FieldDescription,
  ErrorMessage,
  Field,
  Label,
} from "../../components/fieldset";
import { Heading } from "../../components/heading";
import { Input } from "../../components/input";
import { Select } from "../../components/select";
import { Text } from "../../components/text";
import { Textarea } from "../../components/textarea";
import { ApiError } from "../../services/ApiError";
import {
  exportEmployeeBwr,
  updateEmployeeBwrStatus,
} from "../../services/employeeApi";

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
