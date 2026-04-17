// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import type { Employee, EmployeeOnboardingInvitationStatus } from "@/types/api";
import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from "../../components/description-list";
import { Heading } from "../../components/heading";
import { Text } from "../../components/text";
import { useUserCapabilities } from "../../hooks/useUserCapabilities";
import { formatDate, formatDateTime } from "../../lib/dateUtils";
import {
  fetchEmployeeDocuments,
  type EmployeeDocument,
} from "../../services/employeeDocumentApi";
import {
  activateEmployee,
  confirmEmployeeOnboarding,
  fetchEmployee,
  terminateEmployee,
} from "../../services/employeeApi";
import {
  fetchEmployeeQualifications,
  type EmployeeQualification,
} from "../../services/qualificationApi";
import { EmployeeBwrPanel } from "./EmployeeBwrPanel";

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
            <Text className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              <Trans>Expires:</Trans> {eq.expiry_date}
            </Text>
          )}
        </div>
      ))}
    </div>
  );
}

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
        } else if (typeof err === "object" && err !== null && "message" in err) {
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
    if (!id || !confirm("Activate this employee?")) {
      return;
    }

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
    if (!id || !confirm("Terminate this employee?")) {
      return;
    }

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
    if (!id || !confirm("Confirm this onboarding dossier?")) {
      return;
    }

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
      <div className="flex h-64 items-center justify-center">
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
              className={
                activeTab === "profile"
                  ? "border-b-2 border-zinc-950 py-4 text-sm font-medium text-zinc-950 dark:border-white dark:text-white"
                  : "border-b-2 border-transparent py-4 text-sm font-medium text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
              }
            >
              <Trans>Profile</Trans>
            </button>
            <button
              onClick={() => setActiveTab("qualifications")}
              className={
                activeTab === "qualifications"
                  ? "border-b-2 border-zinc-950 py-4 text-sm font-medium text-zinc-950 dark:border-white dark:text-white"
                  : "border-b-2 border-transparent py-4 text-sm font-medium text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
              }
            >
              <Trans>Qualifications</Trans>
            </button>
            <button
              onClick={() => setActiveTab("documents")}
              className={
                activeTab === "documents"
                  ? "border-b-2 border-zinc-950 py-4 text-sm font-medium text-zinc-950 dark:border-white dark:text-white"
                  : "border-b-2 border-transparent py-4 text-sm font-medium text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
              }
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
