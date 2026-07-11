// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { Capacitor, registerPlugin } from "@capacitor/core";

export interface SecPalEnterpriseEnrollment {
  readonly tenantId: string;
  readonly managedBy?: string;
}

export interface SecPalEnterpriseFacade {
  getEnrollment(): Promise<SecPalEnterpriseEnrollment | null>;
  isOssLicensesAvailable(): boolean;
  openOssLicenses(): Promise<boolean>;
}

interface SecPalEnterprisePlugin {
  openOssLicenses?(): Promise<void>;
}

const secPalEnterprisePlugin =
  registerPlugin<SecPalEnterprisePlugin>("SecPalEnterprise");

function isOssLicensesAvailable(): boolean {
  return Capacitor.isPluginAvailable("SecPalEnterprise");
}

export const SecPalEnterprise: SecPalEnterpriseFacade = {
  async getEnrollment(): Promise<SecPalEnterpriseEnrollment | null> {
    return null;
  },
  isOssLicensesAvailable(): boolean {
    return isOssLicensesAvailable();
  },
  async openOssLicenses(): Promise<boolean> {
    if (
      !isOssLicensesAvailable() ||
      typeof secPalEnterprisePlugin.openOssLicenses !== "function"
    ) {
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
