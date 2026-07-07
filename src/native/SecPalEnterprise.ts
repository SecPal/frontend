// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

export interface SecPalEnterpriseEnrollment {
  readonly tenantId: string;
  readonly managedBy?: string;
}

export interface SecPalEnterpriseFacade {
  getEnrollment(): Promise<SecPalEnterpriseEnrollment | null>;
}

export const SecPalEnterprise: SecPalEnterpriseFacade = {
  async getEnrollment(): Promise<SecPalEnterpriseEnrollment | null> {
    return null;
  },
};
