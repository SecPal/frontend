// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/macro";
import { Heading } from "../../components/heading";
import { Text } from "../../components/text";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { Divider } from "../../components/divider";

/**
 * Settings Page
 *
 * Allows users to configure their preferences including language selection.
 * Part of Issue #261 - Create Settings page with language selection.
 */
export function SettingsPage() {
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
    </div>
  );
}
