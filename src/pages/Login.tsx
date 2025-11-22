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
      login(response.token, response.user);
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
      <div className="w-full max-w-md lg:max-w-lg space-y-6 px-4 sm:px-6 md:px-0">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
              SecPal
            </h1>
            <LanguageSwitcher />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg sm:text-xl font-semibold">
              <Trans id="login.title">Login</Trans>
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <Trans id="login.subtitle">Your digital guard companion</Trans>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3">
              <p className="text-sm text-red-800 dark:text-red-200">
                {error}
              </p>
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
              placeholder="your.name@secpal.app"
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
            />
          </Field>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2"
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
