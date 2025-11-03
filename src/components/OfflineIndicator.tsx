// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { Alert, AlertDescription, AlertTitle } from "./alert";

// No-op function for Alert's required onClose prop
// Alert dismisses automatically when back online
const noop = () => {};

/**
 * Component that displays a banner when the user is offline
 */
export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-96">
      <Alert open={!isOnline} onClose={noop}>
        <AlertTitle>You're offline</AlertTitle>
        <AlertDescription>
          Some features may be limited. Your changes will sync when you're back
          online.
        </AlertDescription>
      </Alert>
    </div>
  );
}
