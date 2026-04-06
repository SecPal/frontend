// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useMemo, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Trans } from "@lingui/macro";
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
import { AuthLayout } from "../components/auth-layout";
import { Footer } from "../components/Footer";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { Logo } from "../components/Logo";
import { Button } from "../components/button";
import {
  Description,
  ErrorMessage,
  Field,
  Label,
} from "../components/fieldset";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "../components/dialog";
import { Input } from "../components/input";

const HEALTH_CHECK_RETRY_DELAYS_MS = [0, 1500, 5000];
const TEMPORARY_LOGIN_UNAVAILABLE_MESSAGE =
  "Login is temporarily unavailable. Please try again later.";

function formatDateTime(value: string): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const authTransport = useMemo(() => getAuthTransport(), []);
  const supportsPasskeys = useMemo(() => isPasskeySupported(), []);
  const {
    remainingAttempts,
    isLocked,
    remainingLockoutSeconds,
    canAttemptLogin,
    recordFailedAttempt,
    resetAttempts,
  } = useLoginRateLimiter();
  const isOnline = useOnlineStatus();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingPasskey, setIsSubmittingPasskey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingMfaChallenge, setPendingMfaChallenge] =
    useState<MfaChallenge | null>(null);
  const [mfaMethod, setMfaMethod] = useState<MfaVerificationMethod>("totp");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [isHealthCheckLoading, setIsHealthCheckLoading] = useState(true);
  const [healthCheckError, setHealthCheckError] = useState(false);

  // Check backend health on component mount and when online status changes
  useEffect(() => {
    let isMounted = true;

    async function performHealthCheck() {
      // Don't perform health check when offline
      if (!isOnline) {
        if (isMounted) {
          setIsHealthCheckLoading(false);
          setHealthCheckError(false);
        }
        return;
      }

      // Reset loading state and stale results before (re)trying
      if (isMounted) {
        setIsHealthCheckLoading(true);
        setHealthStatus(null);
        setHealthCheckError(false);
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
              setHealthCheckError(false);
            }

            return;
          } catch {
            const isLastAttempt =
              attempt === HEALTH_CHECK_RETRY_DELAYS_MS.length - 1;

            if (isMounted && isLastAttempt) {
              setHealthStatus(null);
              setHealthCheckError(true);
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

  // Determine if system is not ready (health check failed or backend reported not_ready)
  // Only check health status when online; offline is handled separately
  const isSystemNotReady =
    isOnline && (healthCheckError || healthStatus?.status === "not_ready");

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

      login(response.user);
      navigate("/");
    } catch (err) {
      console.error("Login error:", err);
      if (err instanceof AuthApiError) {
        if ((err.status ?? 0) >= 500) {
          setError(TEMPORARY_LOGIN_UNAVAILABLE_MESSAGE);
          return;
        }

        recordFailedAttempt(); // Record failed attempt for rate limiting
        setError(err.message);
      } else if (err instanceof Error) {
        recordFailedAttempt();
        setError(err.message);
      } else {
        recordFailedAttempt();
        setError(
          "An unexpected error occurred. Please try again or contact support."
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

  const handlePasskeySignIn = async () => {
    setError(null);
    setIsSubmittingPasskey(true);

    try {
      const challengeResponse = await startPasskeyAuthenticationChallenge();
      const credential = await getPasskeyAssertion(
        challengeResponse.data.public_key,
        challengeResponse.data.mediation
      );
      const response = await verifyPasskeyAuthenticationChallenge(
        challengeResponse.data.challenge_id,
        {
          credential,
        }
      );

      if (response.authentication.mode !== "session") {
        throw new Error(
          "The passkey sign-in completed with an unsupported login mode."
        );
      }

      const sanitizedUser = sanitizeAuthUser(response.user);

      if (!sanitizedUser) {
        throw new Error(
          "The passkey sign-in completed with an invalid user payload."
        );
      }

      resetAttempts();
      login(sanitizedUser);
      navigate("/");
    } catch (err) {
      console.error("Passkey sign-in error:", err);

      if (err instanceof AuthApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "An unexpected passkey sign-in error occurred. Please try again."
        );
      }
    } finally {
      setIsSubmittingPasskey(false);
    }
  };

  const handleVerifyMfa = async (e: FormEvent) => {
    e.preventDefault();

    if (!pendingMfaChallenge) {
      return;
    }

    setMfaError(null);
    setIsVerifyingMfa(true);

    try {
      const response = await verifyMfaChallenge(pendingMfaChallenge.id, {
        method: mfaMethod,
        code: mfaCode.trim(),
      });

      if (response.authentication.mode !== "session") {
        throw new Error(
          "The MFA challenge completed with an unsupported login mode."
        );
      }

      const sanitizedUser = sanitizeAuthUser(response.user);

      if (!sanitizedUser) {
        throw new Error(
          "The MFA challenge completed with an invalid user payload."
        );
      }

      setPendingMfaChallenge(null);
      setMfaCode("");
      login(sanitizedUser);
      navigate("/");
    } catch (err) {
      console.error("MFA verification error:", err);

      if (err instanceof AuthApiError) {
        setMfaError(err.message);
      } else if (err instanceof Error) {
        setMfaError(err.message);
      } else {
        setMfaError(
          "An unexpected MFA verification error occurred. Please try logging in again."
        );
      }
    } finally {
      setIsVerifyingMfa(false);
    }
  };

  return (
    <AuthLayout>
      <div className="flex-1 lg:hidden" />
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo size="48" />
          <h1 className="text-3xl font-bold">SecPal</h1>
        </div>
        <LanguageSwitcher />
      </div>

      <h2 className="mt-8 text-2xl font-semibold">
        <Trans id="login.title">Log in</Trans>
      </h2>

      <form
        onSubmit={handleSubmit}
        className="mt-10 space-y-8"
        aria-label="Login form"
      >
        {/* Offline Warning - shown when user has no internet connection */}
        {!isOnline && (
          <div
            id="offline-warning"
            role="alert"
            aria-live="polite"
            className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl" aria-hidden="true">
                🌐
              </span>
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">
                  <Trans id="login.offlineWarning.title">
                    No internet connection
                  </Trans>
                </p>
                <p className="mt-1 text-sm text-red-800 dark:text-red-200">
                  <Trans id="login.offlineWarning.message">
                    Login requires an internet connection. Please check your
                    connection and try again.
                  </Trans>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Health Check Warning - shown when backend is not ready */}
        {isSystemNotReady && (
          <div
            id="health-warning"
            role="alert"
            aria-live="polite"
            className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl" aria-hidden="true">
                ⚠️
              </span>
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  <Trans id="login.healthWarning.title">System not ready</Trans>
                </p>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  <Trans id="login.healthWarning.message">
                    The system is not fully configured. Please contact your
                    administrator.
                  </Trans>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Rate Limit Lockout Warning */}
        {isLocked && (
          <div
            id="lockout-warning"
            role="alert"
            aria-live="assertive"
            className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl" aria-hidden="true">
                🔒
              </span>
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">
                  <Trans id="login.rateLimitLocked.title">
                    Too many failed attempts
                  </Trans>
                </p>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  <Trans id="login.rateLimitLocked.message">
                    Please wait {remainingLockoutSeconds} seconds before trying
                    again.
                  </Trans>
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div
            id="login-error"
            role="alert"
            aria-live="assertive"
            className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20"
          >
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            {/* Show remaining attempts warning when running low */}
            {!isLocked && remainingAttempts > 0 && remainingAttempts <= 3 && (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                <Trans id="login.remainingAttempts">
                  {remainingAttempts} attempt(s) remaining before temporary
                  lockout.
                </Trans>
              </p>
            )}
          </div>
        )}

        <Field>
          <Label htmlFor="email">
            <Trans id="login.email">Email address</Trans>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@secpal.app"
            aria-describedby={ariaDescribedBy}
            disabled={
              !isOnline ||
              isSystemNotReady ||
              isLocked ||
              pendingMfaChallenge !== null
            }
          />
        </Field>

        <Field>
          <Label htmlFor="password">
            <Trans id="login.password">Password</Trans>
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            aria-describedby={ariaDescribedBy}
            disabled={
              !isOnline ||
              isSystemNotReady ||
              isLocked ||
              pendingMfaChallenge !== null
            }
          />
        </Field>

        <Button
          type="submit"
          disabled={
            !isOnline ||
            isSubmitting ||
            isSubmittingPasskey ||
            isSystemNotReady ||
            isHealthCheckLoading ||
            isLocked ||
            pendingMfaChallenge !== null
          }
          className="w-full"
          aria-busy={isSubmitting}
          aria-disabled={
            !isOnline ||
            isSubmittingPasskey ||
            isSystemNotReady ||
            isHealthCheckLoading ||
            isLocked ||
            pendingMfaChallenge !== null
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
        </Button>

        {supportsPasskeys ? (
          <Button
            type="button"
            outline
            onClick={() => void handlePasskeySignIn()}
            disabled={
              !isOnline ||
              isSubmitting ||
              isSubmittingPasskey ||
              isSystemNotReady ||
              isHealthCheckLoading ||
              isLocked ||
              pendingMfaChallenge !== null
            }
            className="w-full"
            aria-busy={isSubmittingPasskey}
          >
            {isSubmittingPasskey ? (
              <Trans>Signing in with passkey...</Trans>
            ) : (
              <Trans>Sign in with passkey</Trans>
            )}
          </Button>
        ) : null}
      </form>

      <Dialog
        open={pendingMfaChallenge !== null}
        onClose={handleCloseMfaDialog}
      >
        <DialogTitle>
          <Trans id="login.mfa.title">Second factor required</Trans>
        </DialogTitle>
        <DialogDescription>
          <Trans id="login.mfa.description">
            Your password was accepted. Complete MFA to finish signing in.
          </Trans>
        </DialogDescription>

        <DialogBody>
          {pendingMfaChallenge && (
            <form className="space-y-6" onSubmit={handleVerifyMfa}>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  <Trans id="login.mfa.expiry">
                    This verification step expires at{" "}
                    {formatDateTime(pendingMfaChallenge.expires_at)}.
                  </Trans>
                </p>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-zinc-950 dark:text-white">
                  <Trans id="login.mfa.method">Verification method</Trans>
                </legend>

                {pendingMfaChallenge.available_methods.map((method) => (
                  <label
                    key={method}
                    className="flex cursor-default items-start gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-white"
                  >
                    <input
                      type="radio"
                      name="mfa-method"
                      value={method}
                      checked={mfaMethod === method}
                      onChange={() => setMfaMethod(method)}
                      disabled={isVerifyingMfa}
                      className="mt-1"
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
              </fieldset>

              <Field>
                <Label htmlFor="mfa-code">
                  {mfaMethod === "recovery_code" ? (
                    <Trans id="login.mfa.recoveryCode">Recovery code</Trans>
                  ) : (
                    <Trans id="login.mfa.authenticatorCode">
                      Authenticator code
                    </Trans>
                  )}
                </Label>
                <Description>
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
                </Description>
                <Input
                  id="mfa-code"
                  name="mfa-code"
                  type="text"
                  autoComplete="one-time-code"
                  required
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value)}
                  placeholder={
                    mfaMethod === "recovery_code" ? "B6F42Q8P" : "123456"
                  }
                  disabled={isVerifyingMfa}
                  aria-invalid={mfaError ? true : undefined}
                  data-invalid={mfaError ? true : undefined}
                  aria-describedby={mfaError ? "mfa-code-error" : undefined}
                />
                {mfaError ? (
                  <ErrorMessage id="mfa-code-error">{mfaError}</ErrorMessage>
                ) : null}
              </Field>

              <DialogActions>
                <Button
                  type="button"
                  outline
                  onClick={handleCloseMfaDialog}
                  disabled={isVerifyingMfa}
                >
                  <Trans id="login.mfa.cancel">Cancel</Trans>
                </Button>
                <Button
                  type="submit"
                  color="blue"
                  disabled={isVerifyingMfa || mfaCode.trim().length === 0}
                  aria-busy={isVerifyingMfa}
                >
                  {isVerifyingMfa ? (
                    <Trans id="login.mfa.verifying">Verifying...</Trans>
                  ) : (
                    <Trans id="login.mfa.submit">Verify and continue</Trans>
                  )}
                </Button>
              </DialogActions>
            </form>
          )}
        </DialogBody>
      </Dialog>

      <div className="flex-1" />

      <div className="-mx-8 -mb-8 lg:-mx-12 lg:-mb-12 pt-8">
        <Footer />
      </div>
    </AuthLayout>
  );
}
