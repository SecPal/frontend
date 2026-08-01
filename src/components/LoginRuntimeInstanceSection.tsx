// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  LoginButton,
  LoginStatusMessage,
} from "@/ui";

export interface LoginRuntimeBootstrapSummary {
  readonly instanceDisplayName: string;
  readonly apiOrigin: string;
  readonly features?: {
    readonly passwordLoginEnabled: boolean;
    readonly passkeyLoginEnabled: boolean;
  };
}

interface LoginRuntimeInstanceSectionProps {
  readonly runtimeBootstrap: LoginRuntimeBootstrapSummary;
  readonly onSwitchRuntimeBootstrap?: () => Promise<void>;
  readonly isSwitchDisabled?: boolean;
  readonly onSwitchingChange?: (isSwitching: boolean) => void;
}

export function LoginRuntimeInstanceSection({
  runtimeBootstrap,
  onSwitchRuntimeBootstrap,
  isSwitchDisabled = false,
  onSwitchingChange,
}: LoginRuntimeInstanceSectionProps) {
  const { _ } = useLingui();
  const [isSwitching, setIsSwitching] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSwitch = async () => {
    if (!onSwitchRuntimeBootstrap) {
      return;
    }

    setErrorMessage(null);
    setIsSwitching(true);
    onSwitchingChange?.(true);

    try {
      await onSwitchRuntimeBootstrap();
    } catch (error: unknown) {
      console.error("Runtime bootstrap reset error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : _(msg`SecPal could not switch instances. Please try again.`)
      );
    } finally {
      setIsSwitching(false);
      onSwitchingChange?.(false);
    }
  };

  return (
    <AlertDialog
      open={isConfirmationOpen}
      onOpenChange={(open) => {
        if (!isSwitching) {
          setIsConfirmationOpen(open);
        }
      }}
    >
      <div
        data-testid="runtime-instance-section"
        className="row-start-3 flex w-full self-center justify-center px-6 [@media(max-height:42rem)]:mt-6 [@media(max-height:42rem)]:self-start"
      >
        <div
          data-testid="runtime-instance"
          className="w-full max-w-sm space-y-1 text-center"
        >
          <div className="space-y-1">
            <p className="text-sm">
              <Trans>Signed in to {runtimeBootstrap.instanceDisplayName}</Trans>
            </p>
            <p className="break-all text-xs text-muted-foreground">
              {runtimeBootstrap.apiOrigin}
            </p>
          </div>
          {errorMessage ? (
            <LoginStatusMessage live="assertive">
              {errorMessage}
            </LoginStatusMessage>
          ) : null}
          {onSwitchRuntimeBootstrap ? (
            <AlertDialogTrigger
              render={
                <LoginButton
                  id="secpal-runtime-switch-instance"
                  type="button"
                  variant="outline"
                  className="mx-auto w-full"
                  disabled={isSwitchDisabled || isSwitching}
                  aria-busy={isSwitching}
                />
              }
            >
              {isSwitching ? (
                <Trans>Switching instance...</Trans>
              ) : (
                <Trans>Switch instance</Trans>
              )}
            </AlertDialogTrigger>
          ) : null}
        </div>
      </div>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans>Switch instance?</Trans>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <Trans>
              You will be returned to the instance selection screen.
            </Trans>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            <Trans>Cancel</Trans>
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => void handleSwitch()}>
            <Trans>Switch instance</Trans>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
