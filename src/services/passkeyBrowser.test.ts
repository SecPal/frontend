// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPasskeyAssertion, isPasskeySupported } from "./passkeyBrowser";
import type { PasskeyAuthenticationPublicKeyOptions } from "@/types/api";

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

    expect(getCredential).toHaveBeenCalledWith({
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
    });

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
});
