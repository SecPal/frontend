// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { Trans } from "@lingui/react/macro";
import { SecPalEnterprise } from "@/native";
import { isAndroidSurface } from "@/platform/appSurface";
import { buttonVariants } from "@/ui/styles";

export function OpenOssLicensesButton() {
  if (!isAndroidSurface) {
    return null;
  }

  return (
    <button
      type="button"
      className={buttonVariants({ variant: "outline" })}
      onClick={() => {
        void SecPalEnterprise.openOssLicenses();
      }}
    >
      <Trans>Open source licenses</Trans>
    </button>
  );
}
