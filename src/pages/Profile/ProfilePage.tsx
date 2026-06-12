// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/react/macro";
import { useAuth } from "../../hooks/useAuth";
import { Card, CardContent } from "@/ui";
import { getInitials } from "../../lib/stringUtils";

/**
 * Profile Page
 *
 * Displays the current user's profile information.
 * Part of Issue #260 - Create Profile page.
 */
export function ProfilePage() {
  const { user } = useAuth();
  const initials = user?.name?.trim() ? getInitials(user.name) : "U";

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50">
          <Trans>My profile</Trans>
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          <Trans>View your account information.</Trans>
        </p>
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800" />

      <Card aria-labelledby="profile-information-heading">
        <CardContent className="space-y-6 pt-6">
          <h2 id="profile-information-heading" className="sr-only">
            <Trans>Account information</Trans>
          </h2>
          <div className="flex items-center gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-xl font-semibold text-white dark:bg-zinc-50 dark:text-zinc-950">
              {initials}
            </span>
            <div>
              <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                {user?.name ?? "-"}
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {user?.email ?? "-"}
              </p>
            </div>
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800" />

          <dl>
            <div className="grid grid-cols-1 gap-1 border-t border-zinc-100 py-3 first:border-t-0 sm:grid-cols-3 sm:gap-4 dark:border-zinc-800">
              <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                <Trans>Name</Trans>
              </dt>
              <dd className="text-sm text-zinc-950 sm:col-span-2 dark:text-zinc-50">
                {user?.name ?? "-"}
              </dd>
            </div>
            <div className="grid grid-cols-1 gap-1 border-t border-zinc-100 py-3 first:border-t-0 sm:grid-cols-3 sm:gap-4 dark:border-zinc-800">
              <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                <Trans>Email</Trans>
              </dt>
              <dd className="text-sm text-zinc-950 sm:col-span-2 dark:text-zinc-50">
                {user?.email ?? "-"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProfilePage;
