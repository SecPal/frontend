// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig } from "../config";
import { apiFetch } from "./csrf";

/**
 * Document type
 */
export type DocumentType =
  | "contract"
  | "id_document"
  | "certificate"
  | "banking_details"
  | "medical_certificate"
  | "work_permit"
  | "background_check"
  | "other";

/**
 * Employee Document
 */
export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type: DocumentType;
  filename: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  expiry_date?: string;
  visible_to_employee: boolean;
  notes?: string;
  uploaded_by: string;
  created_at: string;
}

/**
 * Document upload request
 */
export interface DocumentUploadData {
  document_type: DocumentType;
  expiry_date?: string;
  visible_to_employee?: boolean;
  notes?: string;
}

/**
 * Fetch employee documents
 */
export async function fetchEmployeeDocuments(
  employeeId: string
): Promise<EmployeeDocument[]> {
  const url = `${apiConfig.baseUrl}/v1/employees/${employeeId}/documents`;
  const response = await apiFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to fetch employee documents");
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get document metadata
 */
export async function fetchEmployeeDocument(
  employeeId: string,
  documentId: string
): Promise<EmployeeDocument> {
  const url = `${apiConfig.baseUrl}/v1/employees/${employeeId}/documents/${documentId}`;
  const response = await apiFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to fetch document");
  }

  const data = await response.json();
  return data.data;
}

/**
 * Upload employee document (HR only)
 */
export async function uploadEmployeeDocument(
  employeeId: string,
  file: File,
  metadata: DocumentUploadData
): Promise<EmployeeDocument> {
  const url = `${apiConfig.baseUrl}/v1/employees/${employeeId}/documents`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("document_type", metadata.document_type);
  if (metadata.expiry_date) {
    formData.append("expiry_date", metadata.expiry_date);
  }
  if (metadata.visible_to_employee !== undefined) {
    formData.append(
      "visible_to_employee",
      metadata.visible_to_employee.toString()
    );
  }
  if (metadata.notes) {
    formData.append("notes", metadata.notes);
  }

  const response = await apiFetch(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to upload document");
  }

  const data = await response.json();
  return data.data;
}

/**
 * Delete document (HR only)
 */
export async function deleteEmployeeDocument(
  employeeId: string,
  documentId: string
): Promise<void> {
  const url = `${apiConfig.baseUrl}/v1/employees/${employeeId}/documents/${documentId}`;
  const response = await apiFetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to delete document");
  }
}

/**
 * Download document file
 */
export async function downloadEmployeeDocument(
  employeeId: string,
  documentId: string
): Promise<Blob> {
  const url = `${apiConfig.baseUrl}/v1/employees/${employeeId}/documents/${documentId}/download`;
  const response = await apiFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to download document");
  }

  return response.blob();
}
