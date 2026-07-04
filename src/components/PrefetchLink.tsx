// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { forwardRef, useCallback, useMemo } from "react";
import {
  Link as RouterLink,
  type LinkProps as RouterLinkProps,
} from "react-router-dom";
import { usePrefetch } from "../hooks/usePrefetch";

function pathFromTo(to: RouterLinkProps["to"]): string | null {
  if (typeof to === "string") {
    return to.startsWith("/") ? to : null;
  }

  if (typeof to.pathname !== "string" || !to.pathname.startsWith("/")) {
    return null;
  }

  return `${to.pathname}${to.search ?? ""}`;
}

export const PrefetchLink = forwardRef<HTMLAnchorElement, RouterLinkProps>(
  function PrefetchLink(
    { onFocus, onMouseEnter, onTouchStart, to, ...props },
    ref
  ) {
    const { prefetchPath, prefetchPathModuleOnly } = usePrefetch();
    const prefetchPathname = useMemo(() => pathFromTo(to), [to]);

    const prefetch = useCallback(() => {
      if (prefetchPathname) {
        prefetchPath(prefetchPathname);
      }
    }, [prefetchPath, prefetchPathname]);

    const prefetchModuleOnly = useCallback(() => {
      if (prefetchPathname) {
        prefetchPathModuleOnly(prefetchPathname);
      }
    }, [prefetchPathModuleOnly, prefetchPathname]);

    return (
      <RouterLink
        {...props}
        to={to}
        ref={ref}
        onFocus={(event) => {
          onFocus?.(event);
          if (!event.defaultPrevented) {
            prefetch();
          }
        }}
        onMouseEnter={(event) => {
          onMouseEnter?.(event);
          if (!event.defaultPrevented) {
            prefetch();
          }
        }}
        onTouchStart={(event) => {
          onTouchStart?.(event);
          if (!event.defaultPrevented) {
            prefetchModuleOnly();
          }
        }}
      />
    );
  }
);
