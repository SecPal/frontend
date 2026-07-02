// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/react/macro";
import { useAuth } from "../../hooks/useAuth";
import { Card, CardContent } from "@/ui/card";
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
        <h1 className="text-foreground text-2xl font-semibold tracking-normal">
          <Trans>My profile</Trans>
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          <Trans>View your account information.</Trans>
        </p>
      </div>

      <div className="border-t border-border" />

      <Card aria-labelledby="profile-information-heading">
        <CardContent className="space-y-6 pt-6">
          <h2 id="profile-information-heading" className="sr-only">
            <Trans>Account information</Trans>
          </h2>
          <div className="flex items-center gap-4">
            <span className="bg-muted text-foreground flex size-16 shrink-0 items-center justify-center rounded-full text-xl font-semibold">
              {initials}
            </span>
            <div>
              <p className="text-foreground text-lg font-semibold">
                {user?.name ?? "-"}
              </p>
              <p className="text-muted-foreground text-sm">
                {user?.email ?? "-"}
              </p>
            </div>
          </div>

          <div className="border-t border-border" />

          <dl>
            <div className="grid grid-cols-1 gap-1 border-t border-border py-3 first:border-t-0 sm:grid-cols-3 sm:gap-4">
              <dt className="text-muted-foreground text-sm font-medium">
                <Trans>Name</Trans>
              </dt>
              <dd className="text-foreground text-sm sm:col-span-2">
                {user?.name ?? "-"}
              </dd>
            </div>
            <div className="grid grid-cols-1 gap-1 border-t border-border py-3 first:border-t-0 sm:grid-cols-3 sm:gap-4">
              <dt className="text-muted-foreground text-sm font-medium">
                <Trans>Email</Trans>
              </dt>
              <dd className="text-foreground text-sm sm:col-span-2">
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
