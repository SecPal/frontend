// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  CloudArrowDownIcon,
  DevicePhoneMobileIcon,
} from "@heroicons/react/20/solid";
import { Trans } from "@lingui/macro";
import { Badge } from "../catalyst/badge";

interface OfflineSecretBadgeProps {
  /**
   * Whether this secret exists only locally (not yet uploaded)
   */
  isOfflineOnly?: boolean;

  /**
   * Whether this secret has pending changes to sync
   */
  hasPendingChanges?: boolean;
}

/**
 * Badge indicating a secret's offline status
 *
 * Shows if a secret is:
 * - Only available offline (not yet synced)
 * - Has pending local changes to sync
 *
 * @example
 * ```tsx
 * <OfflineSecretBadge isOfflineOnly />
 * <OfflineSecretBadge hasPendingChanges />
 * ```
 */
export function OfflineSecretBadge({
  isOfflineOnly,
  hasPendingChanges,
}: OfflineSecretBadgeProps) {
  if (isOfflineOnly) {
    return (
      <Badge color="amber">
        <DevicePhoneMobileIcon className="h-4 w-4" />
        <Trans>Offline only</Trans>
      </Badge>
    );
  }

  if (hasPendingChanges) {
    return (
      <Badge color="blue">
        <CloudArrowDownIcon className="h-4 w-4" />
        <Trans>Pending sync</Trans>
      </Badge>
    );
  }

  return null;
}
