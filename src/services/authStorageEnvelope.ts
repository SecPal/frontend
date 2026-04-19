// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

export interface AuthStorageEnvelopeMacPayloadInput {
    scheme: string;
    version: number;
    salt: string;
    iv: string;
    ciphertext: string;
}

export function buildEnvelopeMacPayload(
    envelope: AuthStorageEnvelopeMacPayloadInput
): string {
    return [
        envelope.scheme,
        String(envelope.version),
        envelope.salt,
        envelope.iv,
        envelope.ciphertext,
    ].join(".");
}
