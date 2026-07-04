// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { msg } from "@lingui/core/macro";
import { NotificationInstallationsApiError } from "@/services/notificationInstallationsApi";

export function getNotificationInstallationsErrorMessage(
  error: unknown,
  translate: (message: ReturnType<typeof msg>) => string
): string | null {
  if (
    error instanceof NotificationInstallationsApiError &&
    error.code === "NOTIFICATION_RUNTIME_STATE_INVALID"
  ) {
    return translate(
      msg`This deployment's notification configuration changed. Refresh SecPal and enable notifications again if the browser prompts you.`
    );
  }

  if (
    error instanceof NotificationInstallationsApiError &&
    (error.status === 401 || error.status === 403)
  ) {
    return translate(
      msg`Sign in again before SecPal can sync this browser with the server.`
    );
  }

  return null;
}
