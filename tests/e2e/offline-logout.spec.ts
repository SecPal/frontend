// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { test } from "@playwright/test";
import {
  runOfflineLogoutPrivacyScenario,
  supportsServiceWorkerOfflineFlows,
} from "./offline-logout.shared";

test.describe("Offline Logout Privacy", () => {
  test("should block offline access to the cached profile page after logout", async ({
    page,
    context,
  }) => {
    test.skip(
      !supportsServiceWorkerOfflineFlows,
      "Requires preview/staging mode with an active service worker."
    );

    await runOfflineLogoutPrivacyScenario(page, context);
  });
});
