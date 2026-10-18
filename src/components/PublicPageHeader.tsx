// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState, type ReactNode } from "react";
import { LoginLanguageSwitcher, LoginLegalMenu } from "./LoginLegalMenu";

const WIDE_HEADER_MEDIA_QUERY = "(min-width: 86rem)";

function getIsWideHeader() {
  if (typeof window === "undefined") return false;
  return typeof window.matchMedia === "function"
    ? window.matchMedia(WIDE_HEADER_MEDIA_QUERY).matches
    : window.innerWidth >= 1376;
}

interface PublicPageHeaderProps {
  children: ReactNode;
  sourceReturnTo?: string;
}

export function PublicPageHeader({
  children,
  sourceReturnTo,
}: PublicPageHeaderProps) {
  const [isWideHeader, setIsWideHeader] = useState(getIsWideHeader);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQueryList = window.matchMedia(WIDE_HEADER_MEDIA_QUERY);
    const onChange = (event: MediaQueryListEvent) =>
      setIsWideHeader(event.matches);
    mediaQueryList.addEventListener("change", onChange);
    return () => mediaQueryList.removeEventListener("change", onChange);
  }, []);

  const legal = (
    <div
      key="legal"
      className="shrink-0 justify-self-start min-[86rem]:col-start-1 min-[86rem]:row-start-1"
    >
      <LoginLegalMenu sourceReturnTo={sourceReturnTo} />
    </div>
  );
  const language = (
    <div
      key="language"
      className="shrink-0 justify-self-end min-[86rem]:col-start-3 min-[86rem]:row-start-1"
    >
      <LoginLanguageSwitcher />
    </div>
  );
  const content = (
    <div
      key="content"
      className="col-span-2 w-full max-w-5xl min-w-0 justify-self-center min-[86rem]:col-span-1 min-[86rem]:col-start-2 min-[86rem]:row-start-1"
    >
      {children}
    </div>
  );

  return (
    <div className="px-4 pt-[calc(1.5rem+var(--app-safe-area-inset-top))] sm:px-6 lg:px-8">
      <div
        data-slot="public-page-header"
        className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-4 pb-4 min-[86rem]:grid-cols-[minmax(0,1fr)_minmax(0,64rem)_minmax(0,1fr)]"
      >
        <div data-slot="public-page-header-controls" className="contents">
          {isWideHeader
            ? [legal, content, language]
            : [legal, language, content]}
        </div>
      </div>
    </div>
  );
}
