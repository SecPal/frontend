// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

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

function getEnterprisePlugin(): SecPalEnterprisePlugin | null {
  const capacitor = (
    globalThis as typeof globalThis & {
      Capacitor?: { Plugins?: { SecPalEnterprise?: unknown } };
    }
  ).Capacitor;
  const plugin = capacitor?.Plugins?.SecPalEnterprise;

  if (typeof plugin !== "object" || plugin === null) {
    return null;
  }

  return plugin as SecPalEnterprisePlugin;
}

export const SecPalEnterprise: SecPalEnterpriseFacade = {
  async getEnrollment(): Promise<SecPalEnterpriseEnrollment | null> {
    return null;
  },
  async openOssLicenses(): Promise<boolean> {
    const plugin = getEnterprisePlugin();

    if (typeof plugin?.openOssLicenses !== "function") {
      return false;
    }

    await plugin.openOssLicenses();
    return true;
  },
};
