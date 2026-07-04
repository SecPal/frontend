// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import * as React from "react";

const MOBILE_BREAKPOINT_FALLBACK_PX = 768;
const MOBILE_MEDIA_QUERY = "(max-width: 47.999rem)";

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    if (typeof window.matchMedia === "function") {
      return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
    }

    return window.innerWidth < MOBILE_BREAKPOINT_FALLBACK_PX;
  });

  React.useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    mediaQueryList.addEventListener("change", onChange);

    return () => mediaQueryList.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
