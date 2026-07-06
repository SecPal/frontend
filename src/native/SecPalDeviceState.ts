// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

export type SecPalDevicePlatform = "android" | "ios";

export interface SecPalDeviceStateSnapshot {
  readonly platform: SecPalDevicePlatform;
  readonly appVersion?: string;
  readonly buildNumber?: string;
}

export interface SecPalDeviceStateFacade {
  getSnapshot(): Promise<SecPalDeviceStateSnapshot | null>;
}

export const SecPalDeviceState: SecPalDeviceStateFacade = {
  async getSnapshot(): Promise<SecPalDeviceStateSnapshot | null> {
    return null;
  },
};
