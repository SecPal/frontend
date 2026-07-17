// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it, vi } from "vitest";

import {
  RuntimeDiscoveryError,
  discoverAndroidRuntimeBootstrap,
} from "./runtimeDiscovery";
import type { SecPalRuntimeInfo } from "../native";

const runtimeInfo: SecPalRuntimeInfo = {
  clientPlatform: "android",
  appVersion: "1.4.0",
  appBuild: 10400,
};

function createBootstrapPayload(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      client_platform: "android",
      api_base_url: "https://api.secpal.dev/v1",
      instance: {
        display_name: "SecPal Demo",
      },
      compatibility: {
        bootstrap_version: "v1",
        schema_version: 3,
        minimum_supported_app_version: "1.4.0",
        minimum_supported_app_build: 10400,
      },
      features: {
        password_login: true,
        passkey_login: true,
        managed_android_enrollment: false,
        notification_channels: {
          android_fcm: false,
          web_push: false,
        },
      },
      ...overrides,
    },
  };
}

describe("runtime discovery", () => {
  it("fetches canonical Android bootstrap metadata for a secure instance origin", async () => {
    const fetchBootstrap = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createBootstrapPayload()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(
      discoverAndroidRuntimeBootstrap({
        instanceUrl: "https://api.secpal.dev/",
        locale: "de",
        runtimeInfo,
        fetchBootstrap,
      })
    ).resolves.toEqual(createBootstrapPayload().data);

    const request = fetchBootstrap.mock.calls[0]?.[0] as Request;
    const url = new URL(request.url);

    expect(url.origin).toBe("https://api.secpal.dev");
    expect(url.pathname).toBe("/v1/bootstrap");
    expect(url.searchParams.get("client_platform")).toBe("android");
    expect(url.searchParams.get("app_version")).toBe("1.4.0");
    expect(url.searchParams.get("app_build")).toBe("10400");
    expect(request.headers.get("Accept")).toBe("application/json");
    expect(request.headers.get("Accept-Language")).toBe("de");
  });

  it("rejects insecure and non-origin instance URLs before fetching", async () => {
    const fetchBootstrap = vi.fn();

    await expect(
      discoverAndroidRuntimeBootstrap({
        instanceUrl: "http://api.secpal.dev",
        locale: "en",
        runtimeInfo,
        fetchBootstrap,
      })
    ).rejects.toMatchObject({ code: "INVALID_INSTANCE_URL" });

    await expect(
      discoverAndroidRuntimeBootstrap({
        instanceUrl: "https://api.secpal.dev@evil.example/path?tenant=1",
        locale: "en",
        runtimeInfo,
        fetchBootstrap,
      })
    ).rejects.toMatchObject({ code: "INVALID_INSTANCE_URL" });

    expect(fetchBootstrap).not.toHaveBeenCalled();
  });

  it("surfaces unavailable bootstrap endpoints as blocking discovery errors", async () => {
    await expect(
      discoverAndroidRuntimeBootstrap({
        instanceUrl: "https://api.secpal.dev",
        locale: "en",
        runtimeInfo,
        fetchBootstrap: vi
          .fn()
          .mockRejectedValue(new TypeError("Failed to fetch")),
      })
    ).rejects.toMatchObject({ code: "BOOTSTRAP_UNAVAILABLE" });
  });

  it("rejects malformed or state-invalid bootstrap payloads", async () => {
    await expect(
      discoverAndroidRuntimeBootstrap({
        instanceUrl: "https://api.secpal.dev",
        locale: "en",
        runtimeInfo,
        fetchBootstrap: vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify(
              createBootstrapPayload({
                features: {
                  password_login: true,
                },
              })
            ),
            { status: 200 }
          )
        ),
      })
    ).rejects.toMatchObject({ code: "BOOTSTRAP_STATE_INVALID" });
  });

  it("rejects incompatible and unsupported-client bootstrap responses", async () => {
    await expect(
      discoverAndroidRuntimeBootstrap({
        instanceUrl: "https://api.secpal.dev",
        locale: "en",
        runtimeInfo,
        fetchBootstrap: vi
          .fn()
          .mockResolvedValue(
            new Response(
              JSON.stringify(
                createBootstrapPayload({ client_platform: "browser" })
              ),
              { status: 200 }
            )
          ),
      })
    ).rejects.toMatchObject({
      code: "BOOTSTRAP_PLATFORM_INCOMPATIBLE",
      message: "This instance is not compatible with Android discovery.",
    });

    await expect(
      discoverAndroidRuntimeBootstrap({
        instanceUrl: "https://api.secpal.dev",
        locale: "en",
        runtimeInfo,
        fetchBootstrap: vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify(
              createBootstrapPayload({
                compatibility: {
                  bootstrap_version: "v2",
                  schema_version: 3,
                  minimum_supported_app_version: "1.4.0",
                  minimum_supported_app_build: 10400,
                },
              })
            ),
            { status: 200 }
          )
        ),
      })
    ).rejects.toMatchObject({ code: "BOOTSTRAP_INCOMPATIBLE" });

    await expect(
      discoverAndroidRuntimeBootstrap({
        instanceUrl: "https://api.secpal.dev",
        locale: "en",
        runtimeInfo,
        fetchBootstrap: vi.fn().mockResolvedValue(
          new Response(JSON.stringify(createBootstrapPayload()), {
            status: 426,
          })
        ),
      })
    ).rejects.toBeInstanceOf(RuntimeDiscoveryError);

    await expect(
      discoverAndroidRuntimeBootstrap({
        instanceUrl: "https://api.secpal.dev",
        locale: "en",
        runtimeInfo,
        fetchBootstrap: vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify(
              createBootstrapPayload({
                compatibility: {
                  bootstrap_version: "v1",
                  schema_version: 3,
                  minimum_supported_app_version: "2.0.0",
                  minimum_supported_app_build: 20000,
                },
              })
            ),
            { status: 200 }
          )
        ),
      })
    ).rejects.toMatchObject({ code: "UNSUPPORTED_CLIENT_VERSION" });
  });

  it("drops disabled Android FCM metadata even when stale channel data is present", async () => {
    await expect(
      discoverAndroidRuntimeBootstrap({
        instanceUrl: "https://api.secpal.dev",
        locale: "en",
        runtimeInfo,
        fetchBootstrap: vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify(
              createBootstrapPayload({
                notification_channels: {
                  android_fcm: {
                    channel: "android_fcm",
                    metadata_revision: 3,
                    public_runtime_metadata: {
                      api_key: "stale-public-client-api-key",
                      project_id: "stale-project",
                      application_id: "1:1234567890:android:stale",
                      sender_id: "1234567890",
                    },
                  },
                },
              })
            ),
            { status: 200 }
          )
        ),
      })
    ).resolves.toEqual(createBootstrapPayload().data);
  });
});
