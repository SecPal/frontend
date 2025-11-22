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
      <div className="w-full max-w-md space-y-8">
        <div>
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-center flex-1">SecPal</h1>
            <LanguageSwitcher />
          </div>
          <h2 className="text-xl text-center mb-2">
            <Trans>Sign in to your account</Trans>
          </h2>
          <p className="text-center text-zinc-600 dark:text-zinc-400">
            <Trans>SecPal - a guard's best friend</Trans>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <Field>
            <Label htmlFor="email">
              <Trans>Email address</Trans>
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
            />
          </Field>

          <Field>
            <Label htmlFor="password">
              <Trans>Password</Trans>
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

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <Trans>Signing in...</Trans>
            ) : (
              <Trans>Sign in</Trans>
            )}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
