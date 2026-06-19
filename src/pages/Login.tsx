// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  lazy,
  Suspense,
  useState,
  useEffect,
  useMemo,
  type FormEvent,
} from "react";
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
import { sanitizeAuthUser } from "../services/authState";
import { Logo } from "../components/Logo";
import { activateLocale, locales, setLocalePreference } from "../i18n";
import {
  LoginButton,
  LoginCard,
  LoginCardHeader,
  LoginCardTitle,
  LoginField,
  LoginFieldError,
  LoginFieldGroup,
  LoginFieldLabel,
  LoginFieldSeparator,
  LoginForm,
  LoginInput,
  LoginShell,
  LoginSpinner,
  LoginStatusMessage,
} from "./Auth/ui-lite";

const LoginMfaDialog = lazy(() => import("./LoginMfaDialog"));

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
// Backend issues 8-character alphanumeric recovery codes.
// Source: SecPal/api config/two-factor.php `recovery.length = 8`.
const RECOVERY_CODE_LENGTH = 8;

type Translate = ReturnType<typeof useLingui>["_"];
type HealthStatus = import("../services/healthApi").HealthStatus;

async function loadAuthApiModule() {
  return await import("../services/authApi");
}

async function loadHealthApiModule() {
  return await import("../services/healthApi");
}

async function loadPasskeyBrowserModule() {
  return await import("../services/passkeyBrowser");
}

function isBrowserPasskeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.credentials?.get === "function"
  );
}

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
  if (
    /^MFA verification failed\.?$/i.test(message) ||
    /^The provided multi-factor authentication code is invalid\.?$/i.test(
      message
    )
  ) {
    return translate(msg`MFA verification failed. Please check your code.`);
  }

  return message;
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
        : isBrowserPasskeySupported(),
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
  // Tracks whether `error` is specifically about the credential pair (wrong
  // email/password, malformed input). Only that subset of errors should mark
  // the email/password inputs as `aria-invalid`. Server outages, rate-limit
  // lockouts, passkey failures, and expired MFA challenges set `error` too
  // but say nothing about the values currently typed — flagging the fields
  // invalid in those cases misleads assistive technology users.
  const [hasCredentialError, setHasCredentialError] = useState(false);
  const [pendingMfaChallenge, setPendingMfaChallenge] =
    useState<MfaChallenge | null>(null);
  const [mfaMethod, setMfaMethod] = useState<MfaVerificationMethod>("totp");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const [isCompletingLogin, setIsCompletingLogin] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const normalizedMfaCode = mfaCode.trim();
  const isIncompleteTotpCode =
    mfaMethod === "totp" && normalizedMfaCode.length !== TOTP_CODE_LENGTH;
  const isIncompleteRecoveryCode =
    mfaMethod === "recovery_code" &&
    normalizedMfaCode.length !== RECOVERY_CODE_LENGTH;
  const isMfaSubmitDisabled =
    isVerifyingMfa ||
    normalizedMfaCode.length === 0 ||
    isIncompleteTotpCode ||
    isIncompleteRecoveryCode;
  const canSwitchMfaMethod = pendingMfaChallenge
    ? pendingMfaChallenge.available_methods.length > 1
    : false;
  const otherMfaMethod: MfaVerificationMethod =
    mfaMethod === "totp" ? "recovery_code" : "totp";
  const isOtherMethodAvailable = pendingMfaChallenge
    ? pendingMfaChallenge.available_methods.includes(otherMfaMethod)
    : false;

  // Check backend health on component mount and when online status changes
  useEffect(() => {
    let isMounted = true;

    async function performHealthCheck() {
      // Don't perform health check when offline
      if (!isOnline) {
        return;
      }

      // Reset loading state and stale results before (re)trying
      if (isMounted) {
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
            const { checkHealth } = await loadHealthApiModule();
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
        // no-op: the health check no longer gates login interactivity
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
    !isOnline ||
    isSystemNotReady ||
    isLocked ||
    isMfaChallengeActive ||
    isCompletingLogin;
  const isLoginSubmitDisabled =
    !isOnline ||
    isSubmitting ||
    isSubmittingPasskey ||
    isSystemNotReady ||
    isLocked ||
    isMfaChallengeActive ||
    isCompletingLogin;
  const isPasskeySubmitDisabled =
    !isOnline ||
    isSubmitting ||
    isSubmittingPasskey ||
    isSystemNotReady ||
    isLocked ||
    isMfaChallengeActive ||
    isCompletingLogin;

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
    setHasCredentialError(false);

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
          // Server outage; the typed values may be perfectly fine.
          setError(TEMPORARY_LOGIN_UNAVAILABLE_MESSAGE);
          return;
        }

        if (err.status === 429) {
          // Rate-limit lockout; the values are not validated at all here.
          syncAuthoritativeLockout(err.retryAfterSeconds);
          setError(getLocalizedLoginErrorMessage(err.message, _));
          return;
        }

        // Reaching here means the backend rejected the credential pair
        // (401/403/422). Flag the credential fields invalid for AT.
        recordFailedAttempt();
        setError(getLocalizedLoginErrorMessage(err.message, _));
        setHasCredentialError(true);
      } else if (err instanceof Error) {
        recordFailedAttempt();
        setError(getLocalizedLoginErrorMessage(err.message, _));
        setHasCredentialError(true);
      } else {
        recordFailedAttempt();
        setError(
          _(
            msg`An unexpected error occurred. Please try again or contact support.`
          )
        );
        setHasCredentialError(true);
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
    // Reset the code on every method switch: the previous draft is a
    // different alphabet/length and almost never carries over meaningfully
    // (a 6-digit TOTP draft is never a valid recovery code and vice-versa).
    setMfaCode("");
  };

  const handlePasskeySignIn = async () => {
    setError(null);
    // Passkey failures never reflect on the typed email/password values.
    setHasCredentialError(false);
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
      const {
        startPasskeyAuthenticationChallenge,
        verifyPasskeyAuthenticationChallenge,
      } = await loadAuthApiModule();
      const { getPasskeyAssertion } = await loadPasskeyBrowserModule();
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
      const { verifyMfaChallenge } = await loadAuthApiModule();
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

      setIsCompletingLogin(true);
      setPendingMfaChallenge(null);
      setMfaCode("");
      shouldSurfaceLoginError = true;
      await login(sanitizedUser);
      navigate("/");
    } catch (err) {
      console.error("MFA verification error:", err);

      // Backend invalidates the `challenge_id` after a failed verification
      // (one-shot pattern / exhausted retry budget). A subsequent submit on
      // the same id then returns 404 with a generic body like
      // "Ressource nicht gefunden.", which is useless and confusing for
      // the user. Detect the case at the HTTP layer, close the MFA dialog,
      // clear MFA state and surface a clear, actionable top-level error on
      // the password form so the user can re-submit credentials and get a
      // fresh challenge.
      if (err instanceof AuthApiError && err.status === 404) {
        const expiredMessage = _(
          msg`Your verification session expired. Please log in again.`
        );
        setPendingMfaChallenge(null);
        setMfaCode("");
        setMfaError(null);
        setError(expiredMessage);
        // The credential pair was already accepted; expiry of the MFA
        // challenge is unrelated to what's typed in the email/password
        // fields, so do not mark them invalid for assistive technology.
        setHasCredentialError(false);
        return;
      }

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

      // When `shouldSurfaceLoginError` is true the success branch already
      // closed the MFA dialog (`setPendingMfaChallenge(null)`), so the
      // dialog-scoped `mfaError` would never render. Surface the message on
      // the main login form instead. When false the dialog is still open and
      // `mfaError` is the right channel.
      if (shouldSurfaceLoginError) {
        setIsCompletingLogin(false);
        setError(errorMessage);
        // Credential pair was already accepted; failure is post-credential.
        setHasCredentialError(false);
      } else {
        setMfaError(errorMessage);
      }
    } finally {
      setIsVerifyingMfa(false);
    }
  };

  return (
    <LoginShell>
      {!isCompletingLogin && (
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <LoginLanguageSwitcher />
        </div>
      )}

      {/*
        Centered card region. `flex-1` lets it grow to fill the space between
        the shell's top edge and the natural-flow footer; `items-center
        justify-center` centers the card/empty within that grown region.
        Together with a non-absolute footer this guarantees the card and
        footer never overlap on short landscape viewports.
      */}
      <div className="flex w-full flex-1 items-center justify-center">
        <LoginCard
          aria-labelledby="login-title"
          aria-busy={isCompletingLogin || undefined}
          className="relative"
        >
          <LoginForm
            onSubmit={handleSubmit}
            aria-label={_(msg`Login form`)}
            className={isCompletingLogin ? "opacity-40" : undefined}
          >
            <LoginFieldGroup>
              <LoginCardHeader>
                <div className="flex size-12 items-center justify-center rounded-md">
                  <Logo size="48" />
                </div>
                <LoginCardTitle id="login-title">
                  <Trans id="login.title">Welcome to SecPal</Trans>
                </LoginCardTitle>
              </LoginCardHeader>

              {!isOnline && (
                <LoginStatusMessage
                  id="offline-warning"
                  variant="error"
                  live="assertive"
                  heading={
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
                  live="assertive"
                  heading={
                    <Trans id="login.healthWarning.title">
                      System not ready
                    </Trans>
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
                  heading={
                    <Trans id="login.rateLimitLocked.title">
                      Too many failed attempts
                    </Trans>
                  }
                >
                  <p>
                    <Trans id="login.rateLimitLocked.message">
                      Please wait {remainingLockoutSeconds} seconds before
                      trying again.
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
                  onChange={(e) => {
                    setEmail(e.target.value);
                    // User is editing; drop the credential-invalid flag so the
                    // field is no longer announced as invalid mid-correction.
                    if (hasCredentialError) setHasCredentialError(false);
                  }}
                  placeholder="you@secpal.app"
                  aria-invalid={hasCredentialError ? true : undefined}
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
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (hasCredentialError) setHasCredentialError(false);
                  }}
                  placeholder="••••••••"
                  aria-invalid={hasCredentialError ? true : undefined}
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
                    isLocked ||
                    isMfaChallengeActive
                  }
                >
                  {isLocked ? (
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
                    <Trans id="login.separator">or</Trans>
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
          {isCompletingLogin ? (
            <div
              data-testid="login-completing"
              className="absolute inset-0 flex items-center justify-center rounded-md bg-white/80 p-6 text-center backdrop-blur-sm dark:bg-zinc-950/80"
            >
              <div className="flex max-w-xs flex-col items-center gap-3">
                {/* role="status" on LoginSpinner is the scoped live region for AT
                  announcements. aria-live must not be placed on the wider
                  container, which also holds static heading text. */}
                <LoginSpinner aria-label={_(msg`Loading`)} />
                <p className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
                  <Trans id="login.completing.title">Completing sign-in</Trans>
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  <Trans id="login.completing.description">Please wait…</Trans>
                </p>
              </div>
            </div>
          ) : null}
        </LoginCard>
      </div>

      <LoginLegalFooter />

      {pendingMfaChallenge ? (
        <Suspense fallback={null}>
          <LoginMfaDialog
            challenge={pendingMfaChallenge}
            mfaCode={mfaCode}
            mfaError={mfaError}
            mfaMethod={mfaMethod}
            isMfaSubmitDisabled={isMfaSubmitDisabled}
            isOtherMethodAvailable={isOtherMethodAvailable}
            isVerifyingMfa={isVerifyingMfa}
            canSwitchMfaMethod={canSwitchMfaMethod}
            otherMfaMethod={otherMfaMethod}
            onChangeCode={setMfaCode}
            onClose={handleCloseMfaDialog}
            onMethodChange={handleMfaMethodChange}
            onSubmit={handleVerifyMfa}
          />
        </Suspense>
      ) : null}
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
      <label className="sr-only" htmlFor="login-language-select">
        {_(msg`Select language`)}
      </label>
      <select
        id="login-language-select"
        value={i18n.locale}
        onChange={(event) => {
          void handleValueChange(event.target.value);
        }}
        aria-label={_(msg`Select language`)}
        className="h-10 min-w-[7rem] rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-xs outline-none transition focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus-visible:border-blue-500 dark:focus-visible:ring-blue-500/20"
      >
        {Object.entries(locales).map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
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
    // Natural-flow footer: sits at the bottom of the LoginShell flex column,
    // pushed there by the centered-card wrapper above (`flex-1`). No absolute
    // positioning so it cannot overlap the credential card on short landscape
    // viewports (≈320px tall) where the card itself fills most of the height.
    <footer className="mt-4 w-full max-w-sm text-center text-[11px]">
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
