// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPasskeyAssertion,
  getPasskeyAttestation,
  isConditionalMediationAvailable,
  isPasskeySupported,
  isPasskeyRegistrationSupported,
} from "./passkeyBrowser";
import type {
  PasskeyAuthenticationPublicKeyOptions,
  PasskeyRegistrationPublicKeyOptions,
} from "@/types/api";

function toArrayBuffer(value: string): ArrayBuffer {
  return Uint8Array.from(Buffer.from(value, "utf-8")).buffer;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf-8").toString("base64url");
}

const authenticationOptions: PasskeyAuthenticationPublicKeyOptions = {
  challenge: toBase64Url("challenge"),
  rp_id: "app.secpal.dev",
  timeout: 60000,
  user_verification: "preferred",
  allow_credentials: [
    {
      type: "public-key",
      id: toBase64Url("credential-id"),
      transports: ["internal", "usb"],
    },
  ],
};

describe("passkeyBrowser", () => {
  const originalSecureContext = Object.getOwnPropertyDescriptor(
    window,
    "isSecureContext"
  );
  const originalCredentials = Object.getOwnPropertyDescriptor(
    navigator,
    "credentials"
  );

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();

    if (originalSecureContext) {
      Object.defineProperty(window, "isSecureContext", originalSecureContext);
    }

    if (originalCredentials) {
      Object.defineProperty(navigator, "credentials", originalCredentials);
    } else {
      Reflect.deleteProperty(navigator, "credentials");
    }
  });

  it("detects passkey support when the secure browser APIs are available", () => {
    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: {
        get: vi.fn(),
      },
    });

    expect(isPasskeySupported()).toBe(true);
  });

  it("returns false when the browser is not in a secure context", () => {
    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: {
        get: vi.fn(),
      },
    });

    expect(isPasskeySupported()).toBe(false);
  });

  it("maps a browser assertion into the API payload", async () => {
    const getCredential = vi.fn().mockResolvedValue({
      id: "credential-id",
      rawId: toArrayBuffer("raw-id"),
      type: "public-key",
      response: {
        clientDataJSON: toArrayBuffer("client-data"),
        authenticatorData: toArrayBuffer("authenticator-data"),
        signature: toArrayBuffer("signature"),
        userHandle: toArrayBuffer("user-handle"),
      },
      getClientExtensionResults: () => ({
        credProps: { rk: true },
      }),
    } as unknown as PublicKeyCredential);

    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: {
        get: getCredential,
      },
    });

    const credential = await getPasskeyAssertion(
      authenticationOptions,
      "conditional"
    );

    expect(getCredential).toHaveBeenCalledWith(
      expect.objectContaining({
        mediation: "conditional",
        publicKey: {
          challenge: toArrayBuffer("challenge"),
          rpId: "app.secpal.dev",
          timeout: 60000,
          userVerification: "preferred",
          allowCredentials: [
            {
              type: "public-key",
              id: toArrayBuffer("credential-id"),
              transports: ["internal", "usb"],
            },
          ],
        },
      })
    );

    const callOptions = getCredential.mock.calls[0]![0]! as Record<
      string,
      unknown
    >;
    expect(callOptions).toHaveProperty("signal");
    expect(callOptions.signal).toBeDefined();
    expect((callOptions.signal as AbortSignal).aborted).toBe(false);

    expect(credential).toEqual({
      id: "credential-id",
      raw_id: toBase64Url("raw-id"),
      type: "public-key",
      response: {
        client_data_json: toBase64Url("client-data"),
        authenticator_data: toBase64Url("authenticator-data"),
        signature: toBase64Url("signature"),
        user_handle: toBase64Url("user-handle"),
      },
      client_extension_results: {
        credProps: { rk: true },
      },
    });
  });

  it("preserves a null user handle in the assertion payload", async () => {
    const getCredential = vi.fn().mockResolvedValue({
      id: "credential-id",
      rawId: toArrayBuffer("raw-id"),
      type: "public-key",
      response: {
        clientDataJSON: toArrayBuffer("client-data"),
        authenticatorData: toArrayBuffer("authenticator-data"),
        signature: toArrayBuffer("signature"),
        userHandle: null,
      },
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential);

    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: {
        get: getCredential,
      },
    });

    const credential = await getPasskeyAssertion(
      authenticationOptions,
      "required"
    );

    expect(credential.response.user_handle).toBeNull();
  });

  it("throws when the browser does not support passkeys", async () => {
    Reflect.deleteProperty(window, "PublicKeyCredential");
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: {
        get: vi.fn(),
      },
    });

    await expect(
      getPasskeyAssertion(authenticationOptions, "required")
    ).rejects.toThrow("Passkeys are not available in this browser.");
  });

  it("throws when the browser returns an invalid assertion response", async () => {
    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: {
        get: vi.fn().mockResolvedValue({
          id: "credential-id",
          rawId: toArrayBuffer("raw-id"),
          type: "public-key",
          response: {
            clientDataJSON: toArrayBuffer("client-data"),
            authenticatorData: toArrayBuffer("authenticator-data"),
          },
          getClientExtensionResults: () => ({}),
        }),
      },
    });

    await expect(
      getPasskeyAssertion(authenticationOptions, "optional")
    ).rejects.toThrow(
      "The browser returned an invalid passkey assertion response."
    );
  });

  it("filters out unknown transports and keeps only recognised ones", async () => {
    const optionsWithUnknownTransport: PasskeyAuthenticationPublicKeyOptions = {
      ...authenticationOptions,
      allow_credentials: [
        {
          type: "public-key",
          id: toBase64Url("cid"),
          // "cable" is not in KNOWN_TRANSPORTS; "internal" is
          transports: ["cable" as "internal", "internal"],
        },
      ],
    };

    const getCredential = vi.fn().mockResolvedValue({
      id: "credential-id",
      rawId: toArrayBuffer("raw-id"),
      type: "public-key",
      response: {
        clientDataJSON: toArrayBuffer("client-data"),
        authenticatorData: toArrayBuffer("authenticator-data"),
        signature: toArrayBuffer("signature"),
        userHandle: null,
      },
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential);

    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: getCredential },
    });

    await getPasskeyAssertion(optionsWithUnknownTransport, "conditional");

    const callOptions = getCredential.mock
      .calls[0]![0]! as CredentialRequestOptions;
    expect(callOptions.publicKey?.allowCredentials?.[0]?.transports).toEqual([
      "internal",
    ]);
  });

  it("omits the transports key when all provided transports are unknown", async () => {
    const optionsAllUnknown: PasskeyAuthenticationPublicKeyOptions = {
      ...authenticationOptions,
      allow_credentials: [
        {
          type: "public-key",
          id: toBase64Url("cid"),
          transports: ["cable" as "internal"],
        },
      ],
    };

    const getCredential = vi.fn().mockResolvedValue({
      id: "credential-id",
      rawId: toArrayBuffer("raw-id"),
      type: "public-key",
      response: {
        clientDataJSON: toArrayBuffer("client-data"),
        authenticatorData: toArrayBuffer("authenticator-data"),
        signature: toArrayBuffer("signature"),
        userHandle: null,
      },
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential);

    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: getCredential },
    });

    await getPasskeyAssertion(optionsAllUnknown, "conditional");

    const callOptions = getCredential.mock
      .calls[0]![0]! as CredentialRequestOptions;
    expect(callOptions.publicKey?.allowCredentials?.[0]).not.toHaveProperty(
      "transports"
    );
  });

  it("omits the mediation key when an unrecognised mediation value is provided", async () => {
    const getCredential = vi.fn().mockResolvedValue({
      id: "credential-id",
      rawId: toArrayBuffer("raw-id"),
      type: "public-key",
      response: {
        clientDataJSON: toArrayBuffer("client-data"),
        authenticatorData: toArrayBuffer("authenticator-data"),
        signature: toArrayBuffer("signature"),
        userHandle: null,
      },
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential);

    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: getCredential },
    });

    await getPasskeyAssertion(authenticationOptions, "unknown-value");

    const callOptions = getCredential.mock
      .calls[0]![0]! as CredentialRequestOptions;
    expect(callOptions).not.toHaveProperty("mediation");
  });

  it("passes through the silent mediation value", async () => {
    const getCredential = vi.fn().mockResolvedValue({
      id: "credential-id",
      rawId: toArrayBuffer("raw-id"),
      type: "public-key",
      response: {
        clientDataJSON: toArrayBuffer("client-data"),
        authenticatorData: toArrayBuffer("authenticator-data"),
        signature: toArrayBuffer("signature"),
        userHandle: null,
      },
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential);

    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: getCredential },
    });

    await getPasskeyAssertion(authenticationOptions, "silent");

    const callOptions = getCredential.mock
      .calls[0]![0]! as CredentialRequestOptions;
    expect(callOptions).toHaveProperty("mediation", "silent");
  });

  it("returns false for isPasskeyRegistrationSupported when credentials.create is absent", () => {
    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: vi.fn() },
    });

    expect(isPasskeyRegistrationSupported()).toBe(false);
  });

  it("returns true for isPasskeyRegistrationSupported when both get and create are present", () => {
    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: vi.fn(), create: vi.fn() },
    });

    expect(isPasskeyRegistrationSupported()).toBe(true);
  });

  it("omits the attestation key when an unrecognised attestation value is provided", async () => {
    const registrationOptions: PasskeyRegistrationPublicKeyOptions = {
      challenge: toBase64Url("challenge"),
      rp: { id: "app.secpal.dev", name: "SecPal" },
      user: {
        id: toBase64Url("user-id"),
        name: "test@secpal.dev",
        display_name: "Test User",
      },
      pub_key_cred_params: [{ type: "public-key", alg: -7 }],
      attestation: "unknown-value",
    };

    const createCredential = vi.fn().mockResolvedValue({
      id: "credential-id",
      rawId: toArrayBuffer("raw-id"),
      type: "public-key",
      response: {
        clientDataJSON: toArrayBuffer("client-data"),
        attestationObject: toArrayBuffer("attestation-object"),
        getTransports: () => [],
      },
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential);

    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: vi.fn(), create: createCredential },
    });

    await getPasskeyAttestation(registrationOptions);

    const callOptions = createCredential.mock
      .calls[0]![0]! as CredentialCreationOptions;
    expect(callOptions.publicKey).not.toHaveProperty("attestation");
  });

  it("passes through a known attestation value to the WebAuthn create call", async () => {
    const registrationOptions: PasskeyRegistrationPublicKeyOptions = {
      challenge: toBase64Url("challenge"),
      rp: { id: "app.secpal.dev", name: "SecPal" },
      user: {
        id: toBase64Url("user-id"),
        name: "test@secpal.dev",
        display_name: "Test User",
      },
      pub_key_cred_params: [{ type: "public-key", alg: -7 }],
      attestation: "none",
    };

    const createCredential = vi.fn().mockResolvedValue({
      id: "credential-id",
      rawId: toArrayBuffer("raw-id"),
      type: "public-key",
      response: {
        clientDataJSON: toArrayBuffer("client-data"),
        attestationObject: toArrayBuffer("attestation-object"),
        getTransports: () => [],
      },
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential);

    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: vi.fn(), create: createCredential },
    });

    await getPasskeyAttestation(registrationOptions);

    const callOptions = createCredential.mock
      .calls[0]![0]! as CredentialCreationOptions;
    expect(callOptions.publicKey).toHaveProperty("attestation", "none");
  });

  it("omits allowCredentials from the browser call when allow_credentials is empty", async () => {
    const optionsWithEmptyCredentials: PasskeyAuthenticationPublicKeyOptions = {
      ...authenticationOptions,
      allow_credentials: [],
    };

    const getCredential = vi.fn().mockResolvedValue({
      id: "credential-id",
      rawId: toArrayBuffer("raw-id"),
      type: "public-key",
      response: {
        clientDataJSON: toArrayBuffer("client-data"),
        authenticatorData: toArrayBuffer("authenticator-data"),
        signature: toArrayBuffer("signature"),
        userHandle: null,
      },
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential);

    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: getCredential },
    });

    await getPasskeyAssertion(optionsWithEmptyCredentials, "conditional");

    const callOptions = getCredential.mock
      .calls[0]![0]! as CredentialRequestOptions;
    expect(callOptions.publicKey).not.toHaveProperty("allowCredentials");
  });

  it("omits allowCredentials from the browser call when allow_credentials is undefined", async () => {
    const optionsWithoutCredentials: PasskeyAuthenticationPublicKeyOptions = {
      challenge: toBase64Url("challenge"),
      rp_id: "app.secpal.dev",
      timeout: 60000,
      user_verification: "preferred",
    };

    const getCredential = vi.fn().mockResolvedValue({
      id: "credential-id",
      rawId: toArrayBuffer("raw-id"),
      type: "public-key",
      response: {
        clientDataJSON: toArrayBuffer("client-data"),
        authenticatorData: toArrayBuffer("authenticator-data"),
        signature: toArrayBuffer("signature"),
        userHandle: null,
      },
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential);

    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: getCredential },
    });

    await getPasskeyAssertion(optionsWithoutCredentials, "optional");

    const callOptions = getCredential.mock
      .calls[0]![0]! as CredentialRequestOptions;
    expect(callOptions.publicKey).not.toHaveProperty("allowCredentials");
  });

  it("returns true for isConditionalMediationAvailable when the browser supports it", async () => {
    vi.stubGlobal("PublicKeyCredential", {
      isConditionalMediationAvailable: vi.fn().mockResolvedValue(true),
    });

    expect(await isConditionalMediationAvailable()).toBe(true);
  });

  it("returns false for isConditionalMediationAvailable when the method is absent", async () => {
    vi.stubGlobal("PublicKeyCredential", {});

    expect(await isConditionalMediationAvailable()).toBe(false);
  });

  it("returns false for isConditionalMediationAvailable when PublicKeyCredential is undefined", async () => {
    Reflect.deleteProperty(window, "PublicKeyCredential");

    expect(await isConditionalMediationAvailable()).toBe(false);
  });

  it("returns false for isConditionalMediationAvailable when the check throws", async () => {
    vi.stubGlobal("PublicKeyCredential", {
      isConditionalMediationAvailable: vi
        .fn()
        .mockRejectedValue(new Error("not supported")),
    });

    expect(await isConditionalMediationAvailable()).toBe(false);
  });

  it("strips null authenticatorAttachment from the registration options", async () => {
    const registrationOptions: PasskeyRegistrationPublicKeyOptions = {
      challenge: toBase64Url("challenge"),
      rp: { id: "app.secpal.dev", name: "SecPal" },
      user: {
        id: toBase64Url("user-id"),
        name: "test@secpal.dev",
        display_name: "Test User",
      },
      pub_key_cred_params: [{ type: "public-key", alg: -7 }],
      attestation: "none",
      authenticator_selection: {
        authenticator_attachment: null as unknown as "platform",
        resident_key: "preferred",
        require_resident_key: false,
        user_verification: "preferred",
      },
    };

    const createCredential = vi.fn().mockResolvedValue({
      id: "credential-id",
      rawId: toArrayBuffer("raw-id"),
      type: "public-key",
      response: {
        clientDataJSON: toArrayBuffer("client-data"),
        attestationObject: toArrayBuffer("attestation-object"),
        getTransports: () => [],
      },
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential);

    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: vi.fn(), create: createCredential },
    });

    await getPasskeyAttestation(registrationOptions);

    const callOptions = createCredential.mock
      .calls[0]![0]! as CredentialCreationOptions;
    expect(callOptions.publicKey?.authenticatorSelection).toBeDefined();
    expect(callOptions.publicKey?.authenticatorSelection).not.toHaveProperty(
      "authenticatorAttachment"
    );
    expect(callOptions.publicKey?.authenticatorSelection).not.toHaveProperty(
      "requireResidentKey"
    );
    expect(callOptions.publicKey?.authenticatorSelection?.residentKey).toBe(
      "preferred"
    );
  });

  it("passes requireResidentKey through only when the server explicitly requires it", async () => {
    const registrationOptions: PasskeyRegistrationPublicKeyOptions = {
      challenge: toBase64Url("challenge"),
      rp: { id: "app.secpal.dev", name: "SecPal" },
      user: {
        id: toBase64Url("user-id"),
        name: "test@secpal.dev",
        display_name: "Test User",
      },
      pub_key_cred_params: [{ type: "public-key", alg: -7 }],
      attestation: "none",
      authenticator_selection: {
        resident_key: "required",
        require_resident_key: true,
        user_verification: "preferred",
      },
    };

    const createCredential = vi.fn().mockResolvedValue({
      id: "credential-id",
      rawId: toArrayBuffer("raw-id"),
      type: "public-key",
      response: {
        clientDataJSON: toArrayBuffer("client-data"),
        attestationObject: toArrayBuffer("attestation-object"),
        getTransports: () => [],
      },
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential);

    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: vi.fn(), create: createCredential },
    });

    await getPasskeyAttestation(registrationOptions);

    const callOptions = createCredential.mock
      .calls[0]![0]! as CredentialCreationOptions;
    expect(callOptions.publicKey?.authenticatorSelection).toHaveProperty(
      "requireResidentKey",
      true
    );
  });

  it("only picks id and name from rp, excluding icon and other fields", async () => {
    const registrationOptions: PasskeyRegistrationPublicKeyOptions = {
      challenge: toBase64Url("challenge"),
      rp: {
        id: "app.secpal.dev",
        name: "SecPal",
        icon: null as unknown as string,
      } as PasskeyRegistrationPublicKeyOptions["rp"],
      user: {
        id: toBase64Url("user-id"),
        name: "test@secpal.dev",
        display_name: "Test User",
      },
      pub_key_cred_params: [{ type: "public-key", alg: -7 }],
      attestation: "none",
    };

    const createCredential = vi.fn().mockResolvedValue({
      id: "credential-id",
      rawId: toArrayBuffer("raw-id"),
      type: "public-key",
      response: {
        clientDataJSON: toArrayBuffer("client-data"),
        attestationObject: toArrayBuffer("attestation-object"),
        getTransports: () => [],
      },
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential);

    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: vi.fn(), create: createCredential },
    });

    await getPasskeyAttestation(registrationOptions);

    const callOptions = createCredential.mock
      .calls[0]![0]! as CredentialCreationOptions;
    expect(callOptions.publicKey?.rp).toEqual({
      id: "app.secpal.dev",
      name: "SecPal",
    });
    expect(callOptions.publicKey?.rp).not.toHaveProperty("icon");
  });

  it("omits excludeCredentials from the registration call when exclude_credentials is empty", async () => {
    const registrationOptions: PasskeyRegistrationPublicKeyOptions = {
      challenge: toBase64Url("challenge"),
      rp: { id: "app.secpal.dev", name: "SecPal" },
      user: {
        id: toBase64Url("user-id"),
        name: "test@secpal.dev",
        display_name: "Test User",
      },
      pub_key_cred_params: [{ type: "public-key", alg: -7 }],
      attestation: "none",
      exclude_credentials: [],
    };

    const createCredential = vi.fn().mockResolvedValue({
      id: "credential-id",
      rawId: toArrayBuffer("raw-id"),
      type: "public-key",
      response: {
        clientDataJSON: toArrayBuffer("client-data"),
        attestationObject: toArrayBuffer("attestation-object"),
        getTransports: () => [],
      },
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential);

    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: vi.fn(), create: createCredential },
    });

    await getPasskeyAttestation(registrationOptions);

    const callOptions = createCredential.mock
      .calls[0]![0]! as CredentialCreationOptions;
    expect(callOptions.publicKey).not.toHaveProperty("excludeCredentials");
  });

  it("passes an AbortSignal to navigator.credentials.create during attestation", async () => {
    const registrationOptions: PasskeyRegistrationPublicKeyOptions = {
      challenge: toBase64Url("challenge"),
      rp: { id: "app.secpal.dev", name: "SecPal" },
      user: {
        id: toBase64Url("user-id"),
        name: "test@secpal.dev",
        display_name: "Test User",
      },
      pub_key_cred_params: [{ type: "public-key", alg: -7 }],
      attestation: "none",
      timeout: 30000,
    };

    const createCredential = vi.fn().mockResolvedValue({
      id: "credential-id",
      rawId: toArrayBuffer("raw-id"),
      type: "public-key",
      response: {
        clientDataJSON: toArrayBuffer("client-data"),
        attestationObject: toArrayBuffer("attestation-object"),
        getTransports: () => [],
      },
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential);

    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: vi.fn(), create: createCredential },
    });

    await getPasskeyAttestation(registrationOptions);

    const callOptions = createCredential.mock.calls[0]![0]! as Record<
      string,
      unknown
    >;
    expect(callOptions).toHaveProperty("signal");
    expect(callOptions.signal).toBeDefined();
    expect((callOptions.signal as AbortSignal).aborted).toBe(false);
  });

  it("times out attestation and aborts the browser request after the wrapper timeout", async () => {
    vi.useFakeTimers();

    const registrationOptions: PasskeyRegistrationPublicKeyOptions = {
      challenge: toBase64Url("challenge"),
      rp: { id: "app.secpal.dev", name: "SecPal" },
      user: {
        id: toBase64Url("user-id"),
        name: "test@secpal.dev",
        display_name: "Test User",
      },
      pub_key_cred_params: [{ type: "public-key", alg: -7 }],
      attestation: "none",
      timeout: 25_000,
    };

    const createCredential = vi.fn((options: CredentialCreationOptions) => {
      void options;
      return new Promise<PublicKeyCredential | null>(() => {});
    });

    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: vi.fn(), create: createCredential },
    });

    const promise = getPasskeyAttestation(registrationOptions);
    const callOptions = createCredential.mock.calls[0]![0]! as Record<
      string,
      unknown
    >;
    const signal = callOptions.signal as AbortSignal;
    const expectation = expect(promise).rejects.toMatchObject({
      name: "AbortError",
    });
    let settled = false;
    promise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );

    expect(signal.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(20_001);
    expect(signal.aborted).toBe(false);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(10_000);

    await expectation;

    expect(signal.aborted).toBe(true);

    vi.useRealTimers();
  });

  it("passes an AbortSignal to navigator.credentials.get during assertion", async () => {
    const getCredential = vi.fn().mockResolvedValue({
      id: "credential-id",
      rawId: toArrayBuffer("raw-id"),
      type: "public-key",
      response: {
        clientDataJSON: toArrayBuffer("client-data"),
        authenticatorData: toArrayBuffer("authenticator-data"),
        signature: toArrayBuffer("signature"),
        userHandle: null,
      },
      getClientExtensionResults: () => ({}),
    } as unknown as PublicKeyCredential);

    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: getCredential },
    });

    await getPasskeyAssertion(authenticationOptions, "required");

    const callOptions = getCredential.mock.calls[0]![0]! as Record<
      string,
      unknown
    >;
    expect(callOptions).toHaveProperty("signal");
    expect(callOptions.signal).toBeDefined();
    expect((callOptions.signal as AbortSignal).aborted).toBe(false);
  });

  it("times out assertion and aborts the browser request after the wrapper timeout", async () => {
    vi.useFakeTimers();

    const getCredential = vi.fn((options: CredentialRequestOptions) => {
      void options;
      return new Promise<PublicKeyCredential | null>(() => {});
    });

    vi.stubGlobal("PublicKeyCredential", class PublicKeyCredentialMock {});
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: getCredential },
    });

    const promise = getPasskeyAssertion(
      {
        ...authenticationOptions,
        timeout: 25_000,
      },
      "required"
    );
    const callOptions = getCredential.mock.calls[0]![0]! as Record<
      string,
      unknown
    >;
    const signal = callOptions.signal as AbortSignal;
    const expectation = expect(promise).rejects.toMatchObject({
      name: "AbortError",
    });
    let settled = false;
    promise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    expect(signal.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(20_001);
    expect(signal.aborted).toBe(false);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(10_000);

    await expectation;

    expect(signal.aborted).toBe(true);

    vi.useRealTimers();
  });
});
