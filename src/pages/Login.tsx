// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { useAuth } from "../hooks/useAuth";
import { useLoginRateLimiter } from "../hooks/useLoginRateLimiter";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { login as apiLogin, AuthApiError } from "../services/authApi";
import { checkHealth, HealthStatus } from "../services/healthApi";
import { AuthLayout } from "../components/auth-layout";
import { Footer } from "../components/Footer";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { Button } from "../components/button";
import { Field, Label } from "../components/fieldset";
import { Input } from "../components/input";

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
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
  const [error, setError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [isHealthCheckLoading, setIsHealthCheckLoading] = useState(true);
  const [healthCheckError, setHealthCheckError] = useState(false);

  // Check backend health on component mount
  useEffect(() => {
    let isMounted = true;

    async function performHealthCheck() {
      try {
        const status = await checkHealth();
        if (isMounted) {
          setHealthStatus(status);
          setHealthCheckError(false);
        }
      } catch {
        if (isMounted) {
          setHealthCheckError(true);
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
  }, []);

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
      const response = await apiLogin({ email, password });
      resetAttempts(); // Clear rate limit state on successful login
      login(response.user);
      navigate("/");
    } catch (err) {
      console.error("Login error:", err);
      recordFailedAttempt(); // Record failed attempt for rate limiting
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "An unexpected error occurred. Please try again or contact support."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">SecPal</h1>
        <LanguageSwitcher />
      </div>

      <h2 className="mt-8 text-2xl font-semibold">
        <Trans id="login.title">Login</Trans>
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        <Trans id="login.subtitle">Your digital guard companion</Trans>
      </p>

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
            <Trans id="login.email">Email</Trans>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-describedby={ariaDescribedBy}
            disabled={!isOnline || isSystemNotReady || isLocked}
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
            disabled={!isOnline || isSystemNotReady || isLocked}
          />
        </Field>

        <Button
          type="submit"
          disabled={
            !isOnline ||
            isSubmitting ||
            isSystemNotReady ||
            isHealthCheckLoading ||
            isLocked
          }
          className="w-full"
          aria-busy={isSubmitting}
          aria-disabled={
            !isOnline || isSystemNotReady || isHealthCheckLoading || isLocked
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
      </form>

      <div className="flex-1" />

      <div className="-mx-8 -mb-8 lg:-mx-12 lg:-mb-12 pt-8">
        <Footer />
      </div>
    </AuthLayout>
  );
}
