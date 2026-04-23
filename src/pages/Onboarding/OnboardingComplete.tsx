// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, FormEvent } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { Button } from "../../components/button";
import { Input } from "../../components/input";
import { Field, Label, FieldGroup } from "../../components/fieldset";
import { Heading } from "../../components/heading";
import { Text } from "../../components/text";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogActions,
} from "../../components/dialog";
import { AuthLayout } from "../../components/auth-layout";
import { Logo } from "../../components/Logo";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useAuth } from "../../hooks/useAuth";
import {
  completeOnboarding,
  validateOnboardingToken,
  type OnboardingApiError,
  type OnboardingCompleteData,
} from "../../services/onboardingApi";
import {
  validateNameChange,
  type ValidationSeverity,
} from "../../utils/nameValidation";

interface FormData {
  first_name: string;
  last_name: string;
  password: string;
  password_confirmation: string;
}

interface ValidationErrors {
  first_name?: string;
  last_name?: string;
  password?: string;
  password_confirmation?: string;
  general?: string;
}

interface TokenValidationState {
  kind: "validating" | "ready" | "invalid" | "rate_limited";
  message?: string;
  retryAfterSeconds?: number;
}

/**
 * OnboardingComplete Component
 *
 * Handles magic link onboarding completion for new employees.
 * This is a PUBLIC route (no authentication required).
 *
 * Flow:
 * 1. User receives email with magic link
 * 2. Clicks link → Lands on this page with token & email in URL
 * 3. Fills form (first name, last name, password)
 * 4. Submits → Backend validates token & creates account
 * 5. Success → Browser session is established → Redirect to /onboarding wizard
 *
 * Security:
 * - Token is single-use and expires after 7 days (backend enforced)
 * - Client-side validation mirrors backend Password::defaults()
 */
export function OnboardingComplete() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { _ } = useLingui();

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [formData, setFormData] = useState<FormData>({
    first_name: "",
    last_name: "",
    password: "",
    password_confirmation: "",
  });

  // Track original names from backend for change detection
  const [originalNames, setOriginalNames] = useState<{
    first_name: string;
    last_name: string;
  }>({ first_name: "", last_name: "" });

  const [loading, setLoading] = useState(false);
  const [tokenValidationState, setTokenValidationState] =
    useState<TokenValidationState>(
      token && email ? { kind: "validating" } : { kind: "invalid" }
    );
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [showNameChangeWarning, setShowNameChangeWarning] = useState(false);
  const [nameChangeConfirmed, setNameChangeConfirmed] = useState(false);
  const [nameValidation, setNameValidation] = useState<{
    firstName: {
      severity: ValidationSeverity;
      messageKey: string;
      similarity: number;
    } | null;
    lastName: {
      severity: ValidationSeverity;
      messageKey: string;
      similarity: number;
    } | null;
  }>({ firstName: null, lastName: null });

  const isOnboardingApiError = (err: unknown): err is OnboardingApiError => {
    return (
      typeof err === "object" &&
      err !== null &&
      "response" in err &&
      typeof (err as { response: unknown }).response === "object" &&
      (err as { response: unknown }).response !== null
    );
  };

  const getRetryHint = (retryAfterSeconds?: number): string | null => {
    if (!retryAfterSeconds || retryAfterSeconds <= 0) {
      return null;
    }

    const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);

    if (retryAfterMinutes <= 1) {
      return _(msg`Please try again in about 1 minute.`);
    }

    return _(msg`Please try again in about ${retryAfterMinutes} minutes.`);
  };

  const buildRateLimitMessage = (retryAfterSeconds?: number): string => {
    const retryHint = getRetryHint(retryAfterSeconds);
    const baseMessage = _(
      msg`Too many onboarding attempts. Please try again later.`
    );

    return retryHint ? `${baseMessage} ${retryHint}` : baseMessage;
  };

  // Validate names whenever form data changes
  useEffect(() => {
    if (!originalNames.first_name && !originalNames.last_name) {
      // No original names loaded yet
      return;
    }

    const firstNameResult =
      formData.first_name.trim() &&
      formData.first_name.trim() !== originalNames.first_name.trim()
        ? validateNameChange(originalNames.first_name, formData.first_name)
        : null;

    const lastNameResult =
      formData.last_name.trim() &&
      formData.last_name.trim() !== originalNames.last_name.trim()
        ? validateNameChange(originalNames.last_name, formData.last_name)
        : null;

    setNameValidation({
      firstName: firstNameResult
        ? {
            severity: firstNameResult.severity,
            messageKey: firstNameResult.messageKey,
            similarity: firstNameResult.similarity,
          }
        : null,
      lastName: lastNameResult
        ? {
            severity: lastNameResult.severity,
            messageKey: lastNameResult.messageKey,
            similarity: lastNameResult.similarity,
          }
        : null,
    });
  }, [formData.first_name, formData.last_name, originalNames]);

  // Helper function to get severity-based CSS classes
  const getSeverityClassName = (severity: ValidationSeverity): string => {
    if (severity === "major") {
      return "text-red-600 dark:text-red-400 font-medium";
    }
    if (severity === "medium") {
      return "text-amber-600 dark:text-amber-400";
    }
    return "text-blue-600 dark:text-blue-400";
  };

  // Helper function to get translated validation message
  const getValidationMessage = (
    fieldName: string,
    messageKey: string,
    similarity: number
  ): string => {
    if (messageKey === "minor") {
      return _(
        msg`${fieldName} appears to be a minor correction (${similarity}% similar).`
      );
    } else if (messageKey === "medium") {
      return _(
        msg`${fieldName} has changed significantly (${similarity}% similar). HR will be notified for verification.`
      );
    } else {
      // major
      return _(
        msg`This ${fieldName.toLowerCase()} change is too significant (${similarity}% similar). Please contact HR to update your name before completing onboarding.`
      );
    }
  };

  // Validate token and prefill form on mount
  useEffect(() => {
    const validateAndPrefill = async () => {
      if (!token || !email) {
        let errorMessage = _(
          msg`Invalid onboarding link. Please check your email and try again.`
        );

        // More specific error messages for debugging
        if (!token && !email) {
          errorMessage = _(
            msg`Missing token and email. Please use the link from your email.`
          );
        } else if (!token) {
          errorMessage = _(
            msg`Missing onboarding token. Please use the link from your email.`
          );
        } else if (!email) {
          errorMessage = _(
            msg`Missing email address. Please use the link from your email.`
          );
        }

        setTokenValidationState({
          kind: "invalid",
          message: errorMessage,
        });
        return;
      }

      setTokenValidationState({ kind: "validating" });

      // Validate token and get employee data for prefilling
      try {
        const response = await validateOnboardingToken(token, email);

        // Store original names for change detection
        setOriginalNames({
          first_name: response.data.first_name || "",
          last_name: response.data.last_name || "",
        });

        // Prefill form with existing employee data
        setFormData((prev) => ({
          ...prev,
          first_name: response.data.first_name || "",
          last_name: response.data.last_name || "",
        }));

        setTokenValidationState({ kind: "ready" });
      } catch (error) {
        if (isOnboardingApiError(error) && error.response.status === 429) {
          setTokenValidationState({
            kind: "rate_limited",
            message: _(
              msg`Too many onboarding attempts. Please try again later.`
            ),
            retryAfterSeconds: error.response.retryAfterSeconds,
          });

          return;
        }

        setTokenValidationState({
          kind: "invalid",
          message: isOnboardingApiError(error)
            ? error.response.data.message ||
              _(msg`Failed to validate onboarding link`)
            : error instanceof Error
              ? error.message
              : _(msg`Failed to validate onboarding link`),
        });
      }
    };

    validateAndPrefill();
  }, [token, email, _, validationAttempt]);

  /**
   * Client-side form validation
   */
  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    if (!formData.first_name.trim()) {
      newErrors.first_name = _(msg`First name is required`);
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = _(msg`Last name is required`);
    }

    if (!formData.password) {
      newErrors.password = _(msg`Password is required`);
    } else if (formData.password.length < 8) {
      newErrors.password = _(msg`Password must be at least 8 characters`);
    }

    if (formData.password !== formData.password_confirmation) {
      newErrors.password_confirmation = _(msg`Passwords do not match`);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Perform actual API submission
   */
  const performSubmission = async () => {
    // Close dialog if open
    setShowNameChangeWarning(false);
    setLoading(true);
    setErrors({});

    try {
      const data: OnboardingCompleteData = {
        token: token!,
        email: email!,
        first_name: formData.first_name,
        last_name: formData.last_name,
        password: formData.password,
      };

      const response = await completeOnboarding(data);

      // Store the new authenticated session user data
      await login({
        id: String(response.data.user.id),
        email: response.data.user.email,
        name: response.data.user.name,
        emailVerified: response.data.user.email_verified ?? true,
        employeeStatus: response.data.employee.status,
      });

      // Success: Redirect to onboarding wizard
      navigate("/onboarding", {
        state: {
          message: _(msg`Welcome to SecPal! Let's complete your profile.`),
          fromOnboardingComplete: true,
        },
      });
    } catch (error: unknown) {
      console.error("Onboarding completion failed:", error);

      // Reset name change confirmation on error
      setNameChangeConfirmed(false);

      if (isOnboardingApiError(error)) {
        if (error.response.status === 422) {
          // Validation errors from backend
          const backendErrors = error.response.data.errors || {};
          const formattedErrors: ValidationErrors = {};

          // Convert Laravel validation errors array format to single strings
          Object.entries(backendErrors).forEach(([key, value]) => {
            formattedErrors[key as keyof ValidationErrors] = Array.isArray(
              value
            )
              ? value[0]
              : value;
          });

          setErrors(formattedErrors);

          if (error.response.data.message) {
            setErrors((prev) => ({
              ...prev,
              general: error.response.data.message,
            }));
          }
        } else if (error.response.status === 429) {
          // Rate limit exceeded
          setErrors({
            general: buildRateLimitMessage(error.response.retryAfterSeconds),
          });
        } else {
          // Generic error
          setErrors({
            general:
              error.response.data.message ||
              _(
                msg`Failed to complete onboarding. Please try again or contact support.`
              ),
          });
        }
      } else {
        // Network or other error
        setErrors({
          general: _(
            msg`Failed to complete onboarding. Please try again or contact support.`
          ),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Check if names were changed (only check if original names were loaded from backend)
    const hasLoadedOriginalNames =
      originalNames.first_name.trim() !== "" ||
      originalNames.last_name.trim() !== "";
    const firstNameChanged =
      hasLoadedOriginalNames &&
      formData.first_name.trim() !== "" &&
      formData.first_name.trim() !== originalNames.first_name.trim();
    const lastNameChanged =
      hasLoadedOriginalNames &&
      formData.last_name.trim() !== "" &&
      formData.last_name.trim() !== originalNames.last_name.trim();

    // Check validation results - block major changes
    const hasMajorChange =
      nameValidation.firstName?.severity === "major" ||
      nameValidation.lastName?.severity === "major";

    if (hasMajorChange) {
      // Don't submit - major changes are blocked
      return;
    }

    // Only show warning dialog for medium changes (50-80% similarity)
    const hasMediumChange =
      nameValidation.firstName?.severity === "medium" ||
      nameValidation.lastName?.severity === "medium";

    // Show warning dialog if medium change and user hasn't confirmed yet
    if (
      (firstNameChanged || lastNameChanged) &&
      hasMediumChange &&
      !nameChangeConfirmed &&
      !loading &&
      Object.keys(errors).length === 0
    ) {
      setShowNameChangeWarning(true);
      return; // Stop submission, wait for user confirmation
    }

    // If we reach here, either no name change, minor change, or user confirmed - proceed with submission
    await performSubmission();
  };

  if (
    tokenValidationState.kind === "invalid" ||
    tokenValidationState.kind === "rate_limited"
  ) {
    const isRateLimited = tokenValidationState.kind === "rate_limited";
    const retryHint = getRetryHint(tokenValidationState.retryAfterSeconds);

    return (
      <AuthLayout>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size="48" />
            <h1 className="text-3xl font-bold">SecPal</h1>
          </div>
          <LanguageSwitcher />
        </div>

        <div
          className={
            isRateLimited
              ? "mt-8 rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30"
              : "mt-8 rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30"
          }
        >
          <Heading
            level={2}
            className={
              isRateLimited
                ? "text-amber-800 dark:text-amber-200"
                : "text-red-800 dark:text-red-200"
            }
          >
            {isRateLimited ? (
              <Trans>Too Many Attempts</Trans>
            ) : (
              <Trans>Invalid Link</Trans>
            )}
          </Heading>
          <Text
            className={
              isRateLimited
                ? "mt-2 text-amber-700 dark:text-amber-300"
                : "mt-2 text-red-700 dark:text-red-300"
            }
          >
            {tokenValidationState.message}
          </Text>
          {isRateLimited && retryHint && (
            <Text className="mt-2 text-amber-700 dark:text-amber-300">
              {retryHint}
            </Text>
          )}
          <div className="mt-4">
            {isRateLimited ? (
              <Button
                onClick={() => setValidationAttempt((attempt) => attempt + 1)}
              >
                <Trans>Try Again</Trans>
              </Button>
            ) : (
              <Button color="red" onClick={() => navigate("/login")}>
                <Trans>Go to Login</Trans>
              </Button>
            )}
          </div>
        </div>
      </AuthLayout>
    );
  }

  // Show loading spinner while validating token
  if (tokenValidationState.kind === "validating") {
    return (
      <AuthLayout>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size="48" />
            <h1 className="text-3xl font-bold">SecPal</h1>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="mt-8 text-center">
          <Text>
            <Trans>Validating your link...</Trans>
          </Text>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo size="48" />
          <h1 className="text-3xl font-bold">SecPal</h1>
        </div>
        <LanguageSwitcher />
      </div>

      <div className="mt-8">
        <Heading level={2}>
          <Trans>Welcome to SecPal!</Trans>
        </Heading>
        <Text className="mt-2 text-zinc-600 dark:text-zinc-400">
          <Trans>Complete your account setup to get started</Trans>
        </Text>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-8"
        data-onboarding-form="true"
      >
        {errors.general && (
          <div className="mb-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <Text className="text-red-800 dark:text-red-200">
              {errors.general}
            </Text>
          </div>
        )}

        {/* Name Change Warning Dialog - Catalyst */}
        <Dialog
          open={showNameChangeWarning && !loading}
          onClose={() => setShowNameChangeWarning(false)}
        >
          <DialogTitle>
            <span className="text-amber-600 dark:text-amber-400 mr-2">⚠️</span>
            <Trans>Name Change Detected</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              You have changed your name from what was initially entered. HR
              will be notified of this change for verification.
            </Trans>
          </DialogDescription>
          <DialogBody>
            {formData.first_name.trim() !== originalNames.first_name.trim() && (
              <Text className="text-sm text-zinc-700 dark:text-zinc-300">
                <strong>
                  <Trans>First Name:</Trans>
                </strong>{" "}
                <span className="text-zinc-500 dark:text-zinc-400">
                  {originalNames.first_name}
                </span>{" "}
                →{" "}
                <span className="text-zinc-900 dark:text-zinc-100 font-medium">
                  {formData.first_name}
                </span>
              </Text>
            )}
            {formData.last_name.trim() !== originalNames.last_name.trim() && (
              <Text className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                <strong>
                  <Trans>Last Name:</Trans>
                </strong>{" "}
                <span className="text-zinc-500 dark:text-zinc-400">
                  {originalNames.last_name}
                </span>{" "}
                →{" "}
                <span className="text-zinc-900 dark:text-zinc-100 font-medium">
                  {formData.last_name}
                </span>
              </Text>
            )}
          </DialogBody>
          <DialogActions>
            <Button
              plain
              onClick={() => {
                // Reset to original names
                setFormData((prev) => ({
                  ...prev,
                  first_name: originalNames.first_name,
                  last_name: originalNames.last_name,
                }));
                setShowNameChangeWarning(false);
                setNameChangeConfirmed(false);
              }}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button
              color="amber"
              onClick={async () => {
                // User confirmed - set flag, close dialog and submit
                setNameChangeConfirmed(true);
                setShowNameChangeWarning(false);
                await performSubmission();
              }}
            >
              <Trans>Confirm and Continue</Trans>
            </Button>
          </DialogActions>
        </Dialog>

        <FieldGroup>
          {/* First Name - BewachV §16 requires all first names */}
          <Field>
            <Label>
              <Trans>First Names (all)</Trans> *
            </Label>
            <Input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, first_name: e.target.value }))
              }
              disabled={loading}
              autoFocus
              invalid={!!errors.first_name}
            />
            <Text className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              <Trans>
                Enter all your first names as shown on your ID (e.g.,
                "Hans-Peter Friedrich")
              </Trans>
            </Text>
            {originalNames.first_name &&
              formData.first_name !== originalNames.first_name && (
                <Text className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                  ℹ️ <Trans>Original:</Trans> {originalNames.first_name}
                </Text>
              )}
            {nameValidation.firstName && (
              <Text
                className={`text-sm mt-1 ${getSeverityClassName(nameValidation.firstName.severity)}`}
              >
                {nameValidation.firstName.severity === "major" && "⚠️ "}
                {getValidationMessage(
                  "first name",
                  nameValidation.firstName.messageKey,
                  nameValidation.firstName.similarity
                )}
              </Text>
            )}
            {errors.first_name && (
              <Text className="text-sm text-red-600 dark:text-red-400 mt-1">
                {errors.first_name}
              </Text>
            )}
          </Field>

          {/* Last Name */}
          <Field>
            <Label>
              <Trans>Last Name</Trans> *
            </Label>
            <Input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, last_name: e.target.value }))
              }
              disabled={loading}
              invalid={!!errors.last_name}
            />
            {originalNames.last_name &&
              formData.last_name !== originalNames.last_name && (
                <Text className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                  ℹ️ <Trans>Original:</Trans> {originalNames.last_name}
                </Text>
              )}
            {nameValidation.lastName && (
              <Text
                className={`text-sm mt-1 ${getSeverityClassName(nameValidation.lastName.severity)}`}
              >
                {nameValidation.lastName.severity === "major" && "⚠️ "}
                {getValidationMessage(
                  "last name",
                  nameValidation.lastName.messageKey,
                  nameValidation.lastName.similarity
                )}
              </Text>
            )}
            {errors.last_name && (
              <Text className="text-sm text-red-600 mt-1">
                {errors.last_name}
              </Text>
            )}
          </Field>

          {/* Password */}
          <Field>
            <Label>
              <Trans>Password</Trans> *
            </Label>
            <Input
              type="password"
              name="password"
              aria-label="Password"
              value={formData.password}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, password: e.target.value }))
              }
              disabled={loading}
              invalid={!!errors.password}
            />
            {errors.password && (
              <Text className="text-sm text-red-600 mt-1">
                {errors.password}
              </Text>
            )}
            <Text className="text-sm text-zinc-500 mt-1">
              <Trans>Minimum 8 characters</Trans>
            </Text>
          </Field>

          {/* Password Confirmation */}
          <Field>
            <Label>
              <Trans>Confirm Password</Trans> *
            </Label>
            <Input
              type="password"
              name="password_confirmation"
              value={formData.password_confirmation}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  password_confirmation: e.target.value,
                }))
              }
              disabled={loading}
              invalid={!!errors.password_confirmation}
            />
            {errors.password_confirmation && (
              <Text className="text-sm text-red-600 mt-1">
                {errors.password_confirmation}
              </Text>
            )}
          </Field>

          {/* Submit Button */}
          <div className="mt-8">
            <Button
              type="submit"
              color="indigo"
              className="w-full"
              disabled={
                loading ||
                nameValidation.firstName?.severity === "major" ||
                nameValidation.lastName?.severity === "major"
              }
            >
              {loading ? (
                <Trans>Completing Setup...</Trans>
              ) : (
                <Trans>Complete Account Setup</Trans>
              )}
            </Button>
            {(nameValidation.firstName?.severity === "major" ||
              nameValidation.lastName?.severity === "major") && (
              <Text className="text-sm text-red-600 dark:text-red-400 mt-2 text-center">
                ⚠️{" "}
                <Trans>
                  Name change too significant. Please contact HR before
                  completing onboarding.
                </Trans>
              </Text>
            )}
          </div>

          {/* Help Text */}
        </FieldGroup>
      </form>
    </AuthLayout>
  );
}
