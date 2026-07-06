// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

export interface SecPalPushRegistration {
  readonly installationId: string;
  readonly token?: string;
}

export interface SecPalPushFacade {
  getRegistration(): Promise<SecPalPushRegistration | null>;
}

export const SecPalPush: SecPalPushFacade = {
  async getRegistration(): Promise<SecPalPushRegistration | null> {
    return null;
  },
};
