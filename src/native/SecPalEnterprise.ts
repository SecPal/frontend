// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { registerPlugin } from "@capacitor/core";

export interface SecPalEnterpriseEnrollment {
  readonly tenantId: string;
  readonly managedBy?: string;
}

export interface SecPalEnterpriseFacade {
  getEnrollment(): Promise<SecPalEnterpriseEnrollment | null>;
  openOssLicenses(): Promise<boolean>;
}

interface SecPalEnterprisePlugin {
  openOssLicenses?(): Promise<void>;
}

const secPalEnterprisePlugin =
  registerPlugin<SecPalEnterprisePlugin>("SecPalEnterprise");

export const SecPalEnterprise: SecPalEnterpriseFacade = {
  async getEnrollment(): Promise<SecPalEnterpriseEnrollment | null> {
    return null;
  },
  async openOssLicenses(): Promise<boolean> {
    if (typeof secPalEnterprisePlugin.openOssLicenses !== "function") {
      return false;
    }

    try {
      await secPalEnterprisePlugin.openOssLicenses();
      return true;
    } catch {
      return false;
    }
  },
};
