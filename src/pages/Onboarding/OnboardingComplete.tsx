// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, FormEvent, type ReactNode } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FormSkeleton,
  Input,
  OnboardingAuthCard,
  OnboardingAuthHeader,
  OnboardingAuthShell,
  Skeleton,
} from "@/ui";
import {
  getErrorRetryAfterSeconds,
  getErrorValidationErrors,
  getLocalizedErrorMessage,
} from "../../lib/errorUtils";
import { Logo } from "../../components/Logo";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useAuth } from "../../hooks/useAuth";
import {
  completeOnboarding,
  validateOnboardingToken,
  type OnboardingApiError,
  type OnboardingCompleteData,
} from "../../services/onboardingApi";
import { getOnboardingPasswordIssue } from "../../utils/onboardingPasswordValidation";
import { formatLocalYmd, isValidIsoCalendarDate } from "../../utils/localDate";

interface FormData {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  password: string;
  password_confirmation: string;
}

interface ValidationErrors {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  password?: string;
  password_confirmation?: string;
  general?: string;
}

interface TokenValidationState {
  kind: "validating" | "ready" | "invalid" | "rate_limited";
  message?: string;
  retryAfterSeconds?: number;
}

const COMPROMISED_PASSWORD_ERROR =
  "The given password has appeared in a data leak. Please choose a different password.";

function OnboardingCompleteFrame({ children }: { children: ReactNode }) {
  return (
    <OnboardingAuthShell>
      <OnboardingAuthCard aria-labelledby="onboarding-complete-brand">
        <OnboardingAuthHeader>
          <div className="flex items-center gap-3">
            <Logo size="48" />
            <h1 id="onboarding-complete-brand" className="text-3xl font-bold">
              SecPal
            </h1>
          </div>
          <LanguageSwitcher />
        </OnboardingAuthHeader>

        {children}
      </OnboardingAuthCard>
    </OnboardingAuthShell>
  );
}

function mapOnboardingFieldErrors(
  backendErrors: Record<string, string[]> | undefined,
  localizedCompromisedPasswordError: string
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!backendErrors) {
    return errors;
  }

  for (const [fieldName, fieldMessages] of Object.entries(backendErrors)) {
    const fieldMessage = fieldMessages.find(
      (message) => message.trim().length > 0
    );

    if (!fieldMessage) {
      continue;
    }

    const localizedFieldMessage =
      fieldName === "password" &&
      fieldMessage.trim().toLowerCase() ===
        COMPROMISED_PASSWORD_ERROR.toLowerCase()
        ? localizedCompromisedPasswordError
        : fieldMessage;

    switch (fieldName) {
      case "first_name":
        errors.first_name = localizedFieldMessage;
        break;
      case "last_name":
        errors.last_name = localizedFieldMessage;
        break;
      case "date_of_birth":
        errors.date_of_birth = localizedFieldMessage;
        break;
      case "password":
        errors.password = localizedFieldMessage;
        break;
      case "password_confirmation":
        errors.password_confirmation = localizedFieldMessage;
        break;
      default:
        break;
    }
  }

  return errors;
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
 * 3. Fills form (first name, last name, date of birth, password)
 * 4. Submits → Backend validates token + email + DOB + name similarity
 * 5. Success → Browser session is established → Redirect to /onboarding wizard
 *
 * Security model:
 * - Token is single-use and expires after 7 days (backend enforced).
 * - The validate-token endpoint deliberately does NOT echo first/last name or email,
 *   so anyone in possession of the link cannot harvest profile data. The form
 *   therefore always starts empty and we never show "Original: …" hints.
 * - The actual identity proof (DOB + name match) happens server-side at
 *   POST /onboarding/complete. Any mismatch returns a generic 422 message without a
 *   per-field `errors` payload — this both prevents the response from being used as
 *   a field-level oracle and ensures each failed attempt counts toward the rate-limit
 *   bucket. The frontend renders that generic message verbatim and does not try to
 *   localize it field-by-field.
 * - A failed identity proof permanently revokes the magic link (single-shot policy
 *   enforced by the backend). The frontend therefore does NOT offer a "try again"
 *   button for the generic 422 case; the backend message already directs the user
 *   to HR for a new invitation.
 * - Client-side validation only checks shape (presence, password complexity, DOB
 *   format) and mirrors backend password defaults (min 12 chars, mixed case, number,
 *   symbol). Breach checks remain server-side only.
 */
export function OnboardingComplete() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { _ } = useLingui();
  const localizedCompromisedPasswordError = _(
    msg`The given password has appeared in a data leak. Please choose a different password.`
  );

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [formData, setFormData] = useState<FormData>({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    password: "",
    password_confirmation: "",
  });

  const [loading, setLoading] = useState(false);
  const [tokenValidationState, setTokenValidationState] =
    useState<TokenValidationState>(
      token && email ? { kind: "validating" } : { kind: "invalid" }
    );
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [errors, setErrors] = useState<ValidationErrors>({});

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

  const updateIdentityField = (
    fieldName: "first_name" | "last_name" | "date_of_birth",
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  // Validate token (existence + email match) on mount. We deliberately do NOT
  // prefill the form: the backend no longer returns first_name/last_name/email here
  // to avoid leaking profile data to anyone who only holds the magic link.
  useEffect(() => {
    const validateLink = async () => {
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

      try {
        const validation = await validateOnboardingToken(token, email);
        // Defensive: the contract pins `data.valid` to `const: true` on a 200
        // response, but trusting the status code alone would let any future
        // contract drift (or a mocked/stubbed backend) silently send the user
        // into the completion form with an unusable link. Treat anything other
        // than `valid === true` as if the token were invalid.
        if (validation?.data?.valid !== true) {
          setTokenValidationState({
            kind: "invalid",
            message: _(
              msg`Invalid onboarding link. Please check your email and try again.`
            ),
          });
          return;
        }
        setTokenValidationState({ kind: "ready" });
      } catch (error) {
        if (isOnboardingApiError(error) && error.response.status === 429) {
          setTokenValidationState({
            kind: "rate_limited",
            message: _(
              msg`Too many onboarding attempts. Please try again later.`
            ),
            retryAfterSeconds: getErrorRetryAfterSeconds(error),
          });

          return;
        }

        setTokenValidationState({
          kind: "invalid",
          message: getLocalizedErrorMessage(error, _, {
            fallback: msg`Failed to validate onboarding link`,
            validation: msg`Invalid onboarding link. Please check your email and try again.`,
            authentication: msg`Invalid onboarding link. Please check your email and try again.`,
            authorization: msg`Invalid onboarding link. Please check your email and try again.`,
            notFound: msg`Invalid onboarding link. Please check your email and try again.`,
          }),
        });
      }
    };

    validateLink();
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

    if (!formData.date_of_birth) {
      newErrors.date_of_birth = _(msg`Date of birth is required`);
    } else if (!isValidIsoCalendarDate(formData.date_of_birth)) {
      // Rejects both malformed inputs ("13/05/1990") and impossible calendar
      // days the shape regex would otherwise let through ("1990-02-31").
      // Catching the latter client-side is important because the backend's
      // single-shot policy would burn the magic link over the typo.
      newErrors.date_of_birth = _(msg`Please enter a valid date of birth`);
    } else if (formData.date_of_birth >= formatLocalYmd(new Date())) {
      // Compare against the local calendar day. Using UTC ("today" via
      // toISOString) would reject valid past dates near midnight in
      // timezones ahead of UTC.
      newErrors.date_of_birth = _(msg`Date of birth must be in the past`);
    }

    if (!formData.password) {
      newErrors.password = _(msg`Password is required`);
    } else {
      const issue = getOnboardingPasswordIssue(formData.password);
      if (issue === "too_short") {
        newErrors.password = _(msg`Password must be at least 12 characters`);
      } else if (issue === "mixed_case") {
        newErrors.password = _(
          msg`Password must include both uppercase and lowercase letters`
        );
      } else if (issue === "number") {
        newErrors.password = _(msg`Password must include at least one number`);
      } else if (issue === "symbol") {
        newErrors.password = _(msg`Password must include at least one symbol`);
      }
    }

    if (formData.password !== formData.password_confirmation) {
      newErrors.password_confirmation = _(msg`Passwords do not match`);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Submit identity proof + password to the backend.
   *
   * Identity verification (DOB + name) is server-side. A 422 without `errors`
   * payload is the generic "we couldn't verify your identity" response — we render
   * the backend message verbatim instead of guessing which field is wrong.
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const data: OnboardingCompleteData = {
        token: token!,
        email: email!,
        first_name: formData.first_name,
        last_name: formData.last_name,
        date_of_birth: formData.date_of_birth,
        password: formData.password,
      };

      const response = await completeOnboarding(data);

      // Store the new authenticated session user data
      await login({
        id: String(response.data.user.id),
        email: response.data.user.email,
        name: response.data.user.name,
        emailVerified: response.data.user.email_verified === true,
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

      if (isOnboardingApiError(error)) {
        if (error.response.status === 422) {
          const backendErrors = getErrorValidationErrors(error);
          const formattedErrors = mapOnboardingFieldErrors(
            backendErrors,
            localizedCompromisedPasswordError
          );
          const hasFieldErrors = Object.keys(formattedErrors).some(
            (fieldName) => fieldName !== "general"
          );

          // 422 responses without a per-field `errors` payload are deliberately
          // generic on the backend: they could mean "invalid/expired token",
          // "email does not match", or "identity verification failed" (wrong DOB
          // or name too different). The backend always returns its OWN localized
          // `message` for these cases (Accept-Language honoured) so we surface
          // that verbatim — never trying to guess which field is wrong, which
          // would turn the UI into a field-level oracle.
          //
          // A failed identity proof also permanently revokes the magic link
          // (single-shot policy). The backend's verbatim message already steers
          // the user toward HR for a new invitation; we deliberately do NOT add
          // a "try again" affordance for this case.
          const backendMessage =
            typeof error.response.data?.message === "string" &&
            error.response.data.message.trim().length > 0
              ? error.response.data.message.trim()
              : null;

          setErrors({
            ...formattedErrors,
            general: hasFieldErrors
              ? _(msg`Please review the highlighted fields and try again.`)
              : (backendMessage ??
                _(
                  msg`We could not verify your identity with the details provided. For security reasons this onboarding link has been deactivated. Please contact HR for a new invitation.`
                )),
          });
        } else if (error.response.status === 429) {
          // Rate limit exceeded
          setErrors({
            general: buildRateLimitMessage(getErrorRetryAfterSeconds(error)),
          });
        } else {
          // Generic error
          setErrors({
            general: getLocalizedErrorMessage(error, _, {
              fallback: msg`Failed to complete onboarding. Please try again or contact support.`,
            }),
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

  if (
    tokenValidationState.kind === "invalid" ||
    tokenValidationState.kind === "rate_limited"
  ) {
    const isRateLimited = tokenValidationState.kind === "rate_limited";
    const retryHint = getRetryHint(tokenValidationState.retryAfterSeconds);

    return (
      <OnboardingCompleteFrame>
        <Alert
          className={
            isRateLimited
              ? "mt-8 border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
              : "mt-8 border-red-200 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100"
          }
        >
          <AlertTitle
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
          </AlertTitle>
          <AlertDescription
            className={
              isRateLimited
                ? "mt-2 text-amber-700 dark:text-amber-300"
                : "mt-2 text-red-700 dark:text-red-300"
            }
          >
            {tokenValidationState.message}
          </AlertDescription>
          {isRateLimited && retryHint && (
            <AlertDescription className="mt-2 text-amber-700 dark:text-amber-300">
              {retryHint}
            </AlertDescription>
          )}
          <div className="mt-4">
            {isRateLimited ? (
              <Button
                onClick={() => setValidationAttempt((attempt) => attempt + 1)}
              >
                <Trans>Try Again</Trans>
              </Button>
            ) : (
              <Button variant="destructive" onClick={() => navigate("/login")}>
                <Trans>Go to Login</Trans>
              </Button>
            )}
          </div>
        </Alert>
      </OnboardingCompleteFrame>
    );
  }

  if (tokenValidationState.kind === "validating") {
    return (
      <OnboardingCompleteFrame>
        <div className="mt-8 space-y-8">
          <div aria-hidden="true" className="space-y-2">
            <Skeleton className="h-8 w-64 max-w-full" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <FormSkeleton
            loadingLabel={_(msg`Validating onboarding link`)}
            fields={5}
          />
        </div>
      </OnboardingCompleteFrame>
    );
  }

  return (
    <OnboardingCompleteFrame>
      <div className="mt-8">
        <h2 className="text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
          <Trans>Welcome to SecPal!</Trans>
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          <Trans>Complete your account setup to get started</Trans>
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-8"
        data-onboarding-form="true"
      >
        {errors.general && (
          <Alert className="mb-6 border-red-200 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100">
            <AlertDescription className="text-red-800 dark:text-red-200">
              {errors.general}
            </AlertDescription>
          </Alert>
        )}

        <FieldGroup>
          {/* First Name - BewachV §16 requires all first names */}
          <Field>
            <FieldLabel htmlFor="onboarding-first-name">
              <Trans>First Names (all)</Trans> *
            </FieldLabel>
            <Input
              id="onboarding-first-name"
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={(e) =>
                updateIdentityField("first_name", e.target.value)
              }
              disabled={loading}
              autoFocus
              aria-invalid={errors.first_name ? true : undefined}
              aria-describedby={
                errors.first_name
                  ? "onboarding-first-name-description onboarding-first-name-error"
                  : "onboarding-first-name-description"
              }
            />
            <FieldDescription id="onboarding-first-name-description">
              <Trans>
                Enter all your first names as shown on your ID (e.g.,
                "Hans-Peter Friedrich")
              </Trans>
            </FieldDescription>
            {errors.first_name && (
              <FieldError id="onboarding-first-name-error">
                {errors.first_name}
              </FieldError>
            )}
          </Field>

          {/* Last Name */}
          <Field>
            <FieldLabel htmlFor="onboarding-last-name">
              <Trans>Last Name</Trans> *
            </FieldLabel>
            <Input
              id="onboarding-last-name"
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={(e) => updateIdentityField("last_name", e.target.value)}
              disabled={loading}
              aria-invalid={errors.last_name ? true : undefined}
              aria-describedby={
                errors.last_name ? "onboarding-last-name-error" : undefined
              }
            />
            {errors.last_name && (
              <FieldError id="onboarding-last-name-error">
                {errors.last_name}
              </FieldError>
            )}
          </Field>

          {/* Date of Birth — proves identity together with the name */}
          <Field>
            <FieldLabel htmlFor="onboarding-date-of-birth">
              <Trans>Date of Birth</Trans> *
            </FieldLabel>
            <Input
              id="onboarding-date-of-birth"
              type="date"
              name="date_of_birth"
              value={formData.date_of_birth}
              onChange={(e) =>
                updateIdentityField("date_of_birth", e.target.value)
              }
              disabled={loading}
              aria-invalid={errors.date_of_birth ? true : undefined}
              aria-describedby={
                errors.date_of_birth
                  ? "onboarding-date-of-birth-description onboarding-date-of-birth-error"
                  : "onboarding-date-of-birth-description"
              }
            />
            <FieldDescription id="onboarding-date-of-birth-description">
              <Trans>
                We compare this with the date of birth on file to verify your
                identity before activating your account.
              </Trans>
            </FieldDescription>
            {errors.date_of_birth && (
              <FieldError id="onboarding-date-of-birth-error">
                {errors.date_of_birth}
              </FieldError>
            )}
          </Field>

          {/* Password */}
          <Field>
            <FieldLabel htmlFor="onboarding-password">
              <Trans>Password</Trans> *
            </FieldLabel>
            <Input
              id="onboarding-password"
              type="password"
              name="password"
              aria-label={_(msg`Password`)}
              value={formData.password}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, password: e.target.value }))
              }
              disabled={loading}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={
                errors.password
                  ? "onboarding-password-error onboarding-password-description"
                  : "onboarding-password-description"
              }
            />
            {errors.password && (
              <FieldError id="onboarding-password-error">
                {errors.password}
              </FieldError>
            )}
            <FieldDescription id="onboarding-password-description">
              <Trans>
                Use at least 12 characters with uppercase and lowercase letters,
                a number, and a symbol. Passwords that appear in known data
                breaches cannot be used.
              </Trans>
            </FieldDescription>
          </Field>

          {/* Password Confirmation */}
          <Field>
            <FieldLabel htmlFor="onboarding-password-confirmation">
              <Trans>Confirm Password</Trans> *
            </FieldLabel>
            <Input
              id="onboarding-password-confirmation"
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
              aria-invalid={errors.password_confirmation ? true : undefined}
              aria-describedby={
                errors.password_confirmation
                  ? "onboarding-password-confirmation-error"
                  : undefined
              }
            />
            {errors.password_confirmation && (
              <FieldError id="onboarding-password-confirmation-error">
                {errors.password_confirmation}
              </FieldError>
            )}
          </Field>

          {/* Submit Button */}
          <div className="mt-8">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Trans>Completing Setup...</Trans>
              ) : (
                <Trans>Complete Account Setup</Trans>
              )}
            </Button>
          </div>
        </FieldGroup>
      </form>
    </OnboardingCompleteFrame>
  );
}
