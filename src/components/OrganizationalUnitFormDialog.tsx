// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useCallback } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
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
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/ui";
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
import { ApiError } from "../services/ApiError";
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

function OrganizationalUnitFormDialogContent({
  onClose,
  mode,
  parentId,
  parentName,
  parentType,
  unit,
  onSuccess,
}: Omit<OrganizationalUnitFormDialogProps, "open">) {
  const isOnline = useOnlineStatus();

  const [formData, setFormData] = useState<FormData>(() => {
    if (mode === "edit" && unit) {
      return {
        name: unit.name,
        type: unit.type,
        description: unit.description || "",
      };
    }

    const defaultType = getDefaultChildType(parentType || undefined);
    return {
      name: "",
      type: defaultType || "branch",
      description: "",
    };
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleChange = (
    field: keyof FormData,
    value: string | OrganizationalUnitType
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
    <>
      <DialogTitle>{dialogTitle}</DialogTitle>
      <DialogDescription>{dialogDescription}</DialogDescription>

      <form onSubmit={handleSubmit}>
        <DialogBody>
          {!isOnline && (
            <Alert className="mb-4 border-destructive/30 bg-destructive/10 text-foreground">
              <AlertTitle className="text-destructive">
                <Trans>You're offline</Trans>
              </AlertTitle>
              <AlertDescription className="mt-0 text-destructive">
                {mode === "create" ? (
                  <Trans>
                    Creating organizational units is not possible while offline.
                    Please reconnect to make changes.
                  </Trans>
                ) : (
                  <Trans>
                    Editing organizational units is not possible while offline.
                    Please reconnect to make changes.
                  </Trans>
                )}
              </AlertDescription>
            </Alert>
          )}

          {errors.general && (
            <Alert className="mb-4 border-destructive/30 bg-destructive/10 text-foreground">
              <AlertDescription className="mt-0 text-destructive">
                {errors.general}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-6">
            <Field>
              <FieldLabel htmlFor="organizational-unit-name">
                <Trans>Name</Trans>
              </FieldLabel>
              <Input
                id="organizational-unit-name"
                type="text"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleChange("name", e.target.value)
                }
                placeholder={t`e.g., Berlin Branch`}
                disabled={isSubmitting}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={
                  errors.name ? "organizational-unit-name-error" : undefined
                }
                autoFocus
              />
              {errors.name && (
                <FieldError id="organizational-unit-name-error">
                  {errors.name}
                </FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="organizational-unit-type">
                <Trans>Type</Trans>
              </FieldLabel>
              <FieldDescription id="organizational-unit-type-description">
                <Trans>
                  The type determines the unit's role in the hierarchy.
                </Trans>
              </FieldDescription>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  handleChange("type", value as OrganizationalUnitType)
                }
                disabled={isSubmitting}
              >
                <SelectTrigger
                  id="organizational-unit-type"
                  aria-invalid={errors.type ? true : undefined}
                  aria-describedby={
                    errors.type
                      ? "organizational-unit-type-error"
                      : "organizational-unit-type-description"
                  }
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(mode === "create" && parentType
                    ? getValidChildTypeOptions(parentType)
                    : getUnitTypeOptions()
                  ).map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      data-value={option.value}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && (
                <FieldError id="organizational-unit-type-error">
                  {errors.type}
                </FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="organizational-unit-description">
                <Trans>Description</Trans>
              </FieldLabel>
              <FieldDescription id="organizational-unit-description-description">
                <Trans>Optional description for this unit.</Trans>
              </FieldDescription>
              <Textarea
                id="organizational-unit-description"
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  handleChange("description", e.target.value)
                }
                placeholder={t`Optional description...`}
                disabled={isSubmitting}
                rows={3}
                aria-invalid={errors.description ? true : undefined}
                aria-describedby={
                  errors.description
                    ? "organizational-unit-description-error"
                    : "organizational-unit-description-description"
                }
              />
              {errors.description && (
                <FieldError id="organizational-unit-description-error">
                  {errors.description}
                </FieldError>
              )}
            </Field>

            {mode === "create" && parentName && (
              <Field>
                <FieldLabel>
                  <Trans>Parent Unit</Trans>
                </FieldLabel>
                <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground">
                  {parentName}
                </div>
                <FieldDescription>
                  <Trans>The new unit will be created under this parent.</Trans>
                </FieldDescription>
              </Field>
            )}
          </div>
        </DialogBody>

        <DialogActions>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            type="button"
          >
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
    </>
  );
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
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent>
          {open ? (
            <OrganizationalUnitFormDialogContent
              key={`${mode}:${unit?.id ?? parentId ?? "root"}:${parentType ?? "none"}`}
              onClose={onClose}
              mode={mode}
              parentId={parentId}
              parentName={parentName}
              parentType={parentType}
              unit={unit}
              onSuccess={onSuccess}
            />
          ) : null}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

export default OrganizationalUnitFormDialog;
