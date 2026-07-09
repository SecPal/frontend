// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { useEffect, useState, type FormEvent } from "react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { CheckCircle2, ServerCog } from "lucide-react";

import { Logo } from "./Logo";
import { SecPalRuntimeBootstrap, type SecPalRuntimeInfo } from "../native";
import {
  RuntimeDiscoveryError,
  discoverAndroidRuntimeBootstrap,
} from "../services/runtimeDiscovery";
import { activateLocale, setLocalePreference } from "../i18n";
import type { BootstrapConfiguration } from "@/types/api";
import {
  LoginButton,
  LoginCard,
  LoginCardHeader,
  LoginCardTitle,
  LoginField,
  LoginFieldDescription,
  LoginFieldGroup,
  LoginFieldLabel,
  LoginForm,
  LoginInput,
  LoginShell,
  LoginSpinner,
  LoginStatusMessage,
} from "@/ui";

const LOCALE_STORAGE_KEY = "secpal-locale";
type RuntimeDiscoveryLocale = "en" | "de";

function getStoredDiscoveryLocale(): RuntimeDiscoveryLocale {
  try {
    const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);

    if (storedLocale === "de") {
      return "de";
    }
  } catch {
    // Locale persistence is best-effort; discovery must still be usable.
  }

  return "en";
}

function persistDiscoveryLocale(locale: RuntimeDiscoveryLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Keep discovery usable when storage is blocked.
  }
}

function getDiscoveryErrorMessage(error: unknown): string {
  if (error instanceof RuntimeDiscoveryError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The selected instance could not be checked.";
}

function getApiOrigin(rawApiBaseUrl: string): string {
  return new URL(rawApiBaseUrl).origin;
}

export function RuntimeDiscoveryFlow({
  runtimeInfo,
  onConfigured,
}: {
  runtimeInfo: SecPalRuntimeInfo;
  onConfigured: () => void;
}) {
  const { _ } = useLingui();
  const [instanceUrl, setInstanceUrl] = useState("");
  const [locale, setLocale] = useState<RuntimeDiscoveryLocale>(() =>
    getStoredDiscoveryLocale()
  );
  const [resolvedBootstrap, setResolvedBootstrap] =
    useState<BootstrapConfiguration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    persistDiscoveryLocale(locale);
  }, [locale]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResolvedBootstrap(null);
    setIsChecking(true);

    try {
      const bootstrap = await discoverAndroidRuntimeBootstrap({
        instanceUrl,
        locale,
        runtimeInfo,
      });

      setResolvedBootstrap(bootstrap);
    } catch (discoveryError) {
      setError(getDiscoveryErrorMessage(discoveryError));
    } finally {
      setIsChecking(false);
    }
  }

  async function handleConfirm() {
    if (!resolvedBootstrap) {
      return;
    }

    setError(null);
    setIsConfirming(true);

    try {
      await SecPalRuntimeBootstrap.setRuntimeBootstrap(resolvedBootstrap);
      onConfigured();
    } catch (confirmError) {
      setError(getDiscoveryErrorMessage(confirmError));
      setIsConfirming(false);
    }
  }

  async function handleLocaleChange(nextLocale: RuntimeDiscoveryLocale) {
    setError(null);

    try {
      await activateLocale(nextLocale);
      setLocalePreference(nextLocale);
      setLocale(nextLocale);
    } catch (localeError) {
      setError(
        localeError instanceof Error
          ? localeError.message
          : _(msg`Failed to change language. Please try again.`)
      );
    }
  }

  const apiOrigin = resolvedBootstrap
    ? getApiOrigin(resolvedBootstrap.api_base_url)
    : null;

  return (
    <LoginShell>
      <div className="flex w-full flex-1 items-center justify-center py-16">
        <LoginCard>
          <LoginCardHeader className="mb-8">
            <Logo className="h-12 w-12" />
            <LoginCardTitle id="secpal-instance-discovery-title">
              <Trans>Enter your instance URL</Trans>
            </LoginCardTitle>
            <p
              id="secpal-instance-discovery-description"
              className="text-muted-foreground text-sm"
            >
              <Trans>
                Enter the instance URL you received from your supervisor.
              </Trans>
            </p>
          </LoginCardHeader>

          <LoginForm onSubmit={handleSubmit}>
            <LoginFieldGroup>
              <LoginField>
                <LoginFieldLabel htmlFor="secpal-instance-discovery-url">
                  <Trans>Instance URL</Trans>
                </LoginFieldLabel>
                <LoginInput
                  id="secpal-instance-discovery-url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoComplete="url"
                  placeholder="https://api.secpal.dev"
                  value={instanceUrl}
                  onChange={(event) => {
                    setInstanceUrl(event.target.value);
                    setResolvedBootstrap(null);
                    setError(null);
                  }}
                  disabled={isChecking || isConfirming}
                  required
                />
              </LoginField>

              <LoginField>
                <LoginFieldLabel htmlFor="secpal-instance-discovery-locale">
                  <Trans>Language</Trans>
                </LoginFieldLabel>
                <select
                  id="secpal-instance-discovery-locale"
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground min-h-10 w-full rounded-md border px-3 py-2 text-base text-foreground shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
                  value={locale}
                  disabled={isChecking || isConfirming}
                  onChange={(event) => {
                    const nextLocale =
                      event.target.value === "de" ? "de" : "en";
                    void handleLocaleChange(nextLocale);
                  }}
                >
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                </select>
              </LoginField>
            </LoginFieldGroup>

            {error ? (
              <LoginStatusMessage
                id="secpal-instance-discovery-error"
                variant="error"
                title={<Trans>Instance unavailable</Trans>}
              >
                {error}
              </LoginStatusMessage>
            ) : null}

            {resolvedBootstrap && apiOrigin ? (
              <section
                id="secpal-instance-discovery-summary"
                className="rounded-lg border border-border bg-muted/40 p-4"
                aria-labelledby="secpal-instance-discovery-summary-title"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className="mt-0.5 size-5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 space-y-2">
                    <h2
                      id="secpal-instance-discovery-summary-title"
                      className="break-words text-sm font-semibold text-foreground"
                    >
                      {resolvedBootstrap.instance.display_name}
                    </h2>
                    <dl className="space-y-1 text-sm">
                      <div>
                        <dt className="text-muted-foreground">
                          <Trans>API origin</Trans>
                        </dt>
                        <dd className="break-all text-foreground">
                          {apiOrigin}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          <Trans>Minimum Android version</Trans>
                        </dt>
                        <dd className="text-foreground">
                          {
                            resolvedBootstrap.compatibility
                              .minimum_supported_app_version
                          }
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </section>
            ) : (
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex gap-3">
                  <ServerCog
                    className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div>
                    <p
                      id="secpal-instance-discovery-note-title"
                      className="text-sm font-semibold text-foreground"
                    >
                      <Trans>Not sure which instance to use?</Trans>
                    </p>
                    <LoginFieldDescription id="secpal-instance-discovery-note-description">
                      <Trans>
                        Ask your supervisor for the SecPal instance URL before
                        continuing.
                      </Trans>
                    </LoginFieldDescription>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <LoginButton
                id="secpal-instance-discovery-validate"
                type="submit"
                className="w-full"
                disabled={
                  isChecking || isConfirming || instanceUrl.trim() === ""
                }
              >
                {isChecking ? (
                  <>
                    <LoginSpinner aria-label="Checking instance" />
                    <Trans>Checking instance</Trans>
                  </>
                ) : (
                  <Trans>Check instance</Trans>
                )}
              </LoginButton>
              <LoginButton
                id="secpal-instance-discovery-confirm"
                type="button"
                variant="outline"
                className="w-full"
                disabled={!resolvedBootstrap || isChecking || isConfirming}
                onClick={() => {
                  void handleConfirm();
                }}
              >
                {isConfirming ? (
                  <>
                    <LoginSpinner aria-label="Saving instance" />
                    <Trans>Saving instance</Trans>
                  </>
                ) : (
                  <Trans>Continue to login</Trans>
                )}
              </LoginButton>
            </div>
          </LoginForm>
        </LoginCard>
      </div>
    </LoginShell>
  );
}
