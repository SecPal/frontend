// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useMemo, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { Code2, KeyRound, Scale } from "lucide-react";
import type { MfaChallenge, MfaVerificationMethod } from "@/types/api";
import { useAuth } from "../hooks/useAuth";
import { useLoginRateLimiter } from "../hooks/useLoginRateLimiter";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { getAuthTransport, AuthApiError } from "../services/authTransport";
import {
  startPasskeyAuthenticationChallenge,
  verifyMfaChallenge,
  verifyPasskeyAuthenticationChallenge,
} from "../services/authApi";
import { sanitizeAuthUser } from "../services/authState";
import { checkHealth, HealthStatus } from "../services/healthApi";
import {
  getPasskeyAssertion,
  isPasskeySupported,
} from "../services/passkeyBrowser";
import { formatApiDateTime } from "../lib/dateUtils";
import { Logo } from "../components/Logo";
import { activateLocale, locales, setLocalePreference } from "../i18n";
import {
  LoginButton,
  LoginCard,
  LoginCardHeader,
  LoginCardTitle,
  LoginDialog,
  LoginDialogActions,
  LoginDialogBody,
  LoginDialogDescription,
  LoginDialogTitle,
  LoginField,
  LoginFieldDescription,
  LoginFieldError,
  LoginFieldGroup,
  LoginFieldLabel,
  LoginFieldSeparator,
  LoginForm,
  LoginInput,
  LoginOtpInput,
  LoginRadioGroup,
  LoginRadioGroupItem,
  LoginSelect,
  LoginSelectContent,
  LoginSelectItem,
  LoginSelectTrigger,
  LoginSelectValue,
  LoginShell,
  LoginStatusMessage,
} from "./Auth/ui";

const HEALTH_CHECK_RETRY_DELAYS_MS = [0, 1500, 5000];
const TEMPORARY_LOGIN_UNAVAILABLE_MESSAGE =
  "Login is temporarily unavailable. Please try again later.";
const INVALID_CREDENTIALS_PATTERN =
  /^(Invalid credentials|The provided credentials are incorrect)\.?$/i;
const NATIVE_PASSKEY_CANCELLED_PATTERN = /^Passkey sign-in was cancelled\.?$/i;
const NATIVE_PASSKEY_INTERRUPTED_PATTERN =
  /^Passkey sign-in was interrupted\.?$/i;
const NATIVE_PASSKEY_TIMEOUT_PATTERN = /^Passkey sign-in timed out\.?$/i;
const NATIVE_PASSKEY_PROVIDER_UNAVAILABLE_PATTERN =
  /^No credential provider is available on this device\.?$/i;
const TOTP_CODE_LENGTH = 6;

type Translate = ReturnType<typeof useLingui>["_"];

function getPasskeySignInErrorMessage(
  error: unknown,
  translate: Translate
): string {
  if (error instanceof AuthApiError) {
    return error.message;
  }

  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return translate(
      msg`Passkey sign-in was cancelled or not permitted by the browser.`
    );
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return translate(msg`Passkey sign-in timed out. Please try again.`);
  }

  if (
    error instanceof Error &&
    NATIVE_PASSKEY_CANCELLED_PATTERN.test(error.message)
  ) {
    return translate(msg`Passkey sign-in was cancelled.`);
  }

  if (
    error instanceof Error &&
    NATIVE_PASSKEY_INTERRUPTED_PATTERN.test(error.message)
  ) {
    return translate(msg`Passkey sign-in was interrupted. Please try again.`);
  }

  if (
    error instanceof Error &&
    NATIVE_PASSKEY_TIMEOUT_PATTERN.test(error.message)
  ) {
    return translate(msg`Passkey sign-in timed out. Please try again.`);
  }

  if (
    error instanceof Error &&
    (/credential.manager/i.test(error.message) ||
      NATIVE_PASSKEY_PROVIDER_UNAVAILABLE_PATTERN.test(error.message))
  ) {
    return translate(
      msg`No credential provider is available on this device. Check that a passkey-capable app (e.g. Bitwarden) is installed and enabled as a credential provider in your device settings.`
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return translate(
    msg`An unexpected passkey sign-in error occurred. Please try again.`
  );
}

function getLocalizedLoginErrorMessage(
  message: string,
  translate: Translate
): string {
  if (INVALID_CREDENTIALS_PATTERN.test(message)) {
    return translate(msg`The provided credentials are incorrect.`);
  }

  return message;
}

function getLocalizedMfaErrorMessage(
  message: string,
  translate: Translate
): string {
  if (/^MFA verification failed\.?$/i.test(message)) {
    return translate(msg`MFA verification failed. Please check your code.`);
  }

  return message;
}

function formatDateTime(value: string): string {
  return formatApiDateTime(value, {
    formatOptions: {
      dateStyle: "medium",
      timeStyle: "short",
    },
  });
}

export function Login() {
  const navigate = useNavigate();
  const { _ } = useLingui();
  const { login } = useAuth();
  const authTransport = useMemo(() => getAuthTransport(), []);
  const supportsPasskeys = useMemo(
    () =>
      authTransport.kind === "native-bridge"
        ? authTransport.supportsPasskeyLogin()
        : isPasskeySupported(),
    [authTransport]
  );
  const {
    remainingAttempts,
    isLocked,
    remainingLockoutSeconds,
    canAttemptLogin,
    recordFailedAttempt,
    syncAuthoritativeLockout,
    resetAttempts,
  } = useLoginRateLimiter();
  const isOnline = useOnlineStatus();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingPasskey, setIsSubmittingPasskey] = useState(false);
  const [passkeyStep, setPasskeyStep] = useState<
    "challenge" | "native" | "browser" | "verifying" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingMfaChallenge, setPendingMfaChallenge] =
    useState<MfaChallenge | null>(null);
  const [mfaMethod, setMfaMethod] = useState<MfaVerificationMethod>("totp");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [isHealthCheckLoading, setIsHealthCheckLoading] = useState(true);
  const normalizedMfaCode = mfaCode.trim();
  const isIncompleteTotpCode =
    mfaMethod === "totp" && normalizedMfaCode.length !== TOTP_CODE_LENGTH;
  const isMfaSubmitDisabled =
    isVerifyingMfa || normalizedMfaCode.length === 0 || isIncompleteTotpCode;

  // Check backend health on component mount and when online status changes
  useEffect(() => {
    let isMounted = true;

    async function performHealthCheck() {
      // Don't perform health check when offline
      if (!isOnline) {
        if (isMounted) {
          setIsHealthCheckLoading(false);
        }
        return;
      }

      // Reset loading state and stale results before (re)trying
      if (isMounted) {
        setIsHealthCheckLoading(true);
        setHealthStatus(null);
      }

      try {
        for (const [
          attempt,
          retryDelay,
        ] of HEALTH_CHECK_RETRY_DELAYS_MS.entries()) {
          if (retryDelay > 0) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
          }

          if (!isMounted) {
            return;
          }

          try {
            const status = await checkHealth();

            if (isMounted) {
              setHealthStatus(status);
            }

            return;
          } catch {
            const isLastAttempt =
              attempt === HEALTH_CHECK_RETRY_DELAYS_MS.length - 1;

            if (isMounted && isLastAttempt) {
              setHealthStatus(null);
            }
          }
        }
      } finally {
        if (isMounted) {
          setIsHealthCheckLoading(false);
        }
      }
    }

    performHealthCheck();

    return () => {
      isMounted = false;
    };
  }, [isOnline]); // Re-run when online status changes

  // Only an explicit backend not_ready result should block sign-in.
  const isSystemNotReady = isOnline && healthStatus?.status === "not_ready";
  const isMfaChallengeActive = pendingMfaChallenge !== null;
  const areCredentialsDisabled =
    !isOnline || isSystemNotReady || isLocked || isMfaChallengeActive;
  const isLoginSubmitDisabled =
    !isOnline ||
    isSubmitting ||
    isSubmittingPasskey ||
    isSystemNotReady ||
    isHealthCheckLoading ||
    isLocked ||
    isMfaChallengeActive;
  const isPasskeySubmitDisabled =
    !isOnline ||
    isSubmitting ||
    isSubmittingPasskey ||
    isSystemNotReady ||
    isHealthCheckLoading ||
    isLocked ||
    isMfaChallengeActive;

  // Compute aria-describedby for inputs (combines error, lockout, and offline alerts)
  const ariaDescribedBy =
    [
      error && "login-error",
      isLocked && "lockout-warning",
      !isOnline && "offline-warning",
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Check rate limiting
    if (!canAttemptLogin()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await authTransport.login({ email, password });
      resetAttempts(); // Clear rate limit state on successful login
      if (response.status === "mfa_required") {
        setPendingMfaChallenge(response.challenge);
        setMfaMethod(response.challenge.primary_method);
        setMfaCode("");
        setMfaError(null);
        setPassword("");
        return;
      }

      await login(response.user);
      navigate("/");
    } catch (err) {
      console.error("Login error:", err);
      if (err instanceof AuthApiError) {
        if ((err.status ?? 0) >= 500) {
          setError(TEMPORARY_LOGIN_UNAVAILABLE_MESSAGE);
          return;
        }

        if (err.status === 429) {
          syncAuthoritativeLockout(err.retryAfterSeconds);
          setError(getLocalizedLoginErrorMessage(err.message, _));
          return;
        }

        recordFailedAttempt(); // Record failed attempt for rate limiting
        setError(getLocalizedLoginErrorMessage(err.message, _));
      } else if (err instanceof Error) {
        recordFailedAttempt();
        setError(getLocalizedLoginErrorMessage(err.message, _));
      } else {
        recordFailedAttempt();
        setError(
          _(
            msg`An unexpected error occurred. Please try again or contact support.`
          )
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseMfaDialog = () => {
    if (isVerifyingMfa) {
      return;
    }

    setPendingMfaChallenge(null);
    setMfaCode("");
    setMfaError(null);
  };

  const handleMfaMethodChange = (method: MfaVerificationMethod) => {
    setMfaMethod(method);
    setMfaError(null);
    if (method === "totp") {
      setMfaCode((currentCode) =>
        currentCode.replace(/\D/g, "").slice(0, TOTP_CODE_LENGTH)
      );
    }
  };

  const handlePasskeySignIn = async () => {
    setError(null);
    setIsSubmittingPasskey(true);
    setPasskeyStep("challenge");

    if (authTransport.kind === "native-bridge") {
      try {
        setPasskeyStep("native");

        const response = await authTransport.loginWithPasskey();

        resetAttempts();
        await login(response.user);
        navigate("/");
      } catch (err) {
        console.error("Passkey sign-in error:", err);
        setError(getPasskeySignInErrorMessage(err, _));
      } finally {
        setIsSubmittingPasskey(false);
        setPasskeyStep(null);
      }

      return;
    }

    try {
      const challengeResponse = await startPasskeyAuthenticationChallenge();
      console.info(
        "[SecPal] Passkey login: challenge created id=%s credentials=%d",
        challengeResponse.data.challenge_id,
        challengeResponse.data.public_key.allow_credentials?.length ?? 0
      );

      // Always use "optional" mediation for an explicit button click.
      // "conditional" is designed for passive autofill-based discovery and
      // would silently wait for an input-field interaction that never comes.
      setPasskeyStep("browser");
      const credential = await getPasskeyAssertion(
        challengeResponse.data.public_key,
        "optional"
      );
      console.info("[SecPal] Passkey login: browser assertion complete");

      setPasskeyStep("verifying");
      const response = await verifyPasskeyAuthenticationChallenge(
        challengeResponse.data.challenge_id,
        {
          credential,
        }
      );

      console.info(
        "[SecPal] Passkey login: verify succeeded mode=%s",
        response.authentication.mode
      );

      if (response.authentication.mode !== "session") {
        throw new Error(
          _(msg`The passkey sign-in completed with an unsupported login mode.`)
        );
      }

      const sanitizedUser = sanitizeAuthUser(response.user);

      if (!sanitizedUser) {
        throw new Error(
          _(msg`The passkey sign-in completed with an invalid user payload.`)
        );
      }

      resetAttempts();
      await login(sanitizedUser);
      console.info("[SecPal] Passkey login: complete, navigating to /");
      navigate("/");
    } catch (err) {
      console.error("Passkey sign-in error:", err);
      setError(getPasskeySignInErrorMessage(err, _));
    } finally {
      setIsSubmittingPasskey(false);
      setPasskeyStep(null);
    }
  };

  const handleVerifyMfa = async (e: FormEvent) => {
    e.preventDefault();

    if (!pendingMfaChallenge || isMfaSubmitDisabled) {
      return;
    }

    setMfaError(null);
    setIsVerifyingMfa(true);
    let shouldSurfaceLoginError = false;

    try {
      const response = await verifyMfaChallenge(pendingMfaChallenge.id, {
        method: mfaMethod,
        code: normalizedMfaCode,
      });

      if (response.authentication.mode !== "session") {
        throw new Error(
          _(msg`The MFA challenge completed with an unsupported login mode.`)
        );
      }

      const sanitizedUser = sanitizeAuthUser(response.user);

      if (!sanitizedUser) {
        throw new Error(
          _(msg`The MFA challenge completed with an invalid user payload.`)
        );
      }

      setPendingMfaChallenge(null);
      setMfaCode("");
      shouldSurfaceLoginError = true;
      await login(sanitizedUser);
      navigate("/");
    } catch (err) {
      console.error("MFA verification error:", err);

      let errorMessage: string;
      if (err instanceof AuthApiError) {
        errorMessage = getLocalizedMfaErrorMessage(err.message, _);
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else {
        errorMessage = _(
          msg`An unexpected MFA verification error occurred. Please try logging in again.`
        );
      }

      setMfaError(errorMessage);

      if (shouldSurfaceLoginError) {
        setError(errorMessage);
      }
    } finally {
      setIsVerifyingMfa(false);
    }
  };

  return (
    <LoginShell>
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <LoginLanguageSwitcher />
      </div>

      <LoginCard aria-labelledby="login-title">
        <LoginForm onSubmit={handleSubmit} aria-label={_(msg`Login form`)}>
          <LoginFieldGroup>
            <LoginCardHeader>
              <div className="flex size-12 items-center justify-center rounded-md">
                <Logo size="48" />
              </div>
              <LoginCardTitle id="login-title">
                <Trans id="login.title">Welcome to SecPal</Trans>
              </LoginCardTitle>
              <LoginFieldDescription>
                <Trans id="login.subtitle">
                  Sign in to your operations workspace.
                </Trans>
              </LoginFieldDescription>
            </LoginCardHeader>

            {!isOnline && (
              <LoginStatusMessage
                id="offline-warning"
                variant="error"
                title={
                  <Trans id="login.offlineWarning.title">
                    No internet connection
                  </Trans>
                }
              >
                <p>
                  <Trans id="login.offlineWarning.message">
                    Login requires an internet connection. Please check your
                    connection and try again.
                  </Trans>
                </p>
              </LoginStatusMessage>
            )}

            {isSystemNotReady && (
              <LoginStatusMessage
                id="health-warning"
                variant="warning"
                title={
                  <Trans id="login.healthWarning.title">System not ready</Trans>
                }
              >
                <p>
                  <Trans id="login.healthWarning.message">
                    The system is not fully configured. Please contact your
                    administrator.
                  </Trans>
                </p>
              </LoginStatusMessage>
            )}

            {isLocked && (
              <LoginStatusMessage
                id="lockout-warning"
                variant="error"
                live="assertive"
                title={
                  <Trans id="login.rateLimitLocked.title">
                    Too many failed attempts
                  </Trans>
                }
              >
                <p>
                  <Trans id="login.rateLimitLocked.message">
                    Please wait {remainingLockoutSeconds} seconds before trying
                    again.
                  </Trans>
                </p>
              </LoginStatusMessage>
            )}

            {error && (
              <LoginStatusMessage
                id="login-error"
                variant="error"
                live="assertive"
              >
                <p>{error}</p>
                {!isLocked &&
                  remainingAttempts > 0 &&
                  remainingAttempts <= 3 && (
                    <p className="mt-2 text-amber-700 dark:text-amber-400">
                      <Trans id="login.remainingAttempts">
                        {remainingAttempts} attempt(s) remaining before
                        temporary lockout.
                      </Trans>
                    </p>
                  )}
              </LoginStatusMessage>
            )}

            <LoginField>
              <LoginFieldLabel htmlFor="email">
                <Trans id="login.email">Email address</Trans>
              </LoginFieldLabel>
              <LoginInput
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@secpal.app"
                aria-invalid={error ? true : undefined}
                aria-describedby={ariaDescribedBy}
                disabled={areCredentialsDisabled}
              />
            </LoginField>

            <LoginField>
              <LoginFieldLabel htmlFor="password">
                <Trans id="login.password">Password</Trans>
              </LoginFieldLabel>
              <LoginInput
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                aria-invalid={error ? true : undefined}
                aria-describedby={ariaDescribedBy}
                disabled={areCredentialsDisabled}
              />
            </LoginField>

            <LoginField>
              <LoginButton
                type="submit"
                disabled={isLoginSubmitDisabled}
                className="w-full"
                aria-busy={isSubmitting}
                aria-disabled={
                  !isOnline ||
                  isSubmittingPasskey ||
                  isSystemNotReady ||
                  isHealthCheckLoading ||
                  isLocked ||
                  isMfaChallengeActive
                }
              >
                {isHealthCheckLoading ? (
                  <Trans id="login.checkingSystem">Checking system...</Trans>
                ) : isLocked ? (
                  <Trans id="login.lockedButton">
                    Locked ({remainingLockoutSeconds}s)
                  </Trans>
                ) : isSubmitting ? (
                  <Trans id="login.submitting">Logging in...</Trans>
                ) : (
                  <Trans id="login.submit">Log in</Trans>
                )}
              </LoginButton>
            </LoginField>

            {supportsPasskeys ? (
              <>
                <LoginFieldSeparator>
                  <Trans id="login.separator">Or</Trans>
                </LoginFieldSeparator>
                <LoginField>
                  <LoginButton
                    type="button"
                    variant="outline"
                    onClick={() => void handlePasskeySignIn()}
                    disabled={isPasskeySubmitDisabled}
                    className="w-full"
                    aria-busy={isSubmittingPasskey}
                  >
                    {isSubmittingPasskey ? (
                      passkeyStep === "browser" ? (
                        <>
                          <KeyRound className="h-4 w-4" aria-hidden="true" />
                          <Trans>Check your browser…</Trans>
                        </>
                      ) : passkeyStep === "native" ? (
                        <>
                          <KeyRound className="h-4 w-4" aria-hidden="true" />
                          <Trans>Check your device…</Trans>
                        </>
                      ) : passkeyStep === "verifying" ? (
                        <>
                          <KeyRound className="h-4 w-4" aria-hidden="true" />
                          <Trans>Verifying passkey…</Trans>
                        </>
                      ) : (
                        <>
                          <KeyRound className="h-4 w-4" aria-hidden="true" />
                          <Trans>Signing in with passkey...</Trans>
                        </>
                      )
                    ) : (
                      <>
                        <KeyRound className="h-4 w-4" aria-hidden="true" />
                        <Trans>Sign in with passkey</Trans>
                      </>
                    )}
                  </LoginButton>
                </LoginField>
              </>
            ) : null}
          </LoginFieldGroup>
        </LoginForm>
      </LoginCard>

      <LoginLegalFooter />

      <LoginDialog
        open={pendingMfaChallenge !== null}
        onClose={handleCloseMfaDialog}
      >
        <LoginDialogTitle>
          <Trans id="login.mfa.title">Second factor required</Trans>
        </LoginDialogTitle>
        <LoginDialogDescription>
          <Trans id="login.mfa.description">
            Your password was accepted. Complete MFA to finish signing in.
          </Trans>
        </LoginDialogDescription>

        <LoginDialogBody>
          {pendingMfaChallenge && (
            <LoginForm onSubmit={handleVerifyMfa}>
              <LoginStatusMessage variant="neutral" live="off">
                <p>
                  <Trans id="login.mfa.expiry">
                    This verification step expires at{" "}
                    {formatDateTime(pendingMfaChallenge.expires_at)}.
                  </Trans>
                </p>
              </LoginStatusMessage>

              <div className="space-y-3">
                <span
                  id="mfa-method-label"
                  className="text-sm font-medium text-zinc-950 dark:text-white"
                >
                  <Trans id="login.mfa.method">Verification method</Trans>
                </span>

                <LoginRadioGroup
                  value={mfaMethod}
                  onValueChange={(value) =>
                    handleMfaMethodChange(value as MfaVerificationMethod)
                  }
                  disabled={isVerifyingMfa}
                  aria-labelledby="mfa-method-label"
                >
                  {pendingMfaChallenge.available_methods.map((method) => (
                    <label
                      key={method}
                      className="flex cursor-default items-start gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-white"
                    >
                      <LoginRadioGroupItem
                        value={method}
                        className="mt-1"
                        aria-label={
                          method === "recovery_code"
                            ? _(msg`Recovery code`)
                            : _(msg`Authenticator code`)
                        }
                      />
                      <span>
                        {method === "recovery_code" ? (
                          <Trans id="login.mfa.method.recovery_code">
                            Recovery code
                          </Trans>
                        ) : (
                          <Trans id="login.mfa.method.totp">
                            Authenticator code
                          </Trans>
                        )}
                        {method === pendingMfaChallenge.primary_method ? (
                          <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <Trans id="login.mfa.preferred">recommended</Trans>
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </LoginRadioGroup>
              </div>

              <LoginField>
                <LoginFieldLabel htmlFor="mfa-code">
                  {mfaMethod === "recovery_code" ? (
                    <Trans id="login.mfa.recoveryCode">Recovery code</Trans>
                  ) : (
                    <Trans id="login.mfa.authenticatorCode">
                      Authenticator code
                    </Trans>
                  )}
                </LoginFieldLabel>
                <LoginFieldDescription id="mfa-code-help">
                  {mfaMethod === "recovery_code" ? (
                    <Trans id="login.mfa.recoveryHelp">
                      Enter one unused recovery code exactly as stored.
                    </Trans>
                  ) : (
                    <Trans id="login.mfa.totpHelp">
                      Enter the current 6-digit code from your authenticator
                      app.
                    </Trans>
                  )}
                </LoginFieldDescription>
                {mfaMethod === "recovery_code" ? (
                  <LoginInput
                    id="mfa-code"
                    name="mfa-code"
                    type="text"
                    autoComplete="one-time-code"
                    required
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value)}
                    placeholder="B6F42Q8P"
                    disabled={isVerifyingMfa}
                    aria-invalid={mfaError ? true : undefined}
                    aria-describedby={
                      mfaError
                        ? "mfa-code-help mfa-code-error"
                        : "mfa-code-help"
                    }
                  />
                ) : (
                  <LoginOtpInput
                    idPrefix="mfa-code"
                    value={mfaCode}
                    onChange={setMfaCode}
                    length={TOTP_CODE_LENGTH}
                    disabled={isVerifyingMfa}
                    aria-label={_(msg`Authenticator code`)}
                    aria-invalid={mfaError ? true : undefined}
                    aria-describedby={
                      mfaError
                        ? "mfa-code-help mfa-code-error"
                        : "mfa-code-help"
                    }
                  />
                )}
                {mfaError ? (
                  <LoginFieldError id="mfa-code-error">
                    {mfaError}
                  </LoginFieldError>
                ) : null}
              </LoginField>

              <LoginDialogActions>
                <LoginButton
                  type="button"
                  variant="outline"
                  onClick={handleCloseMfaDialog}
                  disabled={isVerifyingMfa}
                >
                  <Trans id="login.mfa.cancel">Cancel</Trans>
                </LoginButton>
                <LoginButton
                  type="submit"
                  disabled={isMfaSubmitDisabled}
                  aria-busy={isVerifyingMfa}
                >
                  {isVerifyingMfa ? (
                    <Trans id="login.mfa.verifying">Verifying...</Trans>
                  ) : (
                    <Trans id="login.mfa.submit">Verify and continue</Trans>
                  )}
                </LoginButton>
              </LoginDialogActions>
            </LoginForm>
          )}
        </LoginDialogBody>
      </LoginDialog>
    </LoginShell>
  );
}

function LoginLanguageSwitcher() {
  const { _, i18n } = useLingui();
  const [error, setError] = useState<string | null>(null);

  const handleValueChange = async (locale: string) => {
    setError(null);

    try {
      await activateLocale(locale);
      setLocalePreference(locale);
    } catch {
      setError(_(msg`Failed to change language. Please try again.`));
    }
  };

  return (
    <div>
      <LoginSelect value={i18n.locale} onValueChange={handleValueChange}>
        <LoginSelectTrigger
          aria-label={_(msg`Select language`)}
          className="w-auto min-w-[7rem]"
        >
          <LoginSelectValue />
        </LoginSelectTrigger>
        <LoginSelectContent>
          {Object.entries(locales).map(([code, name]) => (
            <LoginSelectItem key={code} value={code}>
              {name}
            </LoginSelectItem>
          ))}
        </LoginSelectContent>
      </LoginSelect>
      {error ? (
        <LoginFieldError role="alert" aria-live="assertive" className="mt-2">
          {error}
        </LoginFieldError>
      ) : null}
    </div>
  );
}

function LoginLegalFooter() {
  return (
    <footer className="w-full max-w-sm text-center text-[11px]">
      <div className="flex flex-col items-center gap-2 text-zinc-500 dark:text-zinc-400">
        <a
          href="https://secpal.app"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
        >
          <Trans>Powered by SecPal – A guard's best friend</Trans>
        </a>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          <a
            href="https://www.gnu.org/licenses/agpl-3.0.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-zinc-950 dark:hover:text-white"
          >
            <Scale className="h-4 w-4" aria-hidden="true" />
            <Trans>AGPL v3+</Trans>
          </a>
          <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">
            |
          </span>
          <a
            href="https://github.com/SecPal"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-zinc-950 dark:hover:text-white"
          >
            <Code2 className="h-4 w-4" aria-hidden="true" />
            <Trans>Source Code</Trans>
          </a>
        </div>
      </div>
    </footer>
  );
}
