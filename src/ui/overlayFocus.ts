// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import * as React from "react";

const POINTER_BLUR_TRIGGER_SLOTS = new Set([
  "dropdown-menu-trigger",
  "select-trigger",
]);

function isPointerBlurTrigger(element: HTMLElement) {
  return (
    POINTER_BLUR_TRIGGER_SLOTS.has(element.getAttribute("data-slot") ?? "") ||
    element.getAttribute("aria-haspopup") === "menu"
  );
}

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
      if (
        document.activeElement instanceof HTMLElement &&
        isPointerBlurTrigger(document.activeElement)
      ) {
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
