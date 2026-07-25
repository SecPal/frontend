// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { Capacitor, registerPlugin } from "@capacitor/core";

export interface SecPalEnterpriseFacade {
  isOssLicensesAvailable(): boolean;
  openOssLicenses(): Promise<boolean>;
}

interface SecPalEnterprisePlugin {
  openOssLicenses?(): Promise<void>;
}

interface CapacitorPluginHeader {
  readonly name: string;
  readonly methods: readonly { readonly name: string }[];
}

const secPalEnterprisePlugin =
  registerPlugin<SecPalEnterprisePlugin>("SecPalEnterprise");

function isOssLicensesAvailable(): boolean {
  const pluginHeaders = (
    Capacitor as typeof Capacitor & {
      PluginHeaders?: readonly CapacitorPluginHeader[];
    }
  ).PluginHeaders;

  return (
    Capacitor.isPluginAvailable("SecPalEnterprise") &&
    pluginHeaders?.some(
      (header) =>
        header.name === "SecPalEnterprise" &&
        header.methods.some((method) => method.name === "openOssLicenses")
    ) === true
  );
}

export const SecPalEnterprise: SecPalEnterpriseFacade = {
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
