// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { PageSkeleton } from "@/ui";

export function RouteContentFallback() {
  const { i18n } = useLingui();

  return (
    <PageSkeleton
      loadingLabel={i18n._(msg`Loading page...`)}
      sections={2}
    />
  );
}
