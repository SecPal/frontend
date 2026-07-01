// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import type { FormEvent } from "react";
import type { MfaChallenge, MfaVerificationMethod } from "@/types/api";
import { useLingui } from "@lingui/react";
import {
  LoginButton,
  LoginDialog,
  LoginDialogActions,
  LoginDialogBody,
  LoginDialogDescription,
  LoginDialogTitle,
  LoginField,
  LoginFieldDescription,
  LoginFieldError,
  LoginFieldLabel,
  LoginForm,
  LoginOtpInput,
} from "@/ui";

const TOTP_CODE_LENGTH = 6;
const RECOVERY_CODE_LENGTH = 8;

interface LoginMfaDialogProps {
  challenge: MfaChallenge | null;
  mfaCode: string;
  mfaError: string | null;
  mfaMethod: MfaVerificationMethod;
  isMfaSubmitDisabled: boolean;
  isOtherMethodAvailable: boolean;
  isVerifyingMfa: boolean;
  canSwitchMfaMethod: boolean;
  otherMfaMethod: MfaVerificationMethod;
  onChangeCode: (code: string) => void;
  onClose: () => void;
  onMethodChange: (method: MfaVerificationMethod) => void;
  onSubmit: (e: FormEvent) => Promise<void>;
}

export default function LoginMfaDialog({
  challenge,
  mfaCode,
  mfaError,
  mfaMethod,
  isMfaSubmitDisabled,
  isOtherMethodAvailable,
  isVerifyingMfa,
  canSwitchMfaMethod,
  otherMfaMethod,
  onChangeCode,
  onClose,
  onMethodChange,
  onSubmit,
}: LoginMfaDialogProps) {
  const { _ } = useLingui();

  return (
    <LoginDialog open={challenge !== null} onClose={onClose}>
      <LoginDialogTitle>
        <Trans id="login.mfa.title">Second factor required</Trans>
      </LoginDialogTitle>
      <LoginDialogDescription>
        <Trans id="login.mfa.description">
          Your password was accepted. Complete MFA to finish signing in.
        </Trans>
      </LoginDialogDescription>

      <LoginDialogBody>
        {challenge ? (
          <LoginForm
            onSubmit={(event) => {
              void onSubmit(event);
            }}
          >
            <LoginField>
              <LoginFieldLabel htmlFor="mfa-code">
                {mfaMethod === "recovery_code" ? (
                  <Trans id="login.mfa.recoveryCode">Recovery code</Trans>
                ) : (
                  <Trans id="login.mfa.authenticatorCode">
                    Authenticator code
                  </Trans>
                )}
              </LoginFieldLabel>
              <LoginFieldDescription id="mfa-code-help">
                {mfaMethod === "recovery_code" ? (
                  <Trans id="login.mfa.recoveryHelp">
                    Enter one unused 8-character recovery code exactly as
                    stored.
                  </Trans>
                ) : (
                  <Trans id="login.mfa.totpHelp">
                    Enter the current 6-digit code from your authenticator app.
                  </Trans>
                )}
              </LoginFieldDescription>
              {mfaMethod === "recovery_code" ? (
                <LoginOtpInput
                  idPrefix="mfa-code"
                  value={mfaCode}
                  onChange={onChangeCode}
                  length={RECOVERY_CODE_LENGTH}
                  groups={[4, 4]}
                  pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                  inputMode="text"
                  textTransform="uppercase"
                  disabled={isVerifyingMfa}
                  aria-label={_(msg`Recovery code`)}
                  aria-invalid={mfaError ? true : undefined}
                  aria-describedby={
                    mfaError ? "mfa-code-help mfa-code-error" : "mfa-code-help"
                  }
                />
              ) : (
                <LoginOtpInput
                  idPrefix="mfa-code"
                  value={mfaCode}
                  onChange={onChangeCode}
                  length={TOTP_CODE_LENGTH}
                  disabled={isVerifyingMfa}
                  aria-label={_(msg`Authenticator code`)}
                  aria-invalid={mfaError ? true : undefined}
                  aria-describedby={
                    mfaError ? "mfa-code-help mfa-code-error" : "mfa-code-help"
                  }
                />
              )}
              {mfaError ? (
                <LoginFieldError id="mfa-code-error">
                  {mfaError}
                </LoginFieldError>
              ) : null}
              {canSwitchMfaMethod && isOtherMethodAvailable ? (
                <button
                  type="button"
                  onClick={() => onMethodChange(otherMfaMethod)}
                  disabled={isVerifyingMfa}
                  className="text-muted-foreground focus-visible:ring-ring/50 focus-visible:ring-offset-background mx-auto block max-w-full text-center text-sm text-balance underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {mfaMethod === "totp" ? (
                    <Trans id="login.mfa.switchToRecovery">
                      I don&rsquo;t have access to my authenticator app
                    </Trans>
                  ) : (
                    <Trans id="login.mfa.switchToTotp">
                      Use authenticator code instead
                    </Trans>
                  )}
                </button>
              ) : null}
            </LoginField>

            <LoginDialogActions>
              <LoginButton
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isVerifyingMfa}
              >
                <Trans id="login.mfa.cancel">Cancel</Trans>
              </LoginButton>
              <LoginButton
                type="submit"
                disabled={isMfaSubmitDisabled}
                aria-busy={isVerifyingMfa}
              >
                {isVerifyingMfa ? (
                  <Trans id="login.mfa.verifying">Verifying...</Trans>
                ) : (
                  <Trans id="login.mfa.submit">Verify and continue</Trans>
                )}
              </LoginButton>
            </LoginDialogActions>
          </LoginForm>
        ) : null}
      </LoginDialogBody>
    </LoginDialog>
  );
}
