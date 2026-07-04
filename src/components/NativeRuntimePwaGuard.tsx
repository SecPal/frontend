// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { useEffect } from "react";
import {
  disableBrowserPwaStateForNativeRuntime,
  isCapacitorNativeRuntime,
  shouldReloadAfterNativePwaCleanup,
} from "../lib/nativeRuntime";

export function NativeRuntimePwaGuard() {
  useEffect(() => {
    if (!isCapacitorNativeRuntime()) {
      return;
    }

    let isActive = true;

    void disableBrowserPwaStateForNativeRuntime().then((didCleanup) => {
      if (!isActive || !didCleanup || !shouldReloadAfterNativePwaCleanup()) {
        return;
      }

      window.location.reload();
    });

    return () => {
      isActive = false;
    };
  }, []);

  return null;
}
