// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/react/macro";
import { Card, CardContent, CardHeader } from "@/ui/card";

/**
 * Shown after the employee submits the final onboarding step (and when reopening
 * the flow while HR review is still pending).
 */
export function OnboardingSubmitted() {
  return (
    <div className="mx-auto max-w-4xl">
      <Card aria-labelledby="onboarding-submitted-heading">
        <CardHeader>
          <h1
            id="onboarding-submitted-heading"
            className="text-2xl font-semibold text-foreground"
          >
            <Trans>You're all set</Trans>
          </h1>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            <Trans>
              Thank you for submitting your onboarding information. Our HR team
              will review your details.
            </Trans>
          </p>
          <p>
            <Trans>
              You do not need to take further action right now. If we need
              anything else, we will contact you directly.
            </Trans>
          </p>
          <p>
            <Trans>
              You will be notified when your submission has been reviewed.
            </Trans>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default OnboardingSubmitted;
