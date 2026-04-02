// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Trans } from "@lingui/macro";
import type {
  MfaRecoveryCodeReveal,
  MfaStatus,
  MfaVerificationMethod,
} from "@/types/api";
import { Heading } from "../../components/heading";
import { Text } from "../../components/text";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { Divider } from "../../components/divider";
import { Button } from "../../components/button";
import { ErrorMessage, Field, Label } from "../../components/fieldset";
import { Input } from "../../components/input";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "../../components/dialog";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from "../../components/description-list";
import {
  AuthApiError,
  disableMfa,
  getMfaStatus,
  regenerateRecoveryCodes,
} from "../../services/authApi";

type SensitiveMfaAction = "disable" | "regenerate";

function getStatusLabel(status: MfaStatus | null): ReactNode {
  if (!status?.enabled) {
    return <Trans>Not enabled</Trans>;
  }

  return status.method === "totp" ? (
    <Trans>Authenticator app</Trans>
  ) : (
    <Trans>Enabled</Trans>
  );
}

function getSensitiveActionLabels(action: SensitiveMfaAction | null): {
  title: ReactNode;
  description: ReactNode;
  submit: ReactNode;
} {
  if (action === "disable") {
    return {
      title: <Trans>Disable MFA</Trans>,
      description: (
        <Trans>
          Confirm with your authenticator app or one recovery code to disable
          MFA for this account.
        </Trans>
      ),
      submit: <Trans>Disable MFA</Trans>,
    };
  }

  return {
    title: <Trans>Regenerate recovery codes</Trans>,
    description: (
      <Trans>
        Confirm with your authenticator app or one recovery code to replace
        every existing recovery code.
      </Trans>
    ),
    submit: <Trans>Regenerate codes</Trans>,
  };
}

export function SettingsPage() {
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [isLoadingMfaStatus, setIsLoadingMfaStatus] = useState(true);
  const [mfaStatusError, setMfaStatusError] = useState<string | null>(null);
  const [revealedRecoveryCodes, setRevealedRecoveryCodes] =
    useState<MfaRecoveryCodeReveal | null>(null);
  const [hasAcknowledgedRecoveryCodes, setHasAcknowledgedRecoveryCodes] =
    useState(false);
  const [sensitiveAction, setSensitiveAction] =
    useState<SensitiveMfaAction | null>(null);
  const [sensitiveMethod, setSensitiveMethod] =
    useState<MfaVerificationMethod>("totp");
  const [sensitiveCode, setSensitiveCode] = useState("");
  const [sensitiveError, setSensitiveError] = useState<string | null>(null);
  const [isSubmittingSensitiveAction, setIsSubmittingSensitiveAction] =
    useState(false);

  const sensitiveActionLabels = useMemo(
    () => getSensitiveActionLabels(sensitiveAction),
    [sensitiveAction]
  );

  const loadMfaStatus = useCallback(async () => {
    setIsLoadingMfaStatus(true);
    setMfaStatusError(null);

    try {
      const response = await getMfaStatus();
      setMfaStatus(response.data);
    } catch (error) {
      if (error instanceof AuthApiError) {
        setMfaStatusError(error.message);
      } else if (error instanceof Error) {
        setMfaStatusError(error.message);
      } else {
        setMfaStatusError("Failed to load MFA status.");
      }
    } finally {
      setIsLoadingMfaStatus(false);
    }
  }, []);

  useEffect(() => {
    void loadMfaStatus();
  }, [loadMfaStatus]);

  const handleSensitiveActionSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!sensitiveAction) {
      return;
    }

    setSensitiveError(null);
    setIsSubmittingSensitiveAction(true);

    try {
      if (sensitiveAction === "disable") {
        const response = await disableMfa({
          method: sensitiveMethod,
          code: sensitiveCode.trim(),
        });

        setMfaStatus(response.data);
        setSensitiveAction(null);
        setSensitiveCode("");
        return;
      }

      const response = await regenerateRecoveryCodes({
        method: sensitiveMethod,
        code: sensitiveCode.trim(),
      });

      setMfaStatus(response.data.status);
      setSensitiveAction(null);
      setSensitiveCode("");
      setRevealedRecoveryCodes(response.data.recovery_codes);
      setHasAcknowledgedRecoveryCodes(false);
    } catch (error) {
      if (error instanceof AuthApiError) {
        setSensitiveError(error.message);
      } else if (error instanceof Error) {
        setSensitiveError(error.message);
      } else {
        setSensitiveError("Failed to complete MFA action.");
      }
    } finally {
      setIsSubmittingSensitiveAction(false);
    }
  };

  const handleOpenSensitiveAction = (action: SensitiveMfaAction) => {
    setSensitiveAction(action);
    setSensitiveMethod("totp");
    setSensitiveCode("");
    setSensitiveError(null);
  };

  const handleCloseRecoveryCodes = () => {
    if (!hasAcknowledgedRecoveryCodes) {
      return;
    }

    setRevealedRecoveryCodes(null);
  };

  return (
    <div className="space-y-10">
      <div>
        <Heading>
          <Trans>Settings</Trans>
        </Heading>
        <Text className="mt-2">
          <Trans>Manage your application preferences.</Trans>
        </Text>
      </div>

      <Divider />

      <section className="space-y-6">
        <div>
          <div>
            <Heading level={2}>
              <Trans>Multi-factor authentication</Trans>
            </Heading>
          </div>
        </div>

        {mfaStatusError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <Text className="text-sm text-red-800 dark:text-red-200">
              {mfaStatusError}
            </Text>
          </div>
        ) : null}

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          {isLoadingMfaStatus ? (
            <Text className="text-sm text-zinc-500 dark:text-zinc-400">
              <Trans>Loading MFA status...</Trans>
            </Text>
          ) : mfaStatusError ? (
            <Text className="text-sm text-zinc-500 dark:text-zinc-400">
              <Trans>MFA status could not be loaded.</Trans>
            </Text>
          ) : (
            <div className="space-y-6">
              <DescriptionList>
                <DescriptionTerm>
                  <Trans>Status</Trans>
                </DescriptionTerm>
                <DescriptionDetails>
                  {getStatusLabel(mfaStatus)}
                </DescriptionDetails>

                <DescriptionTerm>
                  <Trans>Recovery codes remaining</Trans>
                </DescriptionTerm>
                <DescriptionDetails>
                  {mfaStatus?.recovery_codes_remaining ?? 0}
                </DescriptionDetails>
              </DescriptionList>

              {mfaStatus?.enabled ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    color="blue"
                    onClick={() => handleOpenSensitiveAction("regenerate")}
                  >
                    <Trans>Regenerate recovery codes</Trans>
                  </Button>
                  <Button
                    color="red"
                    onClick={() => handleOpenSensitiveAction("disable")}
                  >
                    <Trans>Disable MFA</Trans>
                  </Button>
                </div>
              ) : (
                <Text className="text-sm text-zinc-600 dark:text-zinc-300">
                  <Trans>
                    MFA is currently off for this account. Enrollment support
                    follows in the next rollout slice.
                  </Trans>
                </Text>
              )}
            </div>
          )}
        </div>
      </section>

      <Divider />

      {/* Language Settings Section */}
      <section className="space-y-4">
        <div>
          <Heading level={2}>
            <Trans>Language</Trans>
          </Heading>
          <Text className="mt-1">
            <Trans>Choose your preferred language for the application.</Trans>
          </Text>
        </div>

        <div className="max-w-xs">
          <LanguageSwitcher />
        </div>
      </section>

      <Dialog
        open={revealedRecoveryCodes !== null}
        onClose={handleCloseRecoveryCodes}
        size="2xl"
      >
        <DialogTitle>
          <Trans>Store your recovery codes now</Trans>
        </DialogTitle>
        <DialogDescription>
          <Trans>
            These codes are shown only once. Store them securely before closing
            this dialog.
          </Trans>
        </DialogDescription>

        <DialogBody>
          {revealedRecoveryCodes ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                <Text className="text-sm text-amber-800 dark:text-amber-200">
                  <Trans>
                    Anyone with one of these recovery codes can bypass your
                    authenticator app once. Do not store them in chat, email, or
                    screenshots.
                  </Trans>
                </Text>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {revealedRecoveryCodes.codes.map((code) => (
                  <code
                    key={code}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm tracking-[0.18em] text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-white"
                  >
                    {code}
                  </code>
                ))}
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-white">
                <input
                  type="checkbox"
                  checked={hasAcknowledgedRecoveryCodes}
                  onChange={(event) =>
                    setHasAcknowledgedRecoveryCodes(event.target.checked)
                  }
                  className="mt-1"
                />
                <span>
                  <Trans>
                    I stored these recovery codes securely and understand they
                    will not be shown again.
                  </Trans>
                </span>
              </label>

              <DialogActions>
                <Button
                  color="blue"
                  onClick={handleCloseRecoveryCodes}
                  disabled={!hasAcknowledgedRecoveryCodes}
                >
                  <Trans>Done</Trans>
                </Button>
              </DialogActions>
            </div>
          ) : null}
        </DialogBody>
      </Dialog>

      <Dialog
        open={sensitiveAction !== null}
        onClose={() => {
          if (!isSubmittingSensitiveAction) {
            setSensitiveAction(null);
            setSensitiveCode("");
            setSensitiveError(null);
          }
        }}
      >
        <DialogTitle>{sensitiveActionLabels.title}</DialogTitle>
        <DialogDescription>
          {sensitiveActionLabels.description}
        </DialogDescription>

        <DialogBody>
          {sensitiveAction ? (
            <form className="space-y-6" onSubmit={handleSensitiveActionSubmit}>
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-zinc-950 dark:text-white">
                  <Trans>Verification method</Trans>
                </legend>

                {(["totp", "recovery_code"] as const).map((method) => (
                  <label
                    key={method}
                    className="flex cursor-default items-start gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-white"
                  >
                    <input
                      type="radio"
                      name="sensitive-mfa-method"
                      value={method}
                      checked={sensitiveMethod === method}
                      onChange={() => setSensitiveMethod(method)}
                      disabled={isSubmittingSensitiveAction}
                      className="mt-1"
                    />
                    <span>
                      {method === "totp" ? (
                        <Trans>Authenticator code</Trans>
                      ) : (
                        <Trans>Recovery code</Trans>
                      )}
                    </span>
                  </label>
                ))}
              </fieldset>

              <Field>
                <Label htmlFor="sensitive-mfa-code">
                  {sensitiveMethod === "totp" ? (
                    <Trans>Authenticator code</Trans>
                  ) : (
                    <Trans>Recovery code</Trans>
                  )}
                </Label>
                <Input
                  id="sensitive-mfa-code"
                  name="sensitive-mfa-code"
                  type="text"
                  autoComplete="one-time-code"
                  required
                  value={sensitiveCode}
                  onChange={(event) => setSensitiveCode(event.target.value)}
                  placeholder={
                    sensitiveMethod === "totp" ? "123456" : "B6F4-2Q8P"
                  }
                  disabled={isSubmittingSensitiveAction}
                />
                {sensitiveError ? (
                  <ErrorMessage>{sensitiveError}</ErrorMessage>
                ) : null}
              </Field>

              <DialogActions>
                <Button
                  type="button"
                  outline
                  onClick={() => {
                    setSensitiveAction(null);
                    setSensitiveCode("");
                    setSensitiveError(null);
                  }}
                  disabled={isSubmittingSensitiveAction}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  type="submit"
                  color={sensitiveAction === "disable" ? "red" : "blue"}
                  disabled={
                    isSubmittingSensitiveAction ||
                    sensitiveCode.trim().length === 0
                  }
                  aria-busy={isSubmittingSensitiveAction}
                >
                  {isSubmittingSensitiveAction ? (
                    <Trans>Processing...</Trans>
                  ) : (
                    sensitiveActionLabels.submit
                  )}
                </Button>
              </DialogActions>
            </form>
          ) : null}
        </DialogBody>
      </Dialog>
    </div>
  );
}

export default SettingsPage;
