// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { useAuth } from "../hooks/useAuth";
import { login as apiLogin, AuthApiError } from "../services/authApi";
import { AuthLayout } from "../components/auth-layout";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { Button } from "../components/button";
import { Field, Label } from "../components/fieldset";
import { Input } from "../components/input";

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await apiLogin({ email, password });
      login(response.user);
      navigate("/secrets");
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-full">
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
          {error && (
            <div
              id="login-error"
              role="alert"
              aria-live="assertive"
              className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20"
            >
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
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
              placeholder="your.email@example.com"
              aria-describedby={error ? "login-error" : undefined}
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
              aria-describedby={error ? "login-error" : undefined}
            />
          </Field>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full"
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <Trans id="login.submitting">Logging in...</Trans>
            ) : (
              <Trans id="login.submit">Log in</Trans>
            )}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
