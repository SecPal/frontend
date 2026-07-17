// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { useState, type FormEvent } from "react";
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
import { LoginHeaderControls, LoginLegalFooter } from "./LoginLegalMenu";
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

type RuntimeDiscoveryLocale = "en" | "de";

function getDiscoveryErrorMessage(
  error: unknown,
  translate: (message: ReturnType<typeof msg>) => string
): string {
  if (error instanceof RuntimeDiscoveryError) {
    switch (error.code) {
      case "INVALID_INSTANCE_URL":
        return translate(msg`Enter a valid secure HTTPS instance URL.`);
      case "RUNTIME_INFO_UNAVAILABLE":
        return translate(msg`Android runtime information is unavailable.`);
      case "BOOTSTRAP_UNAVAILABLE":
        return translate(
          msg`Could not reach that instance. Check the URL with your supervisor.`
        );
      case "BOOTSTRAP_STATE_INVALID":
        return translate(msg`The bootstrap response is incomplete.`);
      case "BOOTSTRAP_PLATFORM_INCOMPATIBLE":
        return translate(
          msg`This instance is not compatible with Android discovery.`
        );
      case "BOOTSTRAP_INCOMPATIBLE":
        return translate(
          msg`This instance must be verified by an administrator before it can be used.`
        );
      case "UNSUPPORTED_CLIENT_VERSION":
        return translate(
          msg`Update the Android app before using this instance.`
        );
    }
  }

  return translate(msg`The selected instance could not be checked.`);
}

function getDiscoveryApplyErrorMessage(
  error: unknown,
  translate: (message: ReturnType<typeof msg>) => string
): string {
  if (error instanceof RuntimeDiscoveryError) {
    return getDiscoveryErrorMessage(error, translate);
  }

  return translate(
    msg`The selected instance could not be applied. Please try again.`
  );
}

function getApiOrigin(rawApiBaseUrl: string): string {
  return new URL(rawApiBaseUrl).origin;
}

export function RuntimeDiscoveryFlow({
  runtimeInfo,
  onConfigured,
}: {
  runtimeInfo: SecPalRuntimeInfo;
  onConfigured: (bootstrap: BootstrapConfiguration) => void;
}) {
  const { _, i18n } = useLingui();
  const [instanceUrl, setInstanceUrl] = useState("");
  const [resolvedBootstrap, setResolvedBootstrap] =
    useState<BootstrapConfiguration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const locale: RuntimeDiscoveryLocale = i18n.locale === "de" ? "de" : "en";

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
      setError(getDiscoveryErrorMessage(discoveryError, _));
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
      onConfigured(resolvedBootstrap);
    } catch (confirmError) {
      setError(getDiscoveryApplyErrorMessage(confirmError, _));
      setIsConfirming(false);
    }
  }

  const apiOrigin = resolvedBootstrap
    ? getApiOrigin(resolvedBootstrap.api_base_url)
    : null;

  return (
    <LoginShell>
      <LoginHeaderControls />
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
      <LoginLegalFooter />
    </LoginShell>
  );
}
