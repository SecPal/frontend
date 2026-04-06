// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  PasskeyAttestationResponsePayload,
  PasskeyAssertionResponsePayload,
  PasskeyAuthenticationCredential,
  PasskeyAuthenticationPublicKeyOptions,
  PasskeyCredentialDescriptor,
  PasskeyRegistrationCredential,
  PasskeyRegistrationPublicKeyOptions,
  PasskeyTransport,
} from "@/types/api";

function toBase64Url(value: ArrayBuffer | ArrayBufferView): string {
  const bytes =
    value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding =
    normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + padding);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return bytes.buffer;
}

const KNOWN_TRANSPORTS = new Set<AuthenticatorTransport>([
  "ble",
  "hybrid",
  "internal",
  "nfc",
  "usb",
]);

function toAuthenticatorTransports(
  transports: PasskeyCredentialDescriptor["transports"]
): AuthenticatorTransport[] | undefined {
  if (!transports?.length) {
    return undefined;
  }

  const filtered = transports.filter((t): t is AuthenticatorTransport =>
    KNOWN_TRANSPORTS.has(t as AuthenticatorTransport)
  );

  return filtered.length > 0 ? filtered : undefined;
}

function mapDescriptor(
  descriptor: PasskeyCredentialDescriptor
): globalThis.PublicKeyCredentialDescriptor {
  const transports = toAuthenticatorTransports(descriptor.transports);

  return {
    type: descriptor.type,
    id: fromBase64Url(descriptor.id),
    ...(transports ? { transports } : {}),
  };
}

function normalizeMediation(
  mediation: string
): CredentialMediationRequirement | undefined {
  const normalized = mediation.trim();

  switch (normalized) {
    case "conditional":
    case "optional":
    case "required":
    case "silent":
      return normalized;
    default:
      return undefined;
  }
}

function createAuthenticationOptions(
  options: PasskeyAuthenticationPublicKeyOptions,
  mediation: string
): CredentialRequestOptions {
  const normalizedMediation = normalizeMediation(mediation);

  return {
    ...(normalizedMediation !== undefined
      ? { mediation: normalizedMediation }
      : {}),
    publicKey: {
      challenge: fromBase64Url(options.challenge),
      rpId: options.rp_id,
      timeout: options.timeout,
      userVerification: options.user_verification as
        | UserVerificationRequirement
        | undefined,
      allowCredentials: options.allow_credentials?.map(mapDescriptor),
    },
  };
}

function createRegistrationOptions(
  options: PasskeyRegistrationPublicKeyOptions
): CredentialCreationOptions {
  const authenticatorSelection = options.authenticator_selection
    ? {
        authenticatorAttachment:
          options.authenticator_selection.authenticator_attachment,
        residentKey: options.authenticator_selection.resident_key,
        requireResidentKey:
          options.authenticator_selection.require_resident_key,
        userVerification: options.authenticator_selection.user_verification,
      }
    : undefined;

  return {
    publicKey: {
      challenge: fromBase64Url(options.challenge),
      rp: options.rp,
      user: {
        id: fromBase64Url(options.user.id),
        name: options.user.name,
        displayName: options.user.display_name,
      },
      pubKeyCredParams: options.pub_key_cred_params.map((parameter) => ({
        type: parameter.type,
        alg: parameter.alg,
      })),
      timeout: options.timeout,
      excludeCredentials: options.exclude_credentials?.map(mapDescriptor),
      authenticatorSelection,
      attestation: options.attestation as
        | AttestationConveyancePreference
        | undefined,
    },
  };
}

function normalizeExtensionResults(
  credential: PublicKeyCredential
): Record<string, unknown> {
  return {
    ...credential.getClientExtensionResults(),
  };
}

function assertPasskeySupport(): void {
  if (!isPasskeySupported()) {
    throw new Error("Passkeys are not available in this browser.");
  }
}

function encodeUserHandle(
  userHandle: ArrayBuffer | null
): string | null | undefined {
  return userHandle ? toBase64Url(userHandle) : null;
}

export function isPasskeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.credentials?.get === "function"
  );
}

export async function getPasskeyAssertion(
  options: PasskeyAuthenticationPublicKeyOptions,
  mediation: string
): Promise<PasskeyAuthenticationCredential> {
  assertPasskeySupport();

  const credential = await navigator.credentials.get(
    createAuthenticationOptions(options, mediation)
  );

  if (
    !credential ||
    typeof credential !== "object" ||
    !("rawId" in credential) ||
    !("response" in credential)
  ) {
    throw new Error("The browser did not return a passkey assertion.");
  }

  const publicKeyCredential = credential as PublicKeyCredential;
  const response = publicKeyCredential.response;

  if (
    !response ||
    !("clientDataJSON" in response) ||
    !("authenticatorData" in response) ||
    !("signature" in response)
  ) {
    throw new Error(
      "The browser returned an invalid passkey assertion response."
    );
  }

  const assertionResponse = response as AuthenticatorAssertionResponse;
  const payload: PasskeyAssertionResponsePayload = {
    client_data_json: toBase64Url(assertionResponse.clientDataJSON),
    authenticator_data: toBase64Url(assertionResponse.authenticatorData),
    signature: toBase64Url(assertionResponse.signature),
  };

  const userHandle = encodeUserHandle(assertionResponse.userHandle);

  if (userHandle !== undefined) {
    payload.user_handle = userHandle;
  }

  return {
    id: publicKeyCredential.id,
    raw_id: toBase64Url(publicKeyCredential.rawId),
    type: "public-key",
    response: payload,
    client_extension_results: normalizeExtensionResults(publicKeyCredential),
  };
}

export async function getPasskeyAttestation(
  options: PasskeyRegistrationPublicKeyOptions
): Promise<PasskeyRegistrationCredential> {
  assertPasskeySupport();

  if (typeof navigator.credentials?.create !== "function") {
    throw new Error("Passkeys are not available in this browser.");
  }

  const credential = await navigator.credentials.create(
    createRegistrationOptions(options)
  );

  if (
    !credential ||
    typeof credential !== "object" ||
    !("rawId" in credential) ||
    !("response" in credential)
  ) {
    throw new Error("The browser did not return a passkey attestation.");
  }

  const publicKeyCredential = credential as PublicKeyCredential;
  const response = publicKeyCredential.response;

  if (
    !response ||
    !("clientDataJSON" in response) ||
    !("attestationObject" in response)
  ) {
    throw new Error(
      "The browser returned an invalid passkey attestation response."
    );
  }

  const attestationResponse = response as AuthenticatorAttestationResponse;
  const transports =
    typeof attestationResponse.getTransports === "function"
      ? attestationResponse
          .getTransports()
          .filter((transport): transport is PasskeyTransport =>
            KNOWN_TRANSPORTS.has(transport as AuthenticatorTransport)
          )
      : undefined;
  const payload: PasskeyAttestationResponsePayload = {
    client_data_json: toBase64Url(attestationResponse.clientDataJSON),
    attestation_object: toBase64Url(attestationResponse.attestationObject),
    ...(transports?.length ? { transports } : {}),
  };

  return {
    id: publicKeyCredential.id,
    raw_id: toBase64Url(publicKeyCredential.rawId),
    type: "public-key",
    response: payload,
    client_extension_results: normalizeExtensionResults(publicKeyCredential),
  };
}
