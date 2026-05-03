// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/react/macro";
import { Heading } from "../../components/heading";
import { Text } from "../../components/text";

/**
 * Shown after the employee submits the final onboarding step (and when reopening
 * the flow while HR review is still pending).
 */
export function OnboardingSubmitted() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
        <Heading className="mb-4">
          <Trans>You're all set</Trans>
        </Heading>
        <Text className="mb-4 text-zinc-600 dark:text-zinc-400">
          <Trans>
            Thank you for submitting your onboarding information. Our HR team
            will review your details.
          </Trans>
        </Text>
        <Text className="mb-4 text-zinc-600 dark:text-zinc-400">
          <Trans>
            You do not need to take further action right now. If we need
            anything else, we will contact you directly.
          </Trans>
        </Text>
        <Text className="text-zinc-600 dark:text-zinc-400">
          <Trans>
            You will be notified when your submission has been reviewed.
          </Trans>
        </Text>
      </div>
    </div>
  );
}

export default OnboardingSubmitted;
