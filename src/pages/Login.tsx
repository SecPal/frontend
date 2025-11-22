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
      <div className="w-full max-w-md space-y-8 px-4 sm:px-0">
        <div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-center sm:text-left flex-1 order-2 sm:order-1">
              SecPal
            </h1>
            <div className="order-1 sm:order-2">
              <LanguageSwitcher />
            </div>
          </div>
          <h2 className="text-xl sm:text-2xl text-center mb-3">
            <Trans id="login.title">Login</Trans>
          </h2>
          <p className="text-sm sm:text-base text-center text-zinc-600 dark:text-zinc-400">
            <Trans id="login.subtitle">Your digital guard companion</Trans>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 sm:p-4">
              <p className="text-sm sm:text-base text-red-800 dark:text-red-200">
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
              className="text-base sm:text-sm"
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
              className="text-base sm:text-sm"
            />
          </Field>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-6 sm:mt-8 py-3 sm:py-2.5 text-base sm:text-sm"
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
