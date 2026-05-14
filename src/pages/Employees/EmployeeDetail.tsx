// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useLocation, useParams } from "react-router-dom";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import type {
  Employee,
  EmployeeEmergencyContact,
  EmployeeOnboardingInvitationStatus,
} from "@/types/api";
import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from "../../components/dialog";
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
  updateEmployee,
} from "../../services/employeeApi";
import {
  fetchEmployeeQualifications,
  type EmployeeQualification,
} from "../../services/qualificationApi";
import {
  buildAddressesPayloadForCurrentEdit,
  getCurrentAddressFromList,
  mergeAddressBaseList,
  type PostalAddressDraft,
} from "../../lib/employeeAddresses";
import { EmployeeAddressFields } from "./EmployeeAddressFields";
import { employeeAddressToDraft } from "./employeeAddressDraft";
import { EmployeeBwrPanel } from "./EmployeeBwrPanel";
import {
  emergencyContactsToDrafts,
  emptyEmergencyContactDraft,
  hasEmergencyContactContent,
  normalizeEmergencyContactDrafts,
  validateEmergencyContactDrafts,
  type EmergencyContactDraft,
  type EmergencyContactValidationError,
} from "./emergencyContactDrafts";

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

function BwrStatusLabel({ status }: { status: Employee["bwr_status"] }) {
  switch (status ?? "not_registered") {
    case "not_registered":
      return <Trans>Not registered</Trans>;
    case "pending":
      return <Trans>Pending</Trans>;
    case "active":
      return <Trans>Active</Trans>;
    case "suspended":
      return <Trans>Suspended</Trans>;
    case "revoked":
      return <Trans>Revoked</Trans>;
  }
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
        <Trans>BWR Status</Trans>
      </DescriptionTerm>
      <DescriptionDetails>
        <BwrStatusLabel status={employee.bwr_status} />
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

type EditableContactField =
  | "email"
  | "phone"
  | "postal_address"
  | "emergency_contacts";
type EmployeeDetailTab =
  | "profile"
  | "contacts"
  | "qualifications"
  | "documents"
  | "bwr";

const baseContactInputClass =
  "w-full rounded-lg border px-3 py-2 text-sm dark:bg-zinc-800 dark:text-white";
const defaultContactInputClass = `${baseContactInputClass} border-zinc-300 dark:border-zinc-700`;
const errorContactInputClass = `${baseContactInputClass} border-red-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 dark:border-red-400`;

function contactInputClass(hasError: boolean): string {
  return hasError ? errorContactInputClass : defaultContactInputClass;
}

function formatPostalAddress(employee: Employee): string | null {
  const structured = employee.structured_address?.trim();
  if (structured) {
    return structured;
  }

  const cur =
    employee.current_address ??
    getCurrentAddressFromList(employee.addresses ?? []);
  if (!cur) {
    return null;
  }

  const lineOne = [cur.street?.trim() ?? "", cur.house_number?.trim() ?? ""]
    .filter((part) => part.length > 0)
    .join(" ");
  const lineTwo = [cur.postal_code?.trim() ?? "", cur.city?.trim() ?? ""]
    .filter((part) => part.length > 0)
    .join(" ");

  const parts = [
    lineOne,
    cur.supplement?.trim() ?? "",
    lineTwo,
    cur.state?.trim() ?? "",
    cur.country?.trim() ?? "",
  ].filter((part) => part.length > 0);

  if (parts.length === 0) {
    return null;
  }

  return parts.join(", ");
}

function formatEmergencyContactLine(contact: EmployeeEmergencyContact): string {
  const details = [contact.relationship, contact.phone, contact.email]
    .filter((value) => value && value.trim().length > 0)
    .join(" • ");

  return details.length > 0 ? `${contact.name} (${details})` : contact.name;
}

function parseEmployeeDetailTabHash(hash: string): EmployeeDetailTab | null {
  const hashTab = hash.replace("#", "");
  if (
    hashTab === "profile" ||
    hashTab === "contacts" ||
    hashTab === "qualifications" ||
    hashTab === "documents" ||
    hashTab === "bwr"
  ) {
    return hashTab;
  }
  return null;
}

interface ContactsTabProps {
  employee: Employee;
  canManage: boolean;
  onEditField: (field: EditableContactField) => void;
}

function ContactsTab({ employee, canManage, onEditField }: ContactsTabProps) {
  const postalAddress = formatPostalAddress(employee);
  const emergencyContacts = employee.emergency_contacts ?? [];

  return (
    <DescriptionList>
      <DescriptionTerm>
        <Trans>Email</Trans>
      </DescriptionTerm>
      <DescriptionDetails className="group flex items-center justify-between gap-3">
        <span>{employee.email}</span>
        {canManage && (
          <button
            type="button"
            aria-label="Edit email"
            onClick={() => onEditField("email")}
            className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <PencilSquareIcon className="size-4" />
          </button>
        )}
      </DescriptionDetails>

      <DescriptionTerm>
        <Trans>Phone</Trans>
      </DescriptionTerm>
      <DescriptionDetails className="group flex items-center justify-between gap-3">
        <span>{employee.phone || "-"}</span>
        {canManage && (
          <button
            type="button"
            aria-label="Edit phone"
            onClick={() => onEditField("phone")}
            className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <PencilSquareIcon className="size-4" />
          </button>
        )}
      </DescriptionDetails>

      <DescriptionTerm>
        <Trans>Postal Address</Trans>
      </DescriptionTerm>
      <DescriptionDetails className="group flex items-center justify-between gap-3">
        {postalAddress ? (
          <span>{postalAddress}</span>
        ) : (
          <Text className="text-zinc-500 dark:text-zinc-400">
            <Trans>No postal address stored yet.</Trans>
          </Text>
        )}
        {canManage && (
          <button
            type="button"
            aria-label="Edit postal address"
            onClick={() => onEditField("postal_address")}
            className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <PencilSquareIcon className="size-4" />
          </button>
        )}
      </DescriptionDetails>

      <DescriptionTerm>
        <Trans>Emergency Contacts</Trans>
      </DescriptionTerm>
      <DescriptionDetails className="group flex items-start justify-between gap-3">
        {emergencyContacts.length > 0 ? (
          <ul className="space-y-1">
            {emergencyContacts.map((contact, index) => (
              <li key={`${contact.name}-${contact.phone}-${index}`}>
                {formatEmergencyContactLine(contact)}
              </li>
            ))}
          </ul>
        ) : (
          <Text className="text-zinc-500 dark:text-zinc-400">
            <Trans>No emergency contacts stored yet.</Trans>
          </Text>
        )}
        {canManage && (
          <button
            type="button"
            aria-label="Edit emergency contacts"
            onClick={() => onEditField("emergency_contacts")}
            className="mt-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <PencilSquareIcon className="size-4" />
          </button>
        )}
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
  const { i18n } = useLingui();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const capabilities = useUserCapabilities();
  const contactDialogFormRef = useRef<HTMLFormElement | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<EmployeeDetailTab>(
    () => parseEmployeeDetailTabHash(location.hash) ?? "profile"
  );
  const [actionLoading, setActionLoading] = useState(false);
  const [editingContactField, setEditingContactField] =
    useState<EditableContactField | null>(null);
  const [contactDraftValue, setContactDraftValue] = useState("");
  const [contactAddressDraft, setContactAddressDraft] =
    useState<PostalAddressDraft>({
      street: "",
      houseNumber: "",
      postalCode: "",
      city: "",
      supplement: "",
      country: "",
    });
  const [contactEmergencyDrafts, setContactEmergencyDrafts] = useState<
    EmergencyContactDraft[]
  >([]);
  const [contactSaveError, setContactSaveError] = useState<string | null>(null);
  const [contactSaveLoading, setContactSaveLoading] = useState(false);
  const [contactInvalidField, setContactInvalidField] = useState<
    "email" | "phone" | null
  >(null);
  const [contactEmergencyInvalidField, setContactEmergencyInvalidField] =
    useState<EmergencyContactValidationError | null>(null);
  const activeTab = selectedTab;

  async function refreshEmployee(): Promise<Employee | null> {
    if (!id) {
      return null;
    }

    try {
      const data = await fetchEmployee(id);
      setEmployee(data);
      setError(null);
      return data;
    } catch (err) {
      console.error("Failed to load employee:", err);
      return null;
    }
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

  function employeeEmergencyDraft(source: Employee): EmergencyContactDraft[] {
    return emergencyContactsToDrafts(source.emergency_contacts);
  }

  function openContactEditDialog(field: EditableContactField) {
    if (!employee) {
      return;
    }

    setContactSaveError(null);
    setContactInvalidField(null);
    setContactEmergencyInvalidField(null);
    setEditingContactField(field);
    if (field === "email") {
      setContactDraftValue(employee.email);
      return;
    }

    if (field === "phone") {
      setContactDraftValue(employee.phone ?? "");
      return;
    }

    if (field === "postal_address") {
      const rows = mergeAddressBaseList(
        employee.addresses,
        employee.current_address
      );
      setContactAddressDraft(
        employeeAddressToDraft(getCurrentAddressFromList(rows))
      );
      return;
    }

    setContactEmergencyDrafts(employeeEmergencyDraft(employee));
  }

  async function handleSaveContactField() {
    if (!id || !employee || !editingContactField) {
      return;
    }

    try {
      setContactSaveLoading(true);
      setContactSaveError(null);
      setContactInvalidField(null);
      setContactEmergencyInvalidField(null);

      const contactDialogForm = contactDialogFormRef.current;
      if (contactDialogForm && !contactDialogForm.reportValidity()) {
        const invalidField =
          contactDialogForm.querySelector<HTMLInputElement>("input:invalid");
        if (invalidField?.dataset.contactField === "email") {
          setContactInvalidField("email");
        } else if (invalidField?.dataset.contactField === "phone") {
          setContactInvalidField("phone");
        }

        const emergencyIndex = invalidField?.dataset.emergencyIndex;
        const emergencyField = invalidField?.dataset.emergencyField as
          | EmergencyContactValidationError["field"]
          | undefined;
        if (emergencyIndex !== undefined && emergencyField) {
          setContactEmergencyInvalidField({
            index: Number(emergencyIndex),
            field: emergencyField,
          });
        }
        return;
      }

      if (editingContactField === "email" || editingContactField === "phone") {
        const trimmedValue = contactDraftValue.trim();

        if (editingContactField === "email" && trimmedValue.length === 0) {
          setContactInvalidField("email");
          setContactSaveError(i18n._(msg`Email address is required`));
          return;
        }

        if (
          editingContactField === "email" &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)
        ) {
          setContactInvalidField("email");
          setContactSaveError(i18n._(msg`Please enter a valid email address`));
          return;
        }

        const payload =
          editingContactField === "email"
            ? { email: trimmedValue }
            : { phone: trimmedValue };
        await updateEmployee(id, payload);
      } else if (editingContactField === "postal_address") {
        await updateEmployee(id, {
          addresses: buildAddressesPayloadForCurrentEdit(
            mergeAddressBaseList(employee.addresses, employee.current_address),
            contactAddressDraft,
            { emptyCountryCodes: ["DE"] }
          ),
        });
      } else {
        const emergencyContactError = validateEmergencyContactDrafts(
          contactEmergencyDrafts
        );
        if (emergencyContactError !== null) {
          setContactEmergencyInvalidField(emergencyContactError);
          if (emergencyContactError.field === "name") {
            setContactSaveError(
              i18n._(msg`Emergency contact name is required.`)
            );
            return;
          }
          if (emergencyContactError.field === "phone") {
            setContactSaveError(
              i18n._(msg`Emergency contact phone is required.`)
            );
            return;
          }
          setContactSaveError(
            i18n._(msg`Please enter a valid emergency contact email.`)
          );
          return;
        }

        const normalizedContacts = normalizeEmergencyContactDrafts(
          contactEmergencyDrafts
        );

        await updateEmployee(id, {
          emergency_contacts:
            normalizedContacts.length > 0 ? normalizedContacts : null,
        });
      }

      await refreshEmployee();
      setEditingContactField(null);
    } catch (err) {
      console.error("Failed to update contact field:", err);
      if (err instanceof Error) {
        setContactSaveError(err.message);
      } else if (typeof err === "object" && err !== null && "message" in err) {
        setContactSaveError(String(err.message));
      } else {
        setContactSaveError(i18n._(msg`Failed to update contact field.`));
      }
    } finally {
      setContactSaveLoading(false);
    }
  }

  function updateEmergencyDraftEntry(
    setter: Dispatch<SetStateAction<EmergencyContactDraft[]>>,
    index: number,
    field: keyof EmergencyContactDraft,
    value: string
  ) {
    setter((prev) =>
      prev.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry
      )
    );
  }

  function addEmergencyDraftEntry(
    setter: Dispatch<SetStateAction<EmergencyContactDraft[]>>
  ) {
    setter((prev) => [...prev, emptyEmergencyContactDraft()]);
  }

  function removeEmergencyDraftEntry(
    setter: Dispatch<SetStateAction<EmergencyContactDraft[]>>,
    index: number
  ) {
    setter((prev) => {
      const remaining = prev.filter((_, entryIndex) => entryIndex !== index);
      return remaining.length > 0 ? remaining : [emptyEmergencyContactDraft()];
    });
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
                <Button
                  href={
                    activeTab === "contacts"
                      ? `/employees/${id}/edit/contacts`
                      : `/employees/${id}/edit`
                  }
                  outline
                >
                  <Trans>Edit</Trans>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="border-b border-zinc-950/5 dark:border-white/5">
          <nav className="flex gap-6 px-6" aria-label="Tabs">
            <button
              type="button"
              onClick={() => setSelectedTab("profile")}
              className={
                activeTab === "profile"
                  ? "border-b-2 border-zinc-950 py-4 text-sm font-medium text-zinc-950 dark:border-white dark:text-white"
                  : "border-b-2 border-transparent py-4 text-sm font-medium text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
              }
            >
              <Trans>Profile</Trans>
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab("contacts")}
              className={
                activeTab === "contacts"
                  ? "border-b-2 border-zinc-950 py-4 text-sm font-medium text-zinc-950 dark:border-white dark:text-white"
                  : "border-b-2 border-transparent py-4 text-sm font-medium text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
              }
            >
              <Trans>Contact</Trans>
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab("qualifications")}
              className={
                activeTab === "qualifications"
                  ? "border-b-2 border-zinc-950 py-4 text-sm font-medium text-zinc-950 dark:border-white dark:text-white"
                  : "border-b-2 border-transparent py-4 text-sm font-medium text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
              }
            >
              <Trans>Qualifications</Trans>
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab("documents")}
              className={
                activeTab === "documents"
                  ? "border-b-2 border-zinc-950 py-4 text-sm font-medium text-zinc-950 dark:border-white dark:text-white"
                  : "border-b-2 border-transparent py-4 text-sm font-medium text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
              }
            >
              <Trans>Documents</Trans>
            </button>
            <button
              type="button"
              onClick={() => setSelectedTab("bwr")}
              className={
                activeTab === "bwr"
                  ? "border-b-2 border-zinc-950 py-4 text-sm font-medium text-zinc-950 dark:border-white dark:text-white"
                  : "border-b-2 border-transparent py-4 text-sm font-medium text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
              }
            >
              <Trans>Bewacherregister</Trans>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "profile" && <ProfileTab employee={employee} />}
          {activeTab === "contacts" && (
            <ContactsTab
              employee={employee}
              canManage={capabilities.actions.employees.update}
              onEditField={openContactEditDialog}
            />
          )}
          {activeTab === "qualifications" && (
            <QualificationsTab employeeId={employee.id} />
          )}
          {activeTab === "documents" && (
            <DocumentsTab employeeId={employee.id} />
          )}
          {activeTab === "bwr" && (
            <EmployeeBwrPanel
              employee={employee}
              canManage={capabilities.actions.employees.update}
              onRefresh={refreshEmployee}
            />
          )}
        </div>
      </div>

      <Dialog
        open={editingContactField !== null}
        onClose={() => {
          if (!contactSaveLoading) {
            setEditingContactField(null);
            setContactSaveError(null);
            setContactInvalidField(null);
            setContactEmergencyInvalidField(null);
          }
        }}
        size="md"
      >
        <DialogTitle>
          {editingContactField === "email" && <Trans>Edit Email</Trans>}
          {editingContactField === "phone" && <Trans>Edit Phone</Trans>}
          {editingContactField === "postal_address" && (
            <Trans>Edit Postal Address</Trans>
          )}
          {editingContactField === "emergency_contacts" && (
            <Trans>Edit Emergency Contacts</Trans>
          )}
        </DialogTitle>
        <form
          ref={contactDialogFormRef}
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSaveContactField();
          }}
        >
          <DialogBody className="space-y-3">
            {(editingContactField === "email" ||
              editingContactField === "phone") && (
              <>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {editingContactField === "email" ? (
                    <Trans>Email</Trans>
                  ) : (
                    <Trans>Phone</Trans>
                  )}
                </label>
                <input
                  type={editingContactField === "email" ? "email" : "tel"}
                  value={contactDraftValue}
                  required={editingContactField === "email"}
                  data-contact-field={editingContactField}
                  aria-invalid={
                    contactInvalidField === editingContactField || undefined
                  }
                  onChange={(event) => {
                    setContactDraftValue(event.target.value);
                    setContactSaveError(null);
                    setContactInvalidField(null);
                  }}
                  className={contactInputClass(
                    contactInvalidField === editingContactField
                  )}
                />
              </>
            )}
            {editingContactField === "postal_address" && (
              <EmployeeAddressFields
                draft={contactAddressDraft}
                onChange={(field, value) =>
                  setContactAddressDraft((prev) => ({
                    ...prev,
                    [field]: value,
                  }))
                }
                fieldIdPrefix="detail-contact-address"
              />
            )}
            {editingContactField === "emergency_contacts" && (
              <div className="space-y-4">
                {contactEmergencyDrafts.map((contact, index) => {
                  const requiresCoreFields =
                    hasEmergencyContactContent(contact);

                  return (
                    <div
                      key={`row-emergency-${index}`}
                      className="space-y-2 rounded-lg border border-zinc-950/10 p-3 dark:border-white/10"
                    >
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label
                            htmlFor={`detail-emergency-${index}-name`}
                            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                          >
                            <Trans>Emergency Contact Name</Trans>
                          </label>
                          <input
                            id={`detail-emergency-${index}-name`}
                            type="text"
                            value={contact.name}
                            required={requiresCoreFields}
                            data-emergency-index={index}
                            data-emergency-field="name"
                            aria-invalid={
                              (contactEmergencyInvalidField?.index === index &&
                                contactEmergencyInvalidField.field ===
                                  "name") ||
                              undefined
                            }
                            onChange={(event) => {
                              updateEmergencyDraftEntry(
                                setContactEmergencyDrafts,
                                index,
                                "name",
                                event.target.value
                              );
                              setContactSaveError(null);
                              if (
                                contactEmergencyInvalidField?.index === index &&
                                contactEmergencyInvalidField.field === "name"
                              ) {
                                setContactEmergencyInvalidField(null);
                              }
                            }}
                            placeholder={i18n._(msg`Name`)}
                            className={contactInputClass(
                              contactEmergencyInvalidField?.index === index &&
                                contactEmergencyInvalidField.field === "name"
                            )}
                          />
                        </div>
                        <div className="space-y-1">
                          <label
                            htmlFor={`detail-emergency-${index}-relationship`}
                            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                          >
                            <Trans>Emergency Contact Relationship</Trans>
                          </label>
                          <input
                            id={`detail-emergency-${index}-relationship`}
                            type="text"
                            value={contact.relationship}
                            onChange={(event) =>
                              updateEmergencyDraftEntry(
                                setContactEmergencyDrafts,
                                index,
                                "relationship",
                                event.target.value
                              )
                            }
                            placeholder={i18n._(msg`Relationship`)}
                            className={defaultContactInputClass}
                          />
                        </div>
                        <div className="space-y-1">
                          <label
                            htmlFor={`detail-emergency-${index}-phone`}
                            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                          >
                            <Trans>Emergency Contact Phone</Trans>
                          </label>
                          <input
                            id={`detail-emergency-${index}-phone`}
                            type="tel"
                            value={contact.phone}
                            required={requiresCoreFields}
                            data-emergency-index={index}
                            data-emergency-field="phone"
                            aria-invalid={
                              (contactEmergencyInvalidField?.index === index &&
                                contactEmergencyInvalidField.field ===
                                  "phone") ||
                              undefined
                            }
                            onChange={(event) => {
                              updateEmergencyDraftEntry(
                                setContactEmergencyDrafts,
                                index,
                                "phone",
                                event.target.value
                              );
                              setContactSaveError(null);
                              if (
                                contactEmergencyInvalidField?.index === index &&
                                contactEmergencyInvalidField.field === "phone"
                              ) {
                                setContactEmergencyInvalidField(null);
                              }
                            }}
                            placeholder={i18n._(msg`Phone`)}
                            className={contactInputClass(
                              contactEmergencyInvalidField?.index === index &&
                                contactEmergencyInvalidField.field === "phone"
                            )}
                          />
                        </div>
                        <div className="space-y-1">
                          <label
                            htmlFor={`detail-emergency-${index}-email`}
                            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                          >
                            <Trans>Emergency Contact Email</Trans>
                          </label>
                          <input
                            id={`detail-emergency-${index}-email`}
                            type="text"
                            inputMode="email"
                            autoComplete="email"
                            value={contact.email}
                            data-emergency-index={index}
                            data-emergency-field="email"
                            aria-invalid={
                              (contactEmergencyInvalidField?.index === index &&
                                contactEmergencyInvalidField.field ===
                                  "email") ||
                              undefined
                            }
                            onChange={(event) => {
                              updateEmergencyDraftEntry(
                                setContactEmergencyDrafts,
                                index,
                                "email",
                                event.target.value
                              );
                              setContactSaveError(null);
                              if (
                                contactEmergencyInvalidField?.index === index &&
                                contactEmergencyInvalidField.field === "email"
                              ) {
                                setContactEmergencyInvalidField(null);
                              }
                            }}
                            placeholder={i18n._(msg`Email`)}
                            className={contactInputClass(
                              contactEmergencyInvalidField?.index === index &&
                                contactEmergencyInvalidField.field === "email"
                            )}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor={`detail-emergency-${index}-notes`}
                          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                        >
                          <Trans>Emergency Contact Notes</Trans>
                        </label>
                        <input
                          id={`detail-emergency-${index}-notes`}
                          type="text"
                          value={contact.notes}
                          onChange={(event) =>
                            updateEmergencyDraftEntry(
                              setContactEmergencyDrafts,
                              index,
                              "notes",
                              event.target.value
                            )
                          }
                          placeholder={i18n._(msg`Notes`)}
                          className={defaultContactInputClass}
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          outline
                          onClick={() =>
                            removeEmergencyDraftEntry(
                              setContactEmergencyDrafts,
                              index
                            )
                          }
                        >
                          <Trans>Remove Contact</Trans>
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <Button
                  type="button"
                  outline
                  onClick={() =>
                    addEmergencyDraftEntry(setContactEmergencyDrafts)
                  }
                >
                  <Trans>Add Contact</Trans>
                </Button>
              </div>
            )}
            {contactSaveError && (
              <p
                className="text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
                {contactSaveError}
              </p>
            )}
          </DialogBody>
          <DialogActions>
            <Button
              type="button"
              outline
              onClick={() => {
                setEditingContactField(null);
                setContactSaveError(null);
                setContactInvalidField(null);
                setContactEmergencyInvalidField(null);
              }}
              disabled={contactSaveLoading}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={contactSaveLoading}>
              {contactSaveLoading ? (
                <Trans>Saving...</Trans>
              ) : (
                <Trans>Save</Trans>
              )}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
}

export default EmployeeDetail;
