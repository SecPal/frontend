// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Trans } from "@lingui/macro";
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

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: string }) {
  const colors = {
    pre_contract: "bg-yellow-100 text-yellow-800",
    active: "bg-green-100 text-green-800",
    on_leave: "bg-blue-100 text-blue-800",
    terminated: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status as keyof typeof colors]}`}
    >
      {status}
    </span>
  );
}

/**
 * Tab navigation
 */
function TabNav({
  activeTab,
  onChange,
}: {
  activeTab: string;
  onChange: (tab: string) => void;
}) {
  const tabs = [
    { id: "profile", label: <Trans>Profile</Trans> },
    { id: "qualifications", label: <Trans>Qualifications</Trans> },
    { id: "documents", label: <Trans>Documents</Trans> },
  ];

  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="-mb-px flex space-x-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === tab.id
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/**
 * Profile Tab
 */
function ProfileTab({ employee }: { employee: Employee }) {
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-gray-500">
            <Trans>Employee Number</Trans>
          </dt>
          <dd className="mt-1 text-sm text-gray-900">
            {employee.employee_number}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">
            <Trans>Full Name</Trans>
          </dt>
          <dd className="mt-1 text-sm text-gray-900">{employee.full_name}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">
            <Trans>Email</Trans>
          </dt>
          <dd className="mt-1 text-sm text-gray-900">{employee.email}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">
            <Trans>Phone</Trans>
          </dt>
          <dd className="mt-1 text-sm text-gray-900">
            {employee.phone || "-"}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">
            <Trans>Position</Trans>
          </dt>
          <dd className="mt-1 text-sm text-gray-900">{employee.position}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">
            <Trans>Status</Trans>
          </dt>
          <dd className="mt-1">
            <StatusBadge status={employee.status} />
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">
            <Trans>Date of Birth</Trans>
          </dt>
          <dd className="mt-1 text-sm text-gray-900">
            {employee.date_of_birth}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">
            <Trans>Contract Start Date</Trans>
          </dt>
          <dd className="mt-1 text-sm text-gray-900">
            {employee.contract_start_date}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">
            <Trans>Organizational Unit</Trans>
          </dt>
          <dd className="mt-1 text-sm text-gray-900">
            {employee.organizational_unit.name}
          </dd>
        </div>
      </dl>
    </div>
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
        <div key={eq.id} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">
                {eq.qualification.name}
              </h4>
              {eq.certificate_number && (
                <Text className="text-sm text-gray-500">
                  Certificate: {eq.certificate_number}
                </Text>
              )}
            </div>
            <StatusBadge status={eq.status} />
          </div>
          {eq.expiry_date && (
            <Text className="text-sm text-gray-500 mt-2">
              Expires: {eq.expiry_date}
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
        <div key={doc.id} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">
                {doc.filename}
              </h4>
              <Text className="text-sm text-gray-500">{doc.document_type}</Text>
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
      setError(err instanceof Error ? err.message : "Failed to load employee");
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
      setError(
        err instanceof Error ? err.message : "Failed to activate employee"
      );
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
      setError(
        err instanceof Error ? err.message : "Failed to terminate employee"
      );
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
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <Text className="text-red-800">{error || "Employee not found"}</Text>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/employees" className="text-indigo-600 hover:text-indigo-800">
          <Trans>← Back to Employees</Trans>
        </Link>
      </div>

      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <Heading>{employee.full_name}</Heading>
            <Text className="text-gray-500">{employee.employee_number}</Text>
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

        <TabNav activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "profile" && <ProfileTab employee={employee} />}
        {activeTab === "qualifications" && (
          <QualificationsTab employeeId={employee.id} />
        )}
        {activeTab === "documents" && <DocumentsTab employeeId={employee.id} />}
      </div>
    </div>
  );
}

export default EmployeeDetail;
