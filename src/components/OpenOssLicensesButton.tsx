// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { Trans } from "@lingui/react/macro";
import { SecPalEnterprise } from "@/native";
import { Button } from "@/ui/button";

export function OpenOssLicensesButton() {
  if (!SecPalEnterprise.isOssLicensesAvailable()) {
    return null;
  }

  return (
    <Button
      variant="outline"
      onClick={() => {
        void SecPalEnterprise.openOssLicenses();
      }}
    >
      <Trans>Open source licenses</Trans>
    </Button>
  );
}
