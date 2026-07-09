// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type { NativeRuntimeBootstrap } from "../types/api/bootstrap";

export interface SecPalRuntimeInfo {
  readonly clientPlatform: "android";
  readonly appVersion: string;
  readonly appBuild: number;
}

export interface SecPalRuntimeBootstrapFacade {
  getRuntimeInfo(): Promise<SecPalRuntimeInfo | null>;
  setRuntimeBootstrap(bootstrap: NativeRuntimeBootstrap): Promise<void>;
  clearRuntimeBootstrap(): Promise<void>;
}

export const SecPalRuntimeBootstrap: SecPalRuntimeBootstrapFacade = {
  async getRuntimeInfo(): Promise<SecPalRuntimeInfo | null> {
    return null;
  },
  async setRuntimeBootstrap(
    bootstrap: NativeRuntimeBootstrap
  ): Promise<void> {
    void bootstrap;

    return undefined;
  },
  async clearRuntimeBootstrap(): Promise<void> {
    return undefined;
  },
};
