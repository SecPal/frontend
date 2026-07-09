// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it } from "vitest";

import type { BootstrapResponse, NativeRuntimeBootstrap } from "./bootstrap";

describe("bootstrap API types", () => {
  it("models the full canonical public bootstrap document", () => {
    const response = {
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
        legal: {
          license: {
            spdx_id: "AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution",
            name: "GNU Affero General Public License v3.0 or later with SecPal attribution additional terms",
            url: "https://github.com/SecPal/api/blob/main/LICENSES/LicenseRef-SecPal-Attribution.txt",
            base_license_url: "https://www.gnu.org/licenses/agpl-3.0.html",
          },
          source_url: "https://api.secpal.dev/v1/source",
        },
        features: {
          password_login: true,
          passkey_login: true,
          managed_android_enrollment: true,
          notification_channels: {
            android_fcm: true,
            web_push: true,
          },
        },
        notification_channels: {
          android_fcm: {
            channel: "android_fcm",
            metadata_revision: 3,
            public_runtime_metadata: {
              api_key: "public-client-api-key-demo-1234567890",
              project_id: "secpal-demo-push",
              application_id: "1:1234567890:android:abcdef1234567890",
              sender_id: "1234567890",
            },
          },
          web_push: {
            channel: "web_push",
            metadata_revision: 5,
            public_runtime_metadata: {
              vapid_public_key:
                "BE9tfo-aCxwtPk9QYXKDlAUGBwgJCgsMDQ4PEBESExQVobLD1OX2BxgpMEFSY3SFlgcYKTBLXG1-j5ABAgMEBQY",
            },
          },
        },
      },
    } satisfies BootstrapResponse;

    expect(response.data.api_base_url).toBe("https://api.secpal.dev/v1");
    expect(response.data.instance.display_name).toBe("SecPal Demo");
    expect(
      response.data.notification_channels?.android_fcm?.public_runtime_metadata
        .sender_id
    ).toBe("1234567890");
    expect(
      response.data.notification_channels?.web_push?.public_runtime_metadata
        .vapid_public_key
    ).toHaveLength(87);
  });

  it("models the frontend-to-native runtime bootstrap payload", () => {
    const runtimeBootstrap = {
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
        managed_android_enrollment: true,
        notification_channels: {
          android_fcm: true,
          web_push: false,
        },
      },
      notification_channels: {
        android_fcm: {
          channel: "android_fcm",
          metadata_revision: 3,
          public_runtime_metadata: {
            api_key: "public-client-api-key-demo-1234567890",
            project_id: "secpal-demo-push",
            application_id: "1:1234567890:android:abcdef1234567890",
            sender_id: "1234567890",
          },
        },
      },
    } satisfies NativeRuntimeBootstrap;

    expect(runtimeBootstrap.compatibility.bootstrap_version).toBe("v1");
    expect(runtimeBootstrap.features.notification_channels.android_fcm).toBe(
      true
    );
  });
});
