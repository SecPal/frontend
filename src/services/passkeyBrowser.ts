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

function normalizeAttestation(
  value: string | undefined
): AttestationConveyancePreference | undefined {
  switch (value) {
    case "direct":
    case "enterprise":
    case "indirect":
    case "none":
      return value;
    default:
      return undefined;
  }
}

function createAuthenticationOptions(
  options: PasskeyAuthenticationPublicKeyOptions,
  mediation: string
): CredentialRequestOptions {
  const normalizedMediation = normalizeMediation(mediation);
  const mappedCredentials = options.allow_credentials?.length
    ? options.allow_credentials.map(mapDescriptor)
    : undefined;

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
      ...(mappedCredentials !== undefined
        ? { allowCredentials: mappedCredentials }
        : {}),
    },
  };
}

function buildAuthenticatorSelection(
  selection: NonNullable<
    PasskeyRegistrationPublicKeyOptions["authenticator_selection"]
  >
): AuthenticatorSelectionCriteria {
  const result: AuthenticatorSelectionCriteria = {};

  if (
    selection.authenticator_attachment === "platform" ||
    selection.authenticator_attachment === "cross-platform"
  ) {
    result.authenticatorAttachment = selection.authenticator_attachment;
  }

  if (selection.resident_key) {
    result.residentKey = selection.resident_key;
  }

  if (selection.require_resident_key === true) {
    result.requireResidentKey = selection.require_resident_key;
  }

  if (selection.user_verification) {
    result.userVerification = selection.user_verification;
  }

  return result;
}

function createRegistrationOptions(
  options: PasskeyRegistrationPublicKeyOptions
): CredentialCreationOptions {
  const authenticatorSelection = options.authenticator_selection
    ? buildAuthenticatorSelection(options.authenticator_selection)
    : undefined;

  const attestation = normalizeAttestation(options.attestation);

  const mappedExcludeCredentials = options.exclude_credentials?.length
    ? options.exclude_credentials.map(mapDescriptor)
    : undefined;

  return {
    publicKey: {
      challenge: fromBase64Url(options.challenge),
      rp: { id: options.rp.id, name: options.rp.name },
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
      ...(mappedExcludeCredentials !== undefined
        ? { excludeCredentials: mappedExcludeCredentials }
        : {}),
      ...(authenticatorSelection !== undefined
        ? { authenticatorSelection }
        : {}),
      ...(attestation !== undefined ? { attestation } : {}),
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

async function awaitCredentialOperation<T>(
  operation: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void
): Promise<T> {
  let timeoutId: number;

  // Observe independently for diagnostics — does not affect Promise.race.
  operation.then(
    () => {
      console.info("[SecPal] awaitCredentialOperation: promise resolved");
    },
    (error: unknown) => {
      console.info(
        "[SecPal] awaitCredentialOperation: promise rejected:",
        error
      );
    }
  );

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      console.info(
        "[SecPal] awaitCredentialOperation: safety timeout at %dms",
        timeoutMs
      );
      reject(new DOMException("The operation was aborted.", "AbortError"));

      if (onTimeout) {
        Promise.resolve().then(() => {
          console.info(
            "[SecPal] awaitCredentialOperation: aborting underlying browser request after timeout"
          );
          onTimeout();
        });
      }
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    window.clearTimeout(timeoutId!);
  }
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

export function isPasskeyRegistrationSupported(): boolean {
  return (
    isPasskeySupported() && typeof navigator.credentials?.create === "function"
  );
}

export async function isConditionalMediationAvailable(): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    typeof window.PublicKeyCredential === "undefined"
  ) {
    return false;
  }

  if (
    typeof PublicKeyCredential.isConditionalMediationAvailable !== "function"
  ) {
    return false;
  }

  try {
    return await PublicKeyCredential.isConditionalMediationAvailable();
  } catch {
    return false;
  }
}

export async function getPasskeyAssertion(
  options: PasskeyAuthenticationPublicKeyOptions,
  mediation: string
): Promise<PasskeyAuthenticationCredential> {
  assertPasskeySupport();

  const requestOptions = createAuthenticationOptions(options, mediation);

  const webAuthnTimeout = options.timeout ?? 60_000;
  const safetyTimeout = webAuthnTimeout + 5_000;

  console.info(
    "[SecPal] Passkey assertion: calling navigator.credentials.get() with mediation=%s, rpId=%s, allowCredentials=%d, webAuthnTimeout=%dms, wrapperTimeout=%dms",
    mediation,
    options.rp_id,
    options.allow_credentials?.length ?? 0,
    webAuthnTimeout,
    safetyTimeout
  );

  const abortController = new AbortController();

  let credential: Credential | null;
  try {
    credential = await awaitCredentialOperation(
      navigator.credentials.get({
        ...requestOptions,
        signal: abortController.signal,
      }),
      safetyTimeout,
      () => abortController.abort()
    );
    console.info("[SecPal] Passkey assertion: browser returned credential");
  } catch (error) {
    console.error("[SecPal] Passkey assertion: browser rejected", error);
    throw error;
  }

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

  const creationOptions = createRegistrationOptions(options);

  const webAuthnTimeout = options.timeout ?? 60_000;
  const safetyTimeout = webAuthnTimeout + 5_000;

  console.info(
    "[SecPal] Passkey attestation: calling navigator.credentials.create() with rpId=%s, excludeCredentials=%d, webAuthnTimeout=%dms, wrapperTimeout=%dms",
    options.rp.id,
    options.exclude_credentials?.length ?? 0,
    webAuthnTimeout,
    safetyTimeout
  );

  const abortController = new AbortController();

  let credential: Credential | null;
  try {
    credential = await awaitCredentialOperation(
      navigator.credentials.create({
        ...creationOptions,
        signal: abortController.signal,
      }),
      safetyTimeout,
      () => abortController.abort()
    );
    console.info("[SecPal] Passkey attestation: browser returned credential");
  } catch (error) {
    console.error("[SecPal] Passkey attestation: browser rejected", error);
    throw error;
  }

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
