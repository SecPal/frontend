// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import * as React from "react";

export function usePointerAwareCloseAutoFocus() {
  const closeTriggeredByPointerRef = React.useRef(false);

  function markPointerInteraction() {
    closeTriggeredByPointerRef.current = true;
  }

  function markKeyboardInteraction() {
    closeTriggeredByPointerRef.current = false;
  }

  function blurActiveElementAfterPointerClose() {
    if (!closeTriggeredByPointerRef.current) {
      return false;
    }

    closeTriggeredByPointerRef.current = false;

    queueMicrotask(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });

    return true;
  }

  return {
    blurActiveElementAfterPointerClose,
    markKeyboardInteraction,
    markPointerInteraction,
  };
}
