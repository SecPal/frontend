// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/macro";
import { useAuth } from "../../hooks/useAuth";
import { Heading } from "../../components/heading";
import { Text } from "../../components/text";
import { Avatar } from "../../components/avatar";
import { Divider } from "../../components/divider";
import {
  DescriptionList,
  DescriptionTerm,
  DescriptionDetails,
} from "../../components/description-list";

/**
 * Get initials from a name string.
 * Returns up to 2 characters (first letter of first and last name).
 */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Profile Page
 *
 * Displays the current user's profile information.
 * Part of Issue #260 - Create Profile page.
 */
export function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-10">
      <div>
        <Heading>
          <Trans>My profile</Trans>
        </Heading>
        <Text className="mt-2">
          <Trans>View your account information.</Trans>
        </Text>
      </div>

      <Divider />

      {/* Profile Information Section */}
      <section className="space-y-6">
        {/* Avatar and Name */}
        <div className="flex items-center gap-4">
          <Avatar
            initials={user?.name ? getInitials(user.name) : "U"}
            className="size-16 bg-zinc-900 text-white text-xl dark:bg-white dark:text-zinc-900"
          />
          <div>
            <Text className="text-lg font-semibold text-zinc-900 dark:text-white">
              {user?.name ?? "-"}
            </Text>
            <Text className="text-zinc-500 dark:text-zinc-400">
              {user?.email ?? "-"}
            </Text>
          </div>
        </div>

        <Divider soft />

        {/* Account Details */}
        <DescriptionList>
          <DescriptionTerm>
            <Trans>Name</Trans>
          </DescriptionTerm>
          <DescriptionDetails>{user?.name ?? "-"}</DescriptionDetails>

          <DescriptionTerm>
            <Trans>Email</Trans>
          </DescriptionTerm>
          <DescriptionDetails>{user?.email ?? "-"}</DescriptionDetails>
        </DescriptionList>
      </section>
    </div>
  );
}
