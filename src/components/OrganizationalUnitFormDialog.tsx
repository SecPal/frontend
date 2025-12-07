// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from "react";
import { Trans, t } from "@lingui/macro";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogActions,
} from "./dialog";
import { Button } from "./button";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { Select } from "./select";
import { Field, Label, ErrorMessage, Description } from "./fieldset";
import type {
  OrganizationalUnit,
  OrganizationalUnitType,
  CreateOrganizationalUnitRequest,
  UpdateOrganizationalUnitRequest,
} from "../types/organizational";
import {
  createOrganizationalUnit,
  updateOrganizationalUnit,
} from "../services/organizationalUnitApi";
import { ApiError } from "../services/secretApi";
import {
  getUnitTypeOptions,
  getValidChildTypeOptions,
  getDefaultChildType,
} from "../lib/organizationalUnitUtils";

export interface OrganizationalUnitFormDialogProps {
  /** Dialog open state */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Mode: create new unit or edit existing */
  mode: "create" | "edit";
  /** Parent unit ID (for create mode - pre-select parent) */
  parentId?: string | null;
  /** Parent unit name (for display in create mode) */
  parentName?: string | null;
  /** Parent unit type (for hierarchy filtering in create mode) */
  parentType?: OrganizationalUnitType | null;
  /** Existing unit to edit (required for edit mode) */
  unit?: OrganizationalUnit | null;
  /** Callback on successful save */
  onSuccess: (unit: OrganizationalUnit) => void;
}

interface FormData {
  name: string;
  type: OrganizationalUnitType;
  description: string;
}

interface FormErrors {
  name?: string;
  type?: string;
  description?: string;
  general?: string;
}

/**
 * Dialog component for creating and editing organizational units
 *
 * Features:
 * - Create mode: New unit with optional pre-selected parent
 * - Edit mode: Update existing unit name/type/description
 * - Form validation
 * - API error handling
 * - Loading state during submission
 * - Hierarchy-based type filtering (Issue #300)
 *
 * @see Issue #294: Frontend: Organizational unit Create/Edit forms
 * @see Issue #300: UX improvement - filter type dropdown based on parent hierarchy
 */
export function OrganizationalUnitFormDialog({
  open,
  onClose,
  mode,
  parentId,
  parentName,
  parentType,
  unit,
  onSuccess,
}: OrganizationalUnitFormDialogProps) {
  const isOnline = useOnlineStatus();

  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: "",
    type: "branch",
    description: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens or unit changes
  useEffect(() => {
    if (open) {
      if (mode === "edit" && unit) {
        setFormData({
          name: unit.name,
          type: unit.type,
          description: unit.description || "",
        });
      } else {
        // Create mode: set default type based on parent
        const defaultType = getDefaultChildType(parentType || undefined);
        setFormData({
          name: "",
          type: defaultType || "branch",
          description: "",
        });
      }
      setErrors({});
    }
  }, [open, mode, unit, parentType]);

  // Validate form
  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      newErrors.name = t`Name is required`;
    } else if (trimmedName.length > 255) {
      newErrors.name = t`Name must be at most 255 characters`;
    }

    if (!formData.type) {
      newErrors.type = t`Type is required`;
    }

    const trimmedDescription = formData.description?.trim() || "";
    if (trimmedDescription.length > 1000) {
      newErrors.description = t`Description must be at most 1000 characters`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      let result: OrganizationalUnit;

      if (mode === "create") {
        const createData: CreateOrganizationalUnitRequest = {
          name: formData.name.trim(),
          type: formData.type,
          description: formData.description.trim() || null,
          parent_id: parentId || null,
        };
        result = await createOrganizationalUnit(createData);
      } else {
        if (!unit) {
          throw new Error("Unit is required for edit mode");
        }
        const updateData: UpdateOrganizationalUnitRequest = {
          name: formData.name.trim(),
          type: formData.type,
          description: formData.description.trim() || null,
        };
        result = await updateOrganizationalUnit(unit.id, updateData);
      }

      onSuccess(result);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422 && err.errors) {
          // Map validation errors to form fields
          const fieldErrors: FormErrors = {};
          for (const [field, messages] of Object.entries(err.errors)) {
            const message = Array.isArray(messages)
              ? messages.join(", ")
              : String(messages);
            if (field === "name") fieldErrors.name = message;
            else if (field === "type") fieldErrors.type = message;
            else if (field === "description") fieldErrors.description = message;
            else fieldErrors.general = message;
          }
          setErrors(fieldErrors);
        } else {
          setErrors({ general: err.message });
        }
      } else {
        setErrors({
          general:
            err instanceof Error
              ? err.message
              : t`An unexpected error occurred`,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle field changes
  const handleChange = (
    field: keyof FormData,
    value: string | OrganizationalUnitType
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const dialogTitle =
    mode === "create" ? (
      <Trans>Create Organizational Unit</Trans>
    ) : (
      <Trans>Edit Organizational Unit</Trans>
    );

  const dialogDescription =
    mode === "create" ? (
      parentName ? (
        <Trans>Create a new organizational unit under "{parentName}".</Trans>
      ) : (
        <Trans>Create a new root organizational unit.</Trans>
      )
    ) : (
      <Trans>Update the organizational unit details.</Trans>
    );

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{dialogTitle}</DialogTitle>
      <DialogDescription>{dialogDescription}</DialogDescription>

      <form onSubmit={handleSubmit}>
        <DialogBody>
          {/* Offline warning banner - mutations not possible */}
          {!isOnline && (
            <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
              <div className="font-semibold mb-1">
                <Trans>You're offline</Trans>
              </div>
              <Trans>
                {mode === "create"
                  ? "Creating organizational units is not possible while offline. Please reconnect to make changes."
                  : "Editing organizational units is not possible while offline. Please reconnect to make changes."}
              </Trans>
            </div>
          )}

          {/* General error message */}
          {errors.general && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {errors.general}
            </div>
          )}

          <div className="space-y-6">
            {/* Name field */}
            <Field>
              <Label>
                <Trans>Name</Trans>
              </Label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleChange("name", e.target.value)
                }
                placeholder={t`e.g., Berlin Branch`}
                disabled={isSubmitting}
                data-invalid={errors.name ? true : undefined}
                autoFocus
              />
              {errors.name && <ErrorMessage>{errors.name}</ErrorMessage>}
            </Field>

            {/* Type field */}
            <Field>
              <Label>
                <Trans>Type</Trans>
              </Label>
              <Description>
                <Trans>
                  The type determines the unit's role in the hierarchy.
                </Trans>
              </Description>
              <Select
                value={formData.type}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  handleChange("type", e.target.value as OrganizationalUnitType)
                }
                disabled={isSubmitting}
                data-invalid={errors.type ? true : undefined}
              >
                {(mode === "create" && parentType
                  ? getValidChildTypeOptions(parentType)
                  : getUnitTypeOptions()
                ).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {errors.type && <ErrorMessage>{errors.type}</ErrorMessage>}
            </Field>

            {/* Description field */}
            <Field>
              <Label>
                <Trans>Description</Trans>
              </Label>
              <Description>
                <Trans>Optional description for this unit.</Trans>
              </Description>
              <Textarea
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  handleChange("description", e.target.value)
                }
                placeholder={t`Optional description...`}
                disabled={isSubmitting}
                rows={3}
                data-invalid={errors.description ? true : undefined}
              />
              {errors.description && (
                <ErrorMessage>{errors.description}</ErrorMessage>
              )}
            </Field>

            {/* Parent info (read-only in create mode) */}
            {mode === "create" && parentName && (
              <Field>
                <Label>
                  <Trans>Parent Unit</Trans>
                </Label>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {parentName}
                </div>
                <Description>
                  <Trans>The new unit will be created under this parent.</Trans>
                </Description>
              </Field>
            )}
          </div>
        </DialogBody>

        <DialogActions>
          <Button plain onClick={onClose} disabled={isSubmitting} type="button">
            <Trans>Cancel</Trans>
          </Button>
          <Button type="submit" disabled={isSubmitting || !isOnline}>
            {isSubmitting ? (
              <Trans>Saving...</Trans>
            ) : mode === "create" ? (
              <Trans>Create</Trans>
            ) : (
              <Trans>Save Changes</Trans>
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default OrganizationalUnitFormDialog;
