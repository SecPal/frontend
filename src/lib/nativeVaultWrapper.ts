// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { isCapacitorNativeRuntime } from "./nativeRuntime";

type NativeDeviceBoundVaultBridge = {
    isVaultDeviceBoundWrapperAvailable?: () => boolean | Promise<boolean>;
    wrapVaultRootKey?: (
        options: { rootKeyBase64: string; subjectHash: string }
    ) =>
        | { wrappedRootKey: string; metadata?: string }
        | Promise<{ wrappedRootKey: string; metadata?: string }>;
    unwrapVaultRootKey?: (
        options: { wrappedRootKey: string; subjectHash: string; metadata?: string }
    ) => { rootKeyBase64: string } | Promise<{ rootKeyBase64: string }>;
};

function getNativeDeviceBoundVaultBridgeCandidate(): NativeDeviceBoundVaultBridge | null {
    if (!isCapacitorNativeRuntime()) {
        return null;
    }

    const bridge = (
        globalThis as typeof globalThis & {
            SecPalNativeAuthBridge?: unknown;
        }
    ).SecPalNativeAuthBridge;

    if (!bridge || typeof bridge !== "object") {
        return null;
    }

    const candidate = bridge as NativeDeviceBoundVaultBridge;

    return typeof candidate.isVaultDeviceBoundWrapperAvailable === "function" &&
        typeof candidate.wrapVaultRootKey === "function" &&
        typeof candidate.unwrapVaultRootKey === "function"
        ? candidate
        : null;
}

async function getNativeDeviceBoundVaultBridge(): Promise<NativeDeviceBoundVaultBridge | null> {
    const candidate = getNativeDeviceBoundVaultBridgeCandidate();

    if (!candidate) {
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
    options: { rootKeyBase64: string; subjectHash: string }
): Promise<{ wrappedRootKey: string; metadata?: string } | null> {
    const bridge = await getNativeDeviceBoundVaultBridge();

    if (!bridge) {
        return null;
    }

    try {
        const result = await bridge.wrapVaultRootKey?.(options);

        if (
            !result ||
            typeof result.wrappedRootKey !== "string" ||
            result.wrappedRootKey.length === 0 ||
            (result.metadata !== undefined && typeof result.metadata !== "string")
        ) {
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
    options: { wrappedRootKey: string; subjectHash: string; metadata?: string }
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
