// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { formatDate } from "../../lib/dateUtils";
import {
  fetchEmployee,
  activateEmployee,
  terminateEmployee,
  type Employee,
} from "../../services/employeeApi";
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
  DescriptionList,
  DescriptionTerm,
  DescriptionDetails,
} from "../../components/description-list";

/**
 * Status badge component using Catalyst Badge
 */
function StatusBadge({ status }: { status: string }) {
  const colors = {
    pre_contract: "yellow",
    active: "lime",
    on_leave: "sky",
    terminated: "zinc",
  } as const;

  const labels = {
    pre_contract: <Trans>Pre-Contract</Trans>,
    active: <Trans>Active</Trans>,
    on_leave: <Trans>On Leave</Trans>,
    terminated: <Trans>Terminated</Trans>,
  };

  return (
    <Badge color={colors[status as keyof typeof colors]}>
      {labels[status as keyof typeof labels] || status}
    </Badge>
  );
}

/**
 * Profile Tab using Catalyst DescriptionList
 */
function ProfileTab({ employee }: { employee: Employee }) {
  const { i18n } = useLingui();
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
        {formatDate(employee.date_of_birth, i18n.locale)}
      </DescriptionDetails>

      <DescriptionTerm>
        <Trans>Contract Start Date</Trans>
      </DescriptionTerm>
      <DescriptionDetails>
        {formatDate(employee.contract_start_date, i18n.locale)}
      </DescriptionDetails>

      <DescriptionTerm>
        <Trans>Organizational Unit</Trans>
      </DescriptionTerm>
      <DescriptionDetails>
        {employee.organizational_unit.name}
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

  const loadQualifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchEmployeeQualifications(employeeId);
      setQualifications(data);
    } catch (err) {
      console.error("Failed to load qualifications", err);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadQualifications();
  }, [loadQualifications]);

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

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchEmployeeDocuments(employeeId);
      setDocuments(data);
    } catch (err) {
      console.error("Failed to load documents", err);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

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
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [actionLoading, setActionLoading] = useState(false);

  const loadEmployee = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const data = await fetchEmployee(id);
      setEmployee(data);
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
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadEmployee();
    }
  }, [id, loadEmployee]);

  async function handleActivate() {
    if (!id || !confirm("Activate this employee?")) return;

    try {
      setActionLoading(true);
      await activateEmployee(id);
      await loadEmployee();
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
      await loadEmployee();
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
              {employee.status === "pre_contract" && (
                <Button onClick={handleActivate} disabled={actionLoading}>
                  <Trans>Activate</Trans>
                </Button>
              )}
              {employee.status === "active" && (
                <Button onClick={handleTerminate} disabled={actionLoading}>
                  <Trans>Terminate</Trans>
                </Button>
              )}
              <Button href={`/employees/${id}/edit`} outline>
                <Trans>Edit</Trans>
              </Button>
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
          {activeTab === "profile" && <ProfileTab employee={employee} />}
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
