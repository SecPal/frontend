// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { isCapacitorNativeRuntime } from "./nativeRuntime";

interface NativeVaultWrapOptions {
  rootKeyBase64: string;
  subjectHash: string;
}

interface NativeVaultUnwrapOptions {
  wrappedRootKey: string;
  subjectHash: string;
  metadata?: string;
}

interface NativeVaultWrapResult {
  wrappedRootKey: string;
  metadata?: string;
}

interface NativeVaultUnwrapResult {
  rootKeyBase64: string;
}

interface NativeDeviceBoundVaultBridge {
  isVaultDeviceBoundWrapperAvailable?: () => boolean | Promise<boolean>;
  wrapVaultRootKey?: (
    options: NativeVaultWrapOptions
  ) => NativeVaultWrapResult | Promise<NativeVaultWrapResult>;
  unwrapVaultRootKey?: (
    options: NativeVaultUnwrapOptions
  ) => NativeVaultUnwrapResult | Promise<NativeVaultUnwrapResult>;
}

function isNativeDeviceBoundVaultBridge(
  value: unknown
): value is NativeDeviceBoundVaultBridge {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.isVaultDeviceBoundWrapperAvailable === "function" &&
    typeof candidate.wrapVaultRootKey === "function" &&
    typeof candidate.unwrapVaultRootKey === "function"
  );
}

async function getNativeDeviceBoundVaultBridge(): Promise<NativeDeviceBoundVaultBridge | null> {
  if (!isCapacitorNativeRuntime()) {
    return null;
  }

  const candidate = (
    globalThis as typeof globalThis & {
      SecPalNativeAuthBridge?: unknown;
    }
  ).SecPalNativeAuthBridge;

  if (!isNativeDeviceBoundVaultBridge(candidate)) {
    return null;
  }

  try {
    return (await candidate.isVaultDeviceBoundWrapperAvailable?.()) === true
      ? candidate
      : null;
  } catch (error) {
    console.warn(
      "[Offline Vault] Failed to detect native device-bound wrapper availability:",
      error
    );
    return null;
  }
}

export async function hasNativeDeviceBoundVaultWrapper(): Promise<boolean> {
  return (await getNativeDeviceBoundVaultBridge()) !== null;
}

export async function wrapVaultRootKeyWithNativeDeviceBoundWrapper(
  options: NativeVaultWrapOptions
): Promise<NativeVaultWrapResult | null> {
  const bridge = await getNativeDeviceBoundVaultBridge();

  if (!bridge) {
    return null;
  }

  try {
    const result = await bridge.wrapVaultRootKey?.(options);

    if (
      !result ||
      typeof result.wrappedRootKey !== "string" ||
      result.wrappedRootKey.length === 0
    ) {
      return null;
    }

    if (result.metadata !== undefined && typeof result.metadata !== "string") {
      return null;
    }

    return result;
  } catch (error) {
    console.warn(
      "[Offline Vault] Failed to wrap the vault root key with the native device-bound wrapper:",
      error
    );
    return null;
  }
}

export async function unwrapVaultRootKeyWithNativeDeviceBoundWrapper(
  options: NativeVaultUnwrapOptions
): Promise<string | null> {
  const bridge = await getNativeDeviceBoundVaultBridge();

  if (!bridge) {
    return null;
  }

  try {
    const result = await bridge.unwrapVaultRootKey?.(options);

    if (
      !result ||
      typeof result.rootKeyBase64 !== "string" ||
      result.rootKeyBase64.length === 0
    ) {
      return null;
    }

    return result.rootKeyBase64;
  } catch (error) {
    console.warn(
      "[Offline Vault] Failed to unwrap the vault root key with the native device-bound wrapper:",
      error
    );
    return null;
  }
}
