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
import { Field, Label, Description } from "./fieldset";
import { Checkbox, CheckboxField } from "./checkbox";
import type { OrganizationalScope } from "../types/organizationalScope";
import type { User } from "../contexts/auth-context";
import {
  createOrganizationalScope,
  updateOrganizationalScope,
  type OrganizationalScopeFormData,
} from "../services/organizationalScopeApi";
import { ApiError } from "../services/ApiError";

export interface ScopeAssignmentFormProps {
  /** Dialog open state */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Mode: create new scope or edit existing */
  mode: "create" | "edit";
  /** Organizational unit ID */
  organizationalUnitId: string;
  /** User being assigned (for create mode) */
  user?: User | null;
  /** Existing scope to edit (required for edit mode) */
  scope?: OrganizationalScope | null;
  /** Callback on successful save */
  onSuccess: (scope: OrganizationalScope) => void;
}

interface FormErrors {
  general?: string;
  viewing?: string;
  assignment?: string;
}

/**
 * Two-Step Scope Assignment Form with conditional Step 3 (ADR-009)
 *
 * Step 1: Viewing Permissions (min/max_viewable_rank)
 * Step 2: Assignment Permissions (min/max_assignable_rank)
 * Step 3: Self-Access Control (conditional, only if user's rank in viewable range)
 *
 * Part of Epic #399 - Leadership Levels System
 * @see Issue #426: Frontend UI for Leadership Levels
 * @see https://github.com/SecPal/.github/blob/main/docs/adr/20251221-inheritance-blocking-and-leadership-access-control.md
 */
export function ScopeAssignmentForm({
  open,
  onClose,
  mode,
  organizationalUnitId,
  user,
  scope,
  onSuccess,
}: ScopeAssignmentFormProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<
    Partial<OrganizationalScopeFormData>
  >({
    access_level: "read",
    include_descendants: true,
    min_viewable_rank: null,
    max_viewable_rank: null,
    min_assignable_rank: null,
    max_assignable_rank: null,
    allow_self_access: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get user's current management level (0=non-management, 1-255=management)
  const userRank = user?.employee?.management_level ?? 0;

  // Calculate if Step 3 should be shown
  const showSelfAccessStep =
    userRank > 0 &&
    (formData.min_viewable_rank === null ||
      formData.min_viewable_rank === undefined ||
      userRank >= formData.min_viewable_rank) &&
    (formData.max_viewable_rank === null ||
      formData.max_viewable_rank === undefined ||
      formData.max_viewable_rank === 0 ||
      userRank <= formData.max_viewable_rank);

  // Reset form when dialog opens or changes
  useEffect(() => {
    if (open) {
      setStep(1);
      setErrors({});

      if (mode === "edit" && scope) {
        setFormData({
          access_level: scope.access_level,
          include_descendants: scope.include_descendants,
          min_viewable_rank: scope.min_viewable_rank,
          max_viewable_rank: scope.max_viewable_rank,
          min_assignable_rank: scope.min_assignable_rank,
          max_assignable_rank: scope.max_assignable_rank,
          allow_self_access: scope.allow_self_access,
        });
      } else {
        setFormData({
          access_level: "read",
          include_descendants: true,
          min_viewable_rank: null,
          max_viewable_rank: null,
          min_assignable_rank: null,
          max_assignable_rank: null,
          allow_self_access: false,
        });
      }
    }
  }, [open, mode, scope]);

  // Validation for viewing permissions
  const validateViewingStep = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // Invalid: min > max when both set
    if (
      formData.min_viewable_rank !== null &&
      formData.min_viewable_rank !== undefined &&
      formData.max_viewable_rank !== null &&
      formData.max_viewable_rank !== undefined &&
      formData.max_viewable_rank > 0 &&
      formData.min_viewable_rank > formData.max_viewable_rank
    ) {
      newErrors.viewing = t`Minimum rank cannot be greater than maximum rank.`;
    }

    // Invalid: min set but max = 0 (no overlap)
    if (
      formData.min_viewable_rank !== null &&
      formData.min_viewable_rank !== undefined &&
      formData.min_viewable_rank > 0 &&
      (formData.max_viewable_rank === null ||
        formData.max_viewable_rank === undefined ||
        formData.max_viewable_rank === 0)
    ) {
      newErrors.viewing = t`Invalid combination: No employees will be visible with this range.`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Validation for assignment permissions
  const validateAssignmentStep = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // Invalid: min > max when both set
    if (
      formData.min_assignable_rank !== null &&
      formData.min_assignable_rank !== undefined &&
      formData.max_assignable_rank !== null &&
      formData.max_assignable_rank !== undefined &&
      formData.max_assignable_rank > 0 &&
      formData.min_assignable_rank > formData.max_assignable_rank
    ) {
      newErrors.assignment = t`Minimum rank cannot be greater than maximum rank.`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle next step
  const handleNext = useCallback(() => {
    if (step === 1 && !validateViewingStep()) {
      return;
    }
    if (step === 2 && !validateAssignmentStep()) {
      return;
    }
    setStep(step + 1);
  }, [step, validateViewingStep, validateAssignmentStep]);

  // Handle submit
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (step === 1) {
        handleNext();
        return;
      }

      if (step === 2) {
        if (showSelfAccessStep) {
          handleNext();
          return;
        }
        // Fall through to save if no Step 3
      }

      // Final validation
      if (!validateViewingStep() || !validateAssignmentStep()) {
        return;
      }

      setIsSubmitting(true);
      setErrors({});

      try {
        if (mode === "create") {
          if (!user) {
            throw new Error("User is required for create mode");
          }
          const created = await createOrganizationalScope(
            organizationalUnitId,
            {
              user_id: String(user.id), // Convert number to string
              organizational_unit_id: organizationalUnitId,
              access_level: formData.access_level || "read",
              include_descendants: formData.include_descendants ?? true,
              min_viewable_rank: formData.min_viewable_rank ?? null,
              max_viewable_rank: formData.max_viewable_rank ?? null,
              min_assignable_rank: formData.min_assignable_rank ?? null,
              max_assignable_rank: formData.max_assignable_rank ?? null,
              allow_self_access: formData.allow_self_access ?? false,
            }
          );
          onSuccess(created.data);
        } else if (scope) {
          const updated = await updateOrganizationalScope(
            organizationalUnitId,
            scope.id,
            {
              access_level: formData.access_level,
              include_descendants: formData.include_descendants,
              min_viewable_rank: formData.min_viewable_rank ?? null,
              max_viewable_rank: formData.max_viewable_rank ?? null,
              min_assignable_rank: formData.min_assignable_rank ?? null,
              max_assignable_rank: formData.max_assignable_rank ?? null,
              allow_self_access: formData.allow_self_access,
            }
          );
          onSuccess(updated.data);
        }
        onClose();
      } catch (err) {
        console.error("Failed to save scope:", err);
        if (err instanceof ApiError) {
          setErrors({ general: err.message });
        } else {
          setErrors({ general: t`Failed to save scope assignment.` });
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      step,
      formData,
      mode,
      user,
      scope,
      organizationalUnitId,
      showSelfAccessStep,
      validateViewingStep,
      validateAssignmentStep,
      handleNext,
      onSuccess,
      onClose,
    ]
  );

  // Get warning messages for current step
  const getViewingWarnings = (): string[] => {
    const warnings: string[] = [];

    if (
      formData.min_viewable_rank !== null &&
      formData.min_viewable_rank !== undefined &&
      formData.min_viewable_rank > 0 &&
      (formData.max_viewable_rank === null ||
        formData.max_viewable_rank === undefined ||
        formData.max_viewable_rank === 0)
    ) {
      warnings.push(
        t`Invalid combination: min=${formData.min_viewable_rank}, max=0 results in no visible employees!`
      );
    }

    return warnings;
  };

  const getAssignmentWarnings = (): string[] => {
    const warnings: string[] = [];

    if (
      formData.max_assignable_rank === null ||
      formData.max_assignable_rank === undefined ||
      formData.max_assignable_rank === 0
    ) {
      warnings.push(
        t`User cannot assign OR remove ANY rank (prevents privilege escalation).`
      );
    }

    if (
      formData.max_assignable_rank !== null &&
      formData.max_assignable_rank !== undefined &&
      formData.max_viewable_rank !== null &&
      formData.max_viewable_rank !== undefined &&
      formData.max_viewable_rank > 0 &&
      formData.max_assignable_rank < formData.max_viewable_rank
    ) {
      warnings.push(
        t`User can see ranks (up to ${formData.max_viewable_rank}) they cannot assign/remove (up to ${formData.max_assignable_rank}).`
      );
    }

    return warnings;
  };

  return (
    <Dialog open={open} onClose={onClose} size="2xl">
      <DialogTitle>
        {mode === "create" ? (
          <Trans>Assign Organizational Scope</Trans>
        ) : (
          <Trans>Edit Organizational Scope</Trans>
        )}
      </DialogTitle>
      <DialogDescription>
        {step === 1 && <Trans>Step 1: Configure viewing permissions</Trans>}
        {step === 2 && <Trans>Step 2: Configure assignment permissions</Trans>}
        {step === 3 && <Trans>Step 3: Self-access control</Trans>}
      </DialogDescription>

      <form onSubmit={handleSubmit}>
        <DialogBody className="space-y-6">
          {errors.general && (
            <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-200">
                <Trans>Error</Trans>
              </h4>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                {errors.general}
              </p>
            </div>
          )}

          {/* Step 1: Viewing Permissions */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-zinc-950 dark:text-white mb-2">
                  <Trans>Who can this user VIEW?</Trans>
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  <Trans>
                    Configure which rank range this user can view. Leave empty
                    or set to 0 to see only non-leadership employees (Guards).
                  </Trans>
                </p>
              </div>

              <Field>
                <Label>
                  <Trans>Minimum Viewable Rank</Trans>
                </Label>
                <input
                  type="number"
                  min="1"
                  max="255"
                  value={formData.min_viewable_rank ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      min_viewable_rank: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  placeholder="Leave empty for no minimum"
                  className="mt-3 block w-full rounded-lg border-none bg-white/5 py-1.5 px-3 text-sm/6 text-zinc-950 dark:text-white focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-white/25"
                />
                <Description>
                  <Trans>
                    Lowest rank number the user can view (1 = CEO, higher
                    numbers = lower positions). Range: 1-255
                  </Trans>
                </Description>
              </Field>

              <Field>
                <Label>
                  <Trans>Maximum Viewable Rank</Trans>
                </Label>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={formData.max_viewable_rank ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_viewable_rank: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  placeholder="0 or empty for non-leadership only"
                  className="mt-3 block w-full rounded-lg border-none bg-white/5 py-1.5 px-3 text-sm/6 text-zinc-950 dark:text-white focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-white/25"
                />
                <Description>
                  <Trans>
                    Highest rank number the user can view (set to 255 for all, 0
                    or empty for non-leadership only). Range: 0-255
                  </Trans>
                </Description>
              </Field>

              {errors.viewing && (
                <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                  <h4 className="text-sm font-semibold text-red-800 dark:text-red-200">
                    <Trans>Validation Error</Trans>
                  </h4>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                    {errors.viewing}
                  </p>
                </div>
              )}

              {getViewingWarnings().length > 0 && (
                <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    <Trans>Warning</Trans>
                  </h4>
                  {getViewingWarnings().map((warning, i) => (
                    <p
                      key={i}
                      className="mt-1 text-sm text-amber-700 dark:text-amber-300"
                    >
                      {warning}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Assignment Permissions */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-zinc-950 dark:text-white mb-2">
                  <Trans>
                    Which rank range can this user ASSIGN or REMOVE?
                  </Trans>
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  <Trans>
                    To remove rank from employee, user must have permission to
                    assign that rank. This prevents privilege escalation.
                  </Trans>
                </p>
              </div>

              <Field>
                <Label>
                  <Trans>Minimum Assignable Rank</Trans>
                </Label>
                <input
                  type="number"
                  min="1"
                  max="255"
                  value={formData.min_assignable_rank ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      min_assignable_rank: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  placeholder="Leave empty for no minimum"
                  className="mt-3 block w-full rounded-lg border-none bg-white/5 py-1.5 px-3 text-sm/6 text-zinc-950 dark:text-white focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-white/25"
                />
                <Description>
                  <Trans>
                    Lowest rank number the user can assign (1 = CEO, higher
                    numbers = lower positions). Range: 1-255
                  </Trans>
                </Description>
              </Field>

              <Field>
                <Label>
                  <Trans>Maximum Assignable Rank</Trans>
                </Label>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={formData.max_assignable_rank ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_assignable_rank: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  placeholder="0 or empty to prevent any assignment"
                  className="mt-3 block w-full rounded-lg border-none bg-white/5 py-1.5 px-3 text-sm/6 text-zinc-950 dark:text-white focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-white/25"
                />
                <Description>
                  <Trans>
                    Highest rank number the user can assign (set to 255 for all,
                    0 or empty to prevent any assignment). Range: 0-255
                  </Trans>
                </Description>
              </Field>

              {errors.assignment && (
                <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                  <h4 className="text-sm font-semibold text-red-800 dark:text-red-200">
                    <Trans>Validation Error</Trans>
                  </h4>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                    {errors.assignment}
                  </p>
                </div>
              )}

              {getAssignmentWarnings().length > 0 && (
                <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    <Trans>Warning</Trans>
                  </h4>
                  {getAssignmentWarnings().map((warning, i) => (
                    <p
                      key={i}
                      className="mt-1 text-sm text-amber-700 dark:text-amber-300"
                    >
                      {warning}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Self-Access Control (Conditional) */}
          {step === 3 && showSelfAccessStep && (
            <div className="space-y-6">
              <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
                <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  <Trans>Self-Access Control Required</Trans>
                </h4>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  <Trans>
                    User's own rank (FE{userRank}) is within viewable range.
                    Should this user be able to view/edit their own HR data?
                  </Trans>
                </p>
              </div>

              <CheckboxField>
                <Checkbox
                  checked={formData.allow_self_access ?? false}
                  onChange={(checked) =>
                    setFormData({ ...formData, allow_self_access: checked })
                  }
                />
                <Label>
                  <Trans>Allow user to view/edit their own HR data</Trans>
                </Label>
                <Description>
                  <Trans>
                    By default (unchecked), users cannot see or edit their own
                    employee record. This prevents self-manipulation of salary,
                    rank, etc. Check this box only if you want this user to
                    access their own HR data.
                  </Trans>
                </Description>
              </CheckboxField>
            </div>
          )}
        </DialogBody>

        <DialogActions>
          <Button type="button" plain onClick={onClose}>
            <Trans>Cancel</Trans>
          </Button>
          {step > 1 && (
            <Button type="button" outline onClick={() => setStep(step - 1)}>
              <Trans>Back</Trans>
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Trans>Saving...</Trans>
            ) : step === 3 || (step === 2 && !showSelfAccessStep) ? (
              <Trans>Save</Trans>
            ) : (
              <Trans>Next</Trans>
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
