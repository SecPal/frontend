// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from "react";
import { Trans, t } from "@lingui/macro";
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
import { Field, Label, ErrorMessage, Description } from "./fieldset";
import { Switch, SwitchField } from "./switch";
import type {
  LeadershipLevel,
  LeadershipLevelFormData,
} from "../types/leadershipLevel";
import {
  createLeadershipLevel,
  updateLeadershipLevel,
} from "../services/leadershipLevelApi";
import { ApiError } from "../services/ApiError";

export interface LeadershipLevelFormProps {
  /** Dialog open state */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Mode: create new level or edit existing */
  mode: "create" | "edit";
  /** Existing level to edit (required for edit mode) */
  level?: LeadershipLevel | null;
  /** Callback on successful save */
  onSuccess: (level: LeadershipLevel) => void;
}

interface FormErrors {
  rank?: string;
  name?: string;
  description?: string;
  color?: string;
  general?: string;
}

/**
 * Dialog component for creating and editing leadership levels
 *
 * Features:
 * - Create mode: New leadership level with rank, name, color
 * - Edit mode: Update existing level properties
 * - Form validation per ADR-009 constraints
 * - API error handling
 * - Loading state during submission
 *
 * Validation Rules:
 * - Rank: 1-255 (1=CEO, ascending for lower levels)
 * - Name: Required, max 100 characters, unique per tenant
 * - Description: Optional, max 1000 characters
 * - Color: Optional, valid hex color format (#RRGGBB)
 *
 * Part of Epic #399 - Leadership Levels System
 * @see Issue #426: Frontend UI for Leadership Levels
 * @see https://github.com/SecPal/.github/blob/main/docs/adr/20251221-inheritance-blocking-and-leadership-access-control.md
 */
export function LeadershipLevelForm({
  open,
  onClose,
  mode,
  level,
  onSuccess,
}: LeadershipLevelFormProps) {
  // Form state
  const [formData, setFormData] = useState<LeadershipLevelFormData>({
    rank: 1,
    name: "",
    description: null,
    color: null,
    is_active: true,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens or level changes
  useEffect(() => {
    if (open) {
      if (mode === "edit" && level) {
        setFormData({
          rank: level.rank,
          name: level.name,
          description: level.description || null,
          color: level.color || null,
          is_active: level.is_active,
        });
      } else {
        // Create mode: reset to defaults
        setFormData({
          rank: 1,
          name: "",
          description: null,
          color: null,
          is_active: true,
        });
      }
      setErrors({});
    }
  }, [open, mode, level]);

  // Validate form
  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // Rank: 1-255
    if (formData.rank < 1 || formData.rank > 255) {
      newErrors.rank = t`Rank must be between 1 (CEO) and 255`;
    }

    // Name: Required, max 100 chars
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      newErrors.name = t`Name is required`;
    } else if (trimmedName.length > 100) {
      newErrors.name = t`Name must be at most 100 characters`;
    }

    // Description: Optional, max 1000 chars
    const trimmedDescription = formData.description?.trim() || "";
    if (trimmedDescription && trimmedDescription.length > 1000) {
      newErrors.description = t`Description must be at most 1000 characters`;
    }

    // Color: Optional, must be valid hex if provided
    if (formData.color) {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      if (!hexColorRegex.test(formData.color)) {
        newErrors.color = t`Color must be a valid hex code (e.g., #FF5733)`;
      }
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
      const payload: LeadershipLevelFormData = {
        ...formData,
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        color: formData.color?.trim() || null,
      };

      let savedLevel: LeadershipLevel;

      if (mode === "create") {
        savedLevel = await createLeadershipLevel(payload);
      } else if (level) {
        savedLevel = await updateLeadershipLevel(level.id, payload);
      } else {
        throw new Error("Cannot update without level ID");
      }

      onSuccess(savedLevel);
      onClose();
    } catch (err) {
      console.error("Failed to save leadership level:", err);
      if (err instanceof ApiError) {
        // Check for validation errors (422)
        if (err.statusCode === 422 && err.response) {
          try {
            const errorData = await err.response.json();
            if (errorData?.errors) {
              const apiErrors = errorData.errors;
              const newErrors: FormErrors = {};

              if (apiErrors.rank) {
                newErrors.rank = Array.isArray(apiErrors.rank)
                  ? apiErrors.rank[0]
                  : apiErrors.rank;
              }
              if (apiErrors.name) {
                newErrors.name = Array.isArray(apiErrors.name)
                  ? apiErrors.name[0]
                  : apiErrors.name;
              }
              if (apiErrors.description) {
                newErrors.description = Array.isArray(apiErrors.description)
                  ? apiErrors.description[0]
                  : apiErrors.description;
              }
              if (apiErrors.color) {
                newErrors.color = Array.isArray(apiErrors.color)
                  ? apiErrors.color[0]
                  : apiErrors.color;
              }

              setErrors(newErrors);
              return;
            }
          } catch {
            // JSON parsing failed, fall through to general error
          }
        }

        setErrors({ general: err.message });
      } else {
        setErrors({
          general: t`Failed to save leadership level. Please try again.`,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle input changes
  const handleInputChange = (
    field: keyof LeadershipLevelFormData,
    value: string | number | boolean | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogTitle>
        {mode === "create" ? (
          <Trans>Create Leadership Level</Trans>
        ) : (
          <Trans>Edit Leadership Level</Trans>
        )}
      </DialogTitle>
      <DialogDescription>
        {mode === "create" ? (
          <Trans>
            Create a new leadership level. Rank 1 represents the highest
            authority (CEO), with ascending numbers for lower organizational
            levels.
          </Trans>
        ) : (
          <Trans>
            Update the leadership level properties. Rank changes may affect
            existing permission scopes.
          </Trans>
        )}
      </DialogDescription>

      <DialogBody>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General error */}
          {errors.general && (
            <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/10">
              <p className="text-sm text-red-800 dark:text-red-200">
                {errors.general}
              </p>
            </div>
          )}

          {/* Rank */}
          <Field>
            <Label>
              <Trans>Rank</Trans>
            </Label>
            <Description>
              <Trans>
                Numerical hierarchy: 1 = CEO (highest authority), ascending
                numbers = lower levels
              </Trans>
            </Description>
            <Input
              type="number"
              min={1}
              max={255}
              value={formData.rank}
              onChange={(e) =>
                handleInputChange("rank", parseInt(e.target.value, 10))
              }
              invalid={!!errors.rank}
              required
            />
            {errors.rank && <ErrorMessage>{errors.rank}</ErrorMessage>}
          </Field>

          {/* Name */}
          <Field>
            <Label>
              <Trans>Name</Trans>
            </Label>
            <Description>
              <Trans>
                Display name for this leadership level (e.g., "Branch Director",
                "Site Manager")
              </Trans>
            </Description>
            <Input
              type="text"
              maxLength={100}
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              invalid={!!errors.name}
              placeholder={t`e.g., Branch Director`}
              required
            />
            {errors.name && <ErrorMessage>{errors.name}</ErrorMessage>}
          </Field>

          {/* Description */}
          <Field>
            <Label>
              <Trans>Description</Trans>
            </Label>
            <Description>
              <Trans>
                Optional detailed explanation of this level's responsibilities
              </Trans>
            </Description>
            <Textarea
              maxLength={1000}
              rows={3}
              value={formData.description || ""}
              onChange={(e) =>
                handleInputChange("description", e.target.value || null)
              }
              invalid={!!errors.description}
              placeholder={t`e.g., Manages branch operations and reports to regional management`}
            />
            {errors.description && (
              <ErrorMessage>{errors.description}</ErrorMessage>
            )}
          </Field>

          {/* Color */}
          <Field>
            <Label>
              <Trans>Color</Trans>
            </Label>
            <Description>
              <Trans>
                Optional hex color for UI visualization (e.g., #FF5733)
              </Trans>
            </Description>
            <div className="flex items-center gap-3">
              <Input
                type="text"
                maxLength={7}
                value={formData.color || ""}
                onChange={(e) =>
                  handleInputChange("color", e.target.value || null)
                }
                invalid={!!errors.color}
                placeholder="#FF5733"
                className="font-mono"
              />
              {formData.color && (
                <div
                  className="w-10 h-10 rounded border border-zinc-300 dark:border-zinc-700"
                  style={{ backgroundColor: formData.color }}
                  aria-label={t`Color preview`}
                />
              )}
            </div>
            {errors.color && <ErrorMessage>{errors.color}</ErrorMessage>}
          </Field>

          {/* Active Status */}
          <SwitchField>
            <Label>
              <Trans>Active</Trans>
            </Label>
            <Description>
              <Trans>
                Inactive levels are hidden from employee assignment but preserve
                historical data
              </Trans>
            </Description>
            <Switch
              checked={formData.is_active}
              onChange={(checked) => handleInputChange("is_active", checked)}
            />
          </SwitchField>
        </form>
      </DialogBody>

      <DialogActions>
        <Button plain onClick={onClose} disabled={isSubmitting}>
          <Trans>Cancel</Trans>
        </Button>
        <Button type="submit" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <Trans>Saving...</Trans>
          ) : mode === "create" ? (
            <Trans>Create</Trans>
          ) : (
            <Trans>Save Changes</Trans>
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
