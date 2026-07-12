// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

export interface NativePasskeyCapabilities {
  readonly passkeysAvailable: boolean;
  readonly reason?: string;
}

interface NativePasskeyCapabilitiesBridge {
  getPasskeyCapabilities?(): Promise<NativePasskeyCapabilities>;
}

const NATIVE_PASSKEY_CAPABILITY_TIMEOUT_MS = 5_000;

function isNativePasskeyCapabilities(
  value: unknown
): value is NativePasskeyCapabilities {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.passkeysAvailable === "boolean" &&
    (candidate.reason === undefined || typeof candidate.reason === "string")
  );
}

export function hasNativePasskeyCapabilityBridge(): boolean {
  const bridge = (
    globalThis as typeof globalThis & {
      SecPalNativeAuthBridge?: NativePasskeyCapabilitiesBridge;
    }
  ).SecPalNativeAuthBridge;

  return typeof bridge?.getPasskeyCapabilities === "function";
}

export async function getNativePasskeyCapabilities(): Promise<NativePasskeyCapabilities | null> {
  const bridge = (
    globalThis as typeof globalThis & {
      SecPalNativeAuthBridge?: NativePasskeyCapabilitiesBridge;
    }
  ).SecPalNativeAuthBridge;

  if (typeof bridge?.getPasskeyCapabilities !== "function") {
    return null;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Native passkey capability request timed out"));
    }, NATIVE_PASSKEY_CAPABILITY_TIMEOUT_MS);
  });

  let capabilities: unknown;

  try {
    capabilities = await Promise.race([
      bridge.getPasskeyCapabilities(),
      timeout,
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }

  if (!isNativePasskeyCapabilities(capabilities)) {
    throw new Error("Native passkey capability response is invalid");
  }

  return capabilities;
}
