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
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import type {
  MfaRecoveryCodeReveal,
  MfaStatus,
  PasskeyCredentialSummary,
  TotpEnrollmentPreparation,
  MfaVerificationMethod,
} from "@/types/api";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Input,
  LoadingRegion,
  RadioGroup,
  RadioGroupItem,
  SectionSkeleton,
  Skeleton,
} from "@/ui";
import {
  AuthApiError,
  confirmTotpEnrollment,
  deletePasskey,
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
  isPasskeyRegistrationSupported,
} from "../../services/passkeyBrowser";

type SensitiveMfaAction = "disable" | "regenerate";

type SettingsDialogSize =
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "5xl";

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

function SettingsDialog({
  open,
  onClose,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  size?: SettingsDialogSize;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent size={size}>{children}</DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function SettingsDivider() {
  return <div className="border-t border-zinc-200 dark:border-zinc-800" />;
}

function DescriptionRow({
  term,
  children,
}: {
  term: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 border-t border-zinc-100 py-3 first:border-t-0 sm:grid-cols-3 sm:gap-4 dark:border-zinc-800">
      <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {term}
      </dt>
      <dd className="text-sm text-zinc-950 sm:col-span-2 dark:text-zinc-50">
        {children}
      </dd>
    </div>
  );
}

function PasskeyListSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
      aria-live="polite"
      className="space-y-3"
    >
      <span className="sr-only">{loadingLabel}</span>
      {Array.from({ length: 2 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-44 max-w-full" />
              <Skeleton className="h-4 w-36 max-w-full" />
            </div>
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SettingsPage() {
  const { _, i18n } = useLingui();
  const supportsPasskeys = useMemo(() => isPasskeyRegistrationSupported(), []);
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [isLoadingMfaStatus, setIsLoadingMfaStatus] = useState(true);
  const [mfaStatusError, setMfaStatusError] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyCredentialSummary[]>([]);
  const [isLoadingPasskeys, setIsLoadingPasskeys] = useState(true);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [removingPasskeyId, setRemovingPasskeyId] = useState<string | null>(
    null
  );
  const [passkeyLabel, setPasskeyLabel] = useState("");
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false);
  const [registrationStep, setRegistrationStep] = useState<
    "challenge" | "device" | "saving" | null
  >(null);
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
  const mfaStatusLoadingLabel = _(msg`Loading MFA status...`);
  const passkeysLoadingLabel = _(msg`Loading passkeys...`);

  useEffect(() => {
    let active = true;

    void getMfaStatus()
      .then((response) => {
        if (!active) {
          return;
        }

        setMfaStatus(response.data);
        setMfaStatusError(null);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        if (error instanceof AuthApiError) {
          setMfaStatusError(error.message);
        } else if (error instanceof Error) {
          setMfaStatusError(error.message);
        } else {
          setMfaStatusError(_(msg`Failed to load MFA status.`));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingMfaStatus(false);
        }
      });

    return () => {
      active = false;
    };
  }, [_]);

  useEffect(() => {
    let active = true;

    void getPasskeys()
      .then((response) => {
        if (!active) {
          return;
        }

        setPasskeys(response.data);
        setPasskeyError(null);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        if (error instanceof AuthApiError) {
          setPasskeyError(error.message);
        } else if (error instanceof Error) {
          setPasskeyError(error.message);
        } else {
          setPasskeyError(_(msg`Failed to load passkeys.`));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingPasskeys(false);
        }
      });

    return () => {
      active = false;
    };
  }, [_]);

  const handlePasskeyRemoval = async (credentialId: string) => {
    setPasskeyError(null);
    setRemovingPasskeyId(credentialId);

    try {
      await deletePasskey(credentialId);
      const response = await getPasskeys();
      setPasskeys(response.data);
    } catch (error) {
      if (error instanceof AuthApiError) {
        setPasskeyError(error.message);
      } else if (error instanceof Error) {
        setPasskeyError(error.message);
      } else {
        setPasskeyError(_(msg`Failed to delete passkey.`));
      }
    } finally {
      setRemovingPasskeyId(null);
    }
  };

  const handlePasskeyRegistration = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedLabel = passkeyLabel.trim();

    if (!trimmedLabel) {
      setPasskeyError(_(msg`Enter a label for this passkey.`));
      return;
    }

    setPasskeyError(null);
    setIsRegisteringPasskey(true);
    setRegistrationStep("challenge");

    try {
      const challengeResponse = await startPasskeyRegistrationChallenge();
      console.info(
        "[SecPal] Passkey registration: challenge created id=%s",
        challengeResponse.data.challenge_id
      );
      setRegistrationStep("device");
      const credential = await getPasskeyAttestation(
        challengeResponse.data.public_key
      );
      console.info(
        "[SecPal] Passkey registration: device attestation complete"
      );
      setRegistrationStep("saving");
      const response = await verifyPasskeyRegistrationChallenge(
        challengeResponse.data.challenge_id,
        {
          label: trimmedLabel,
          credential,
        }
      );
      console.info(
        "[SecPal] Passkey registration: verify succeeded id=%s",
        response.data.credential.id
      );

      setPasskeys((current) => [
        response.data.credential,
        ...current.filter(
          (registeredCredential) =>
            registeredCredential.id !== response.data.credential.id
        ),
      ]);

      setPasskeyLabel("");

      setIsLoadingPasskeys(true);

      try {
        const refreshedPasskeys = await getPasskeys();
        setPasskeys(refreshedPasskeys.data);
        console.info(
          "[SecPal] Passkey registration: complete, %d passkey(s) enrolled",
          refreshedPasskeys.data.length
        );
      } catch {
        setPasskeyError(
          _(
            msg`Passkey registered, but the enrolled passkey list could not be refreshed.`
          )
        );
      } finally {
        setIsLoadingPasskeys(false);
      }
    } catch (error) {
      console.error("[SecPal] Passkey registration error:", error);
      if (error instanceof AuthApiError) {
        setPasskeyError(error.message);
      } else if (
        error instanceof DOMException &&
        error.name === "NotAllowedError"
      ) {
        setPasskeyError(
          _(
            msg`Passkey registration was cancelled or not permitted by the browser.`
          )
        );
      } else if (error instanceof DOMException && error.name === "AbortError") {
        setPasskeyError(
          _(msg`Passkey registration timed out. Please try again.`)
        );
      } else if (
        error instanceof Error &&
        /credential.manager/i.test(error.message)
      ) {
        setPasskeyError(
          _(
            msg`No credential provider is available on this device. Check that a passkey-capable app (e.g. Bitwarden) is installed and enabled as a credential provider in your device settings.`
          )
        );
      } else if (error instanceof Error) {
        setPasskeyError(error.message);
      } else {
        setPasskeyError(_(msg`Failed to register passkey.`));
      }
    } finally {
      setIsRegisteringPasskey(false);
      setRegistrationStep(null);
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
        setEnrollmentPreparationError(
          _(msg`Failed to prepare MFA enrollment.`)
        );
      }
    } finally {
      setIsPreparingEnrollment(false);
    }
  }, [_]);

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
        setEnrollmentCodeError(_(msg`Failed to confirm MFA enrollment.`));
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
        setSensitiveError(_(msg`Failed to complete MFA action.`));
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
        <h1 className="text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
          <Trans>Settings</Trans>
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          <Trans>Manage your application preferences.</Trans>
        </p>
      </div>

      <SettingsDivider />

      <section className="space-y-6">
        <div>
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
              <Trans>Multi-factor authentication</Trans>
            </h2>
          </div>
        </div>

        {mfaStatusError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm text-red-800 dark:text-red-200">
              {mfaStatusError}
            </p>
          </div>
        ) : null}

        <Card className="p-6">
          {isLoadingMfaStatus ? (
            <SectionSkeleton
              loadingLabel={mfaStatusLoadingLabel}
              rows={3}
              showHeader={false}
              className="border-0 p-0"
            />
          ) : mfaStatusError ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              <Trans>MFA status could not be loaded.</Trans>
            </p>
          ) : (
            <div className="space-y-6">
              <dl>
                <DescriptionRow term={<Trans>Status</Trans>}>
                  {getStatusLabel(mfaStatus)}
                </DescriptionRow>
                <DescriptionRow term={<Trans>Recovery codes remaining</Trans>}>
                  {mfaStatus?.recovery_codes_remaining ?? 0}
                </DescriptionRow>
              </dl>

              {mfaStatus?.enabled ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    onClick={() => handleOpenSensitiveAction("regenerate")}
                  >
                    <Trans>Regenerate recovery codes</Trans>
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleOpenSensitiveAction("disable")}
                  >
                    <Trans>Disable MFA</Trans>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    <Trans>
                      MFA is currently off for this account. Set up an
                      authenticator app now to require a second factor at sign
                      in.
                    </Trans>
                  </p>
                  <Button onClick={handleOpenEnrollment}>
                    <Trans>Set up MFA</Trans>
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </section>

      <SettingsDivider />

      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
            <Trans>Passkeys</Trans>
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            <Trans>
              Review the passkeys currently enrolled for this account.
            </Trans>
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {supportsPasskeys ? (
                <form
                  className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                  onSubmit={handlePasskeyRegistration}
                >
                  <Field>
                    <FieldLabel htmlFor="passkey-label">
                      <Trans>Passkey label</Trans>
                    </FieldLabel>
                    <Input
                      id="passkey-label"
                      type="text"
                      value={passkeyLabel}
                      onChange={(event) => setPasskeyLabel(event.target.value)}
                      disabled={isRegisteringPasskey}
                      maxLength={100}
                    />
                  </Field>
                  <Button type="submit" disabled={isRegisteringPasskey}>
                    {isRegisteringPasskey ? (
                      registrationStep === "device" ? (
                        <Trans>Complete on your device…</Trans>
                      ) : registrationStep === "saving" ? (
                        <Trans>Saving passkey…</Trans>
                      ) : (
                        <Trans>Adding passkey...</Trans>
                      )
                    ) : (
                      <Trans>Add passkey</Trans>
                    )}
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  <Trans>This browser does not support passkeys.</Trans>
                </p>
              )}
              {passkeyError ? (
                <p className="text-sm text-red-700 dark:text-red-300">
                  {passkeyError}
                </p>
              ) : null}
              {isLoadingPasskeys && passkeys.length === 0 ? (
                <PasskeyListSkeleton loadingLabel={passkeysLoadingLabel} />
              ) : !passkeyError &&
                passkeys.length === 0 &&
                !isRegisteringPasskey ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  <Trans>No passkeys enrolled yet.</Trans>
                </p>
              ) : (
                <LoadingRegion
                  loading={isLoadingPasskeys}
                  loadingLabel={passkeysLoadingLabel}
                >
                  <div className="space-y-3">
                    {passkeys.map((passkey) => (
                      <div
                        key={passkey.id}
                        className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-medium text-zinc-950 dark:text-white">
                              {passkey.label}
                            </p>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                              <Trans>
                                Added{" "}
                                {formatDateTime(
                                  passkey.created_at,
                                  i18n.locale
                                )}
                              </Trans>
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={removingPasskeyId !== null}
                            onClick={() =>
                              void handlePasskeyRemoval(passkey.id)
                            }
                          >
                            {removingPasskeyId === passkey.id ? (
                              <Trans>Removing...</Trans>
                            ) : (
                              <Trans>Remove</Trans>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </LoadingRegion>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <SettingsDivider />

      {/* Language Settings Section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
            <Trans>Language</Trans>
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            <Trans>Choose your preferred language for the application.</Trans>
          </p>
        </div>

        <div className="max-w-xs">
          <LanguageSwitcher />
        </div>
      </section>

      <SettingsDialog
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
              <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
                <AlertDescription className="mt-0 text-amber-800 dark:text-amber-200">
                  <Trans>
                    Anyone with one of these recovery codes can bypass your
                    authenticator app once. Do not store them in chat, email, or
                    screenshots.
                  </Trans>
                </AlertDescription>
              </Alert>

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

              <FieldLabel
                htmlFor="recovery-codes-acknowledgement"
                className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-normal text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-white"
              >
                <Checkbox
                  id="recovery-codes-acknowledgement"
                  checked={hasAcknowledgedRecoveryCodes}
                  onCheckedChange={(checked) =>
                    setHasAcknowledgedRecoveryCodes(checked === true)
                  }
                  className="mt-1"
                />
                <span>
                  <Trans>
                    I stored these recovery codes securely and understand they
                    will not be shown again.
                  </Trans>
                </span>
              </FieldLabel>

              <DialogActions>
                <Button
                  onClick={handleCloseRecoveryCodes}
                  disabled={!hasAcknowledgedRecoveryCodes}
                >
                  <Trans>Done</Trans>
                </Button>
              </DialogActions>
            </div>
          ) : null}
        </DialogBody>
      </SettingsDialog>

      <SettingsDialog
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
            <SectionSkeleton
              loadingLabel={_(msg`Preparing MFA setup...`)}
              rows={4}
              showHeader={false}
              className="border-0 p-0"
            />
          ) : enrollmentPreparationError ? (
            <div className="space-y-6">
              <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                <AlertDescription className="mt-0 text-red-800 dark:text-red-200">
                  {enrollmentPreparationError}
                </AlertDescription>
              </Alert>

              <DialogActions>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseEnrollment}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  type="button"
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
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  <Trans>Manual setup key</Trans>
                </p>
                <code className="mt-3 block break-all rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm tracking-[0.18em] text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white">
                  {enrollmentPreparation.manual_entry_key}
                </code>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  <Trans>
                    This setup expires at{" "}
                    {formatDateTime(
                      enrollmentPreparation.expires_at,
                      i18n.locale
                    )}
                    .
                  </Trans>
                </p>
              </div>

              <Field>
                <FieldLabel htmlFor="enrollment-code">
                  <Trans>Authenticator code</Trans>
                </FieldLabel>
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
                  <FieldError id="enrollment-code-error">
                    {enrollmentCodeError}
                  </FieldError>
                ) : null}
              </Field>

              <DialogActions>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseEnrollment}
                  disabled={isSubmittingEnrollment}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  type="submit"
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
      </SettingsDialog>

      <SettingsDialog
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

                <RadioGroup
                  value={sensitiveMethod}
                  onValueChange={(value) =>
                    setSensitiveMethod(value as MfaVerificationMethod)
                  }
                  disabled={isSubmittingSensitiveAction}
                >
                  {(["totp", "recovery_code"] as const).map((method) => {
                    const label =
                      method === "totp" ? (
                        <Trans>Authenticator code</Trans>
                      ) : (
                        <Trans>Recovery code</Trans>
                      );

                    return (
                      <FieldLabel
                        key={method}
                        htmlFor={`sensitive-mfa-method-${method}`}
                        className="flex cursor-default items-start gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-normal text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-white"
                      >
                        <RadioGroupItem
                          id={`sensitive-mfa-method-${method}`}
                          value={method}
                          aria-label={
                            method === "totp"
                              ? _(msg`Authenticator code`)
                              : _(msg`Recovery code`)
                          }
                          className="mt-1"
                        />
                        <span>{label}</span>
                      </FieldLabel>
                    );
                  })}
                </RadioGroup>
              </fieldset>

              <Field>
                <FieldLabel htmlFor="sensitive-mfa-code">
                  {sensitiveMethod === "totp" ? (
                    <Trans>Authenticator code</Trans>
                  ) : (
                    <Trans>Recovery code</Trans>
                  )}
                </FieldLabel>
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
                  <FieldError>{sensitiveError}</FieldError>
                ) : null}
              </Field>

              <DialogActions>
                <Button
                  type="button"
                  variant="outline"
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
                  variant={
                    sensitiveAction === "disable" ? "destructive" : "default"
                  }
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
      </SettingsDialog>
    </div>
  );
}

export default SettingsPage;
