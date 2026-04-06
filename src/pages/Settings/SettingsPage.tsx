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
import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import type {
  MfaRecoveryCodeReveal,
  MfaStatus,
  PasskeyCredentialSummary,
  TotpEnrollmentPreparation,
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
  confirmTotpEnrollment,
  disableMfa,
  getPasskeys,
  getMfaStatus,
  regenerateRecoveryCodes,
  startPasskeyRegistrationChallenge,
  startTotpEnrollment,
  verifyPasskeyRegistrationChallenge,
} from "../../services/authApi";
import { MfaQrCode } from "../../components/MfaQrCode";
import { formatDateTime } from "../../lib/dateUtils";
import {
  getPasskeyAttestation,
  isPasskeySupported,
} from "../../services/passkeyBrowser";

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
  const { _, i18n } = useLingui();
  const supportsPasskeys = useMemo(() => isPasskeySupported(), []);
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [isLoadingMfaStatus, setIsLoadingMfaStatus] = useState(true);
  const [mfaStatusError, setMfaStatusError] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyCredentialSummary[]>([]);
  const [isLoadingPasskeys, setIsLoadingPasskeys] = useState(true);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyLabel, setPasskeyLabel] = useState("");
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false);
  const [isEnrollmentDialogOpen, setIsEnrollmentDialogOpen] = useState(false);
  const [isPreparingEnrollment, setIsPreparingEnrollment] = useState(false);
  const [enrollmentPreparation, setEnrollmentPreparation] =
    useState<TotpEnrollmentPreparation | null>(null);
  const [enrollmentPreparationError, setEnrollmentPreparationError] = useState<
    string | null
  >(null);
  const [enrollmentCode, setEnrollmentCode] = useState("");
  const [enrollmentCodeError, setEnrollmentCodeError] = useState<string | null>(
    null
  );
  const [isSubmittingEnrollment, setIsSubmittingEnrollment] = useState(false);
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

  const loadPasskeys = useCallback(async () => {
    setIsLoadingPasskeys(true);
    setPasskeyError(null);

    try {
      const response = await getPasskeys();
      setPasskeys(response.data);
    } catch (error) {
      if (error instanceof AuthApiError) {
        setPasskeyError(error.message);
      } else if (error instanceof Error) {
        setPasskeyError(error.message);
      } else {
        setPasskeyError("Failed to load passkeys.");
      }
    } finally {
      setIsLoadingPasskeys(false);
    }
  }, []);

  useEffect(() => {
    void loadPasskeys();
  }, [loadPasskeys]);

  const handlePasskeyRegistration = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedLabel = passkeyLabel.trim();

    if (!trimmedLabel) {
      setPasskeyError("Enter a label for this passkey.");
      return;
    }

    setPasskeyError(null);
    setIsRegisteringPasskey(true);

    try {
      const challengeResponse = await startPasskeyRegistrationChallenge();
      const credential = await getPasskeyAttestation(
        challengeResponse.data.public_key
      );
      const response = await verifyPasskeyRegistrationChallenge(
        challengeResponse.data.challenge_id,
        {
          label: trimmedLabel,
          credential,
        }
      );

      setPasskeys((current) => [
        response.data.credential,
        ...current.filter(
          (registeredCredential) =>
            registeredCredential.id !== response.data.credential.id
        ),
      ]);
      setPasskeyLabel("");
    } catch (error) {
      if (error instanceof AuthApiError) {
        setPasskeyError(error.message);
      } else if (error instanceof Error) {
        setPasskeyError(error.message);
      } else {
        setPasskeyError("Failed to register passkey.");
      }
    } finally {
      setIsRegisteringPasskey(false);
    }
  };

  const loadEnrollmentPreparation = useCallback(async () => {
    setIsPreparingEnrollment(true);
    setEnrollmentPreparationError(null);
    setEnrollmentCodeError(null);

    try {
      const response = await startTotpEnrollment();
      setEnrollmentPreparation(response.data);
    } catch (error) {
      setEnrollmentPreparation(null);

      if (error instanceof AuthApiError) {
        setEnrollmentPreparationError(error.message);
      } else if (error instanceof Error) {
        setEnrollmentPreparationError(error.message);
      } else {
        setEnrollmentPreparationError("Failed to prepare MFA enrollment.");
      }
    } finally {
      setIsPreparingEnrollment(false);
    }
  }, []);

  const handleOpenEnrollment = () => {
    setIsEnrollmentDialogOpen(true);
    setEnrollmentPreparation(null);
    setEnrollmentPreparationError(null);
    setEnrollmentCode("");
    setEnrollmentCodeError(null);
    void loadEnrollmentPreparation();
  };

  const handleCloseEnrollment = () => {
    if (isSubmittingEnrollment) {
      return;
    }

    setIsEnrollmentDialogOpen(false);
    setEnrollmentPreparation(null);
    setEnrollmentPreparationError(null);
    setEnrollmentCode("");
    setEnrollmentCodeError(null);
  };

  const handleEnrollmentSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setEnrollmentCodeError(null);
    setIsSubmittingEnrollment(true);

    try {
      const response = await confirmTotpEnrollment({
        code: enrollmentCode.trim(),
      });

      setMfaStatus(response.data.status);
      setIsEnrollmentDialogOpen(false);
      setEnrollmentPreparation(null);
      setEnrollmentCode("");
      setRevealedRecoveryCodes(response.data.recovery_codes);
      setHasAcknowledgedRecoveryCodes(false);
    } catch (error) {
      if (error instanceof AuthApiError) {
        setEnrollmentCodeError(error.message);
      } else if (error instanceof Error) {
        setEnrollmentCodeError(error.message);
      } else {
        setEnrollmentCodeError("Failed to confirm MFA enrollment.");
      }
    } finally {
      setIsSubmittingEnrollment(false);
    }
  };

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
                <div className="space-y-4">
                  <Text className="text-sm text-zinc-600 dark:text-zinc-300">
                    <Trans>
                      MFA is currently off for this account. Set up an
                      authenticator app now to require a second factor at sign
                      in.
                    </Trans>
                  </Text>
                  <Button color="blue" onClick={handleOpenEnrollment}>
                    <Trans>Set up MFA</Trans>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <Divider />

      <section className="space-y-6">
        <div>
          <Heading level={2}>
            <Trans>Passkeys</Trans>
          </Heading>
          <Text className="mt-1">
            <Trans>
              Review the passkeys currently enrolled for this account.
            </Trans>
          </Text>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="space-y-4">
            {supportsPasskeys ? (
              <form
                className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                onSubmit={handlePasskeyRegistration}
              >
                <Field>
                  <Label htmlFor="passkey-label">
                    <Trans>Passkey label</Trans>
                  </Label>
                  <Input
                    id="passkey-label"
                    type="text"
                    value={passkeyLabel}
                    onChange={(event) => setPasskeyLabel(event.target.value)}
                    disabled={isRegisteringPasskey}
                    maxLength={100}
                  />
                </Field>
                <Button
                  type="submit"
                  color="blue"
                  disabled={isRegisteringPasskey}
                >
                  {isRegisteringPasskey ? (
                    <Trans>Adding passkey...</Trans>
                  ) : (
                    <Trans>Add passkey</Trans>
                  )}
                </Button>
              </form>
            ) : (
              <Text className="text-sm text-zinc-600 dark:text-zinc-300">
                <Trans>This browser does not support passkeys.</Trans>
              </Text>
            )}
            {passkeyError ? (
              <Text className="text-sm text-red-700 dark:text-red-300">
                {passkeyError}
              </Text>
            ) : null}
            {isLoadingPasskeys ? (
              <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                <Trans>Loading passkeys...</Trans>
              </Text>
            ) : !passkeyError && passkeys.length === 0 ? (
              <Text className="text-sm text-zinc-600 dark:text-zinc-300">
                <Trans>No passkeys enrolled yet.</Trans>
              </Text>
            ) : (
              <div className="space-y-3">
                {passkeys.map((passkey) => (
                  <div
                    key={passkey.id}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60"
                  >
                    <p className="text-sm font-medium text-zinc-950 dark:text-white">
                      {passkey.label}
                    </p>
                    <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                      <Trans>
                        Added {formatDateTime(passkey.created_at, i18n.locale)}
                      </Trans>
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </div>
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
        open={isEnrollmentDialogOpen}
        onClose={handleCloseEnrollment}
        size="2xl"
      >
        <DialogTitle>
          <Trans>Set up MFA</Trans>
        </DialogTitle>
        <DialogDescription>
          <Trans>
            Scan this QR code with your authenticator app, or enter the setup
            key manually, then confirm the current code to enable MFA.
          </Trans>
        </DialogDescription>

        <DialogBody>
          {isPreparingEnrollment ? (
            <Text className="text-sm text-zinc-500 dark:text-zinc-400">
              <Trans>Preparing MFA setup...</Trans>
            </Text>
          ) : enrollmentPreparationError ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                <Text className="text-sm text-red-800 dark:text-red-200">
                  {enrollmentPreparationError}
                </Text>
              </div>

              <DialogActions>
                <Button type="button" outline onClick={handleCloseEnrollment}>
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  type="button"
                  color="blue"
                  onClick={() => void loadEnrollmentPreparation()}
                >
                  <Trans>Try again</Trans>
                </Button>
              </DialogActions>
            </div>
          ) : enrollmentPreparation ? (
            <form className="space-y-6" onSubmit={handleEnrollmentSubmit}>
              <MfaQrCode
                value={enrollmentPreparation.otpauth_uri}
                alt={_(msg`Authenticator app QR code`)}
              />

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                <Text className="text-sm text-zinc-700 dark:text-zinc-300">
                  <Trans>Manual setup key</Trans>
                </Text>
                <code className="mt-3 block break-all rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm tracking-[0.18em] text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white">
                  {enrollmentPreparation.manual_entry_key}
                </code>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                <Text className="text-sm text-zinc-700 dark:text-zinc-300">
                  <Trans>
                    This setup expires at{" "}
                    {formatDateTime(
                      enrollmentPreparation.expires_at,
                      i18n.locale
                    )}
                    .
                  </Trans>
                </Text>
              </div>

              <Field>
                <Label htmlFor="enrollment-code">
                  <Trans>Authenticator code</Trans>
                </Label>
                <Input
                  id="enrollment-code"
                  name="enrollment-code"
                  type="text"
                  autoComplete="one-time-code"
                  required
                  value={enrollmentCode}
                  onChange={(event) => setEnrollmentCode(event.target.value)}
                  placeholder="123456"
                  disabled={isSubmittingEnrollment}
                  aria-invalid={enrollmentCodeError ? true : undefined}
                  aria-describedby={
                    enrollmentCodeError ? "enrollment-code-error" : undefined
                  }
                />
                {enrollmentCodeError ? (
                  <ErrorMessage id="enrollment-code-error">
                    {enrollmentCodeError}
                  </ErrorMessage>
                ) : null}
              </Field>

              <DialogActions>
                <Button
                  type="button"
                  outline
                  onClick={handleCloseEnrollment}
                  disabled={isSubmittingEnrollment}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  type="submit"
                  color="blue"
                  disabled={
                    isSubmittingEnrollment || enrollmentCode.trim().length === 0
                  }
                  aria-busy={isSubmittingEnrollment}
                >
                  {isSubmittingEnrollment ? (
                    <Trans>Processing...</Trans>
                  ) : (
                    <Trans>Confirm and enable MFA</Trans>
                  )}
                </Button>
              </DialogActions>
            </form>
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
                    sensitiveMethod === "totp" ? "123456" : "B6F42Q8P"
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
