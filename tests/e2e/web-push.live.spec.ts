// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { TEST_USER, loginViaUI } from "./auth.setup";
import { ensureActiveServiceWorker } from "./offline-live-helpers";
import {
  getConfiguredLiveWebPushBrowserPath,
  getLiveWebPushMode,
  getLiveWebPushProjectSkipReason,
} from "./web-push-live-mode";

interface RecordedExchange {
  url: string;
  method: string;
  payload: unknown;
  status: number;
  responseBody: unknown;
}

interface WebPushTraffic {
  upsert: RecordedExchange[];
  revoke: RecordedExchange[];
}

interface BrowserPushBootstrapProof {
  metadataRevision: string | number;
  vapidPublicKey: string;
}

interface BrowserPushRuntimeState {
  pageUrl: string;
  pageOrigin: string;
  secureContext: boolean;
  permission: string;
  hasNotificationApi: boolean;
  hasPushManager: boolean;
  hasServiceWorker: boolean;
  serviceWorkerScope: string | null;
  serviceWorkerScopePath: string | null;
  serviceWorkerController: string | null;
  sameOriginServiceWorker: boolean;
  readyError: string | null;
  hasSubscription: boolean;
  subscriptionEndpoint: string | null;
  installationId: string | null;
}

interface LiveWebPushBrowserSession {
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

const liveWebPushMode = getLiveWebPushMode();
const LIVE_WEB_PUSH_TIMEOUT_MS = 60_000;

async function launchLiveWebPushBrowserSession(): Promise<LiveWebPushBrowserSession> {
  const browserPath = getConfiguredLiveWebPushBrowserPath();

  if (!browserPath) {
    throw new Error(
      "CHROME_PATH must point to a stable Chrome/Chromium binary before the live browser Web Push smoke can launch a persistent browser profile."
    );
  }

  const userDataDir = mkdtempSync(
    path.join(tmpdir(), "secpal-live-web-push-profile-")
  );
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: browserPath,
    headless: false,
    viewport: {
      width: 1440,
      height: 1024,
    },
  });
  const page = context.pages()[0] ?? (await context.newPage());

  return {
    context,
    page,
    close: async () => {
      await context.close();
      rmSync(userDataDir, { recursive: true, force: true });
    },
  };
}

function createWebPushTraffic(): WebPushTraffic {
  return {
    upsert: [],
    revoke: [],
  };
}

function parseJson(value: string | null): unknown {
  if (value === null || value.trim() === "") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function formatDiagnostics(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "<empty>";
  }

  if (typeof value === "string") {
    return value.slice(0, 600);
  }

  try {
    return JSON.stringify(value).slice(0, 600);
  } catch {
    return String(value).slice(0, 600);
  }
}

function isOkStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

function isNotificationInstallationRequest(url: string): boolean {
  try {
    return /\/v1\/me\/notification-installations\/[^/]+$/.test(
      new URL(url).pathname
    );
  } catch {
    return false;
  }
}

function extractInstallationId(url: string): string {
  const pathname = new URL(url).pathname;
  const installationId = pathname.split("/").pop();

  if (!installationId) {
    throw new Error(`Could not extract installationId from ${url}`);
  }

  return installationId;
}

function observeWebPushTraffic(page: Page, traffic: WebPushTraffic) {
  page.on("response", async (response) => {
    const url = response.url();
    const method = response.request().method();

    if (!isNotificationInstallationRequest(url)) {
      return;
    }

    const exchange: RecordedExchange = {
      url,
      method,
      payload: parseJson(response.request().postData() ?? null),
      status: response.status(),
      responseBody: parseJson(await response.text().catch(() => null)),
    };

    if (method === "PUT") {
      traffic.upsert.push(exchange);
      return;
    }

    if (method === "DELETE") {
      traffic.revoke.push(exchange);
    }
  });
}

async function fetchBrowserPushBootstrapProof(
  page: Page,
  apiBaseUrl: string
): Promise<BrowserPushBootstrapProof> {
  const result = await page.evaluate(async (bootstrapUrl) => {
    const response = await fetch(bootstrapUrl, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    const responseText = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      body: responseText,
    };
  }, `${apiBaseUrl}/v1/bootstrap?client_platform=browser`);

  const parsedBody = parseJson(result.body);

  if (!result.ok) {
    throw new Error(
      `GET /v1/bootstrap?client_platform=browser failed (${result.status}) on ${apiBaseUrl}: ${formatDiagnostics(parsedBody)}`
    );
  }

  const payload =
    typeof parsedBody === "object" && parsedBody !== null ? parsedBody : null;
  const data =
    payload && "data" in payload
      ? (payload as { data?: Record<string, unknown> }).data
      : undefined;
  const features =
    data && "features" in data
      ? (data as { features?: Record<string, unknown> }).features
      : undefined;
  const notificationChannels =
    features && "notification_channels" in features
      ? (features as { notification_channels?: Record<string, unknown> })
          .notification_channels
      : undefined;
  const runtimeChannels =
    data && "notification_channels" in data
      ? (data as { notification_channels?: Record<string, unknown> })
          .notification_channels
      : undefined;
  const webPushRuntime =
    runtimeChannels && "web_push" in runtimeChannels
      ? (runtimeChannels as { web_push?: Record<string, unknown> }).web_push
      : undefined;
  const publicRuntimeMetadata =
    webPushRuntime && "public_runtime_metadata" in webPushRuntime
      ? (
          webPushRuntime as {
            public_runtime_metadata?: Record<string, unknown>;
          }
        ).public_runtime_metadata
      : undefined;
  const metadataRevision =
    webPushRuntime && "metadata_revision" in webPushRuntime
      ? (webPushRuntime as { metadata_revision?: string | number })
          .metadata_revision
      : undefined;
  const webPushEnabled =
    notificationChannels && "web_push" in notificationChannels
      ? (notificationChannels as { web_push?: unknown }).web_push === true
      : false;
  const vapidPublicKey =
    publicRuntimeMetadata && "vapid_public_key" in publicRuntimeMetadata
      ? (publicRuntimeMetadata as { vapid_public_key?: unknown })
          .vapid_public_key
      : undefined;

  if (!webPushEnabled) {
    throw new Error(
      `GET /v1/bootstrap?client_platform=browser did not publish notification_channels.web_push on ${apiBaseUrl}: ${formatDiagnostics(parsedBody)}`
    );
  }

  if (
    typeof vapidPublicKey !== "string" ||
    vapidPublicKey.trim().length === 0 ||
    (typeof metadataRevision !== "string" &&
      typeof metadataRevision !== "number")
  ) {
    throw new Error(
      `GET /v1/bootstrap?client_platform=browser returned incomplete browser Web Push runtime metadata on ${apiBaseUrl}: ${formatDiagnostics(parsedBody)}`
    );
  }

  return {
    metadataRevision,
    vapidPublicKey,
  };
}

async function readBrowserPushRuntimeState(
  page: Page
): Promise<BrowserPushRuntimeState> {
  return await page.evaluate(async () => {
    const hasServiceWorker =
      "serviceWorker" in navigator && navigator.serviceWorker !== undefined;
    let serviceWorkerScope: string | null = null;
    let serviceWorkerScopePath: string | null = null;
    let serviceWorkerController: string | null = null;
    let sameOriginServiceWorker = false;
    let readyError: string | null = null;
    let hasSubscription = false;
    let subscriptionEndpoint: string | null = null;

    if (hasServiceWorker) {
      try {
        const registration = await navigator.serviceWorker.ready;

        serviceWorkerScope = registration.scope;
        serviceWorkerController =
          navigator.serviceWorker.controller?.scriptURL ?? null;

        try {
          const scopeUrl = new URL(registration.scope);

          serviceWorkerScopePath = scopeUrl.pathname || "/";
          sameOriginServiceWorker = scopeUrl.origin === window.location.origin;
        } catch {
          serviceWorkerScopePath = registration.scope;
        }

        if (
          registration.pushManager &&
          typeof registration.pushManager.getSubscription === "function"
        ) {
          const subscription = await registration.pushManager.getSubscription();

          hasSubscription = subscription !== null;
          subscriptionEndpoint = subscription?.endpoint ?? null;
        }
      } catch (error) {
        readyError = error instanceof Error ? error.message : String(error);
      }
    }

    return {
      pageUrl: window.location.href,
      pageOrigin: window.location.origin,
      secureContext: window.isSecureContext,
      permission:
        "Notification" in window ? Notification.permission : "unavailable",
      hasNotificationApi: "Notification" in window,
      hasPushManager: "PushManager" in window,
      hasServiceWorker,
      serviceWorkerScope,
      serviceWorkerScopePath,
      serviceWorkerController,
      sameOriginServiceWorker,
      readyError,
      hasSubscription,
      subscriptionEndpoint,
      installationId: localStorage.getItem(
        "secpal-browser-push-installation-id"
      ),
    };
  });
}

async function assertBrowserPushPrerequisites(
  page: Page,
  expectedOrigin: string
): Promise<BrowserPushRuntimeState> {
  await ensureActiveServiceWorker(page);
  const state = await readBrowserPushRuntimeState(page);

  if (state.pageOrigin !== expectedOrigin) {
    throw new Error(
      `Browser Web Push smoke is running on ${state.pageOrigin}, but the selected deployment origin is ${expectedOrigin}.`
    );
  }

  if (!state.secureContext) {
    throw new Error(
      `Browser Web Push requires a secure context, but ${state.pageUrl} is not secure.`
    );
  }

  if (!state.hasNotificationApi) {
    throw new Error(
      `Notification API is unavailable on ${state.pageUrl}; browser Web Push cannot request permission.`
    );
  }

  if (!state.hasPushManager) {
    throw new Error(
      `PushManager is unavailable on ${state.pageUrl}; use a current Chromium-based browser for the live browser Web Push smoke.`
    );
  }

  if (!state.hasServiceWorker) {
    throw new Error(
      `navigator.serviceWorker is unavailable on ${state.pageUrl}; browser Web Push requires a same-origin service worker.`
    );
  }

  if (state.readyError) {
    throw new Error(
      `Service worker readiness failed on ${state.pageUrl}: ${state.readyError}`
    );
  }

  if (!state.serviceWorkerScope) {
    throw new Error(
      `Service worker registration never became ready on ${state.pageUrl}.`
    );
  }

  if (!state.sameOriginServiceWorker) {
    throw new Error(
      `Service worker scope ${state.serviceWorkerScope} is not same-origin with ${state.pageOrigin}. Browser Web Push requires same-origin service-worker hosting.`
    );
  }

  if (!state.serviceWorkerController) {
    throw new Error(
      `No active service worker controller was present on ${state.pageUrl}. Reload the selected deployment so the current service worker can take control before running the live browser Web Push smoke.`
    );
  }

  if (state.permission !== "granted") {
    throw new Error(
      `Browser notification permission is ${state.permission} on ${state.pageUrl}; the live browser Web Push smoke requires a granted notification permission.`
    );
  }

  return state;
}

async function waitForSuccessfulUpsert(
  page: Page,
  traffic: WebPushTraffic
): Promise<RecordedExchange> {
  try {
    await expect
      .poll(
        () =>
          traffic.upsert.findLast((exchange) => isOkStatus(exchange.status)) !==
          undefined,
        {
          timeout: LIVE_WEB_PUSH_TIMEOUT_MS,
        }
      )
      .toBe(true);
  } catch {
    const runtimeState = await readBrowserPushRuntimeState(page);
    const lastExchange = traffic.upsert.at(-1);

    if (lastExchange) {
      throw new Error(
        `Browser Web Push registration did not reach a successful PUT /v1/me/notification-installations/{installationId}. Last response was ${lastExchange.status}: ${formatDiagnostics(lastExchange.responseBody)}. Runtime state: ${formatDiagnostics(runtimeState)}.`
      );
    }

    throw new Error(
      `Browser Web Push registration never hit PUT /v1/me/notification-installations/{installationId} after notification permission was granted. Runtime state: ${formatDiagnostics(runtimeState)}.`
    );
  }

  const successfulExchange = traffic.upsert.findLast((exchange) =>
    isOkStatus(exchange.status)
  );

  if (!successfulExchange) {
    throw new Error(
      "Browser Web Push registration unexpectedly lost the successful PUT exchange before diagnostics could be collected."
    );
  }

  return successfulExchange;
}

async function waitForSuccessfulRevoke(
  page: Page,
  traffic: WebPushTraffic,
  installationId: string
): Promise<RecordedExchange> {
  try {
    await expect
      .poll(
        () =>
          traffic.revoke.findLast(
            (exchange) =>
              extractInstallationId(exchange.url) === installationId &&
              isOkStatus(exchange.status)
          ) !== undefined,
        {
          timeout: LIVE_WEB_PUSH_TIMEOUT_MS,
        }
      )
      .toBe(true);
  } catch {
    const runtimeState = await readBrowserPushRuntimeState(page);
    const lastExchange = traffic.revoke
      .filter(
        (exchange) => extractInstallationId(exchange.url) === installationId
      )
      .at(-1);

    if (lastExchange) {
      throw new Error(
        `Browser Web Push cleanup did not reach a successful DELETE /v1/me/notification-installations/${installationId}. Last response was ${lastExchange.status}: ${formatDiagnostics(lastExchange.responseBody)}. Runtime state: ${formatDiagnostics(runtimeState)}.`
      );
    }

    throw new Error(
      `Browser Web Push cleanup never hit DELETE /v1/me/notification-installations/${installationId} during sign-out. Runtime state: ${formatDiagnostics(runtimeState)}.`
    );
  }

  const successfulExchange = traffic.revoke.findLast(
    (exchange) =>
      extractInstallationId(exchange.url) === installationId &&
      isOkStatus(exchange.status)
  );

  if (!successfulExchange) {
    throw new Error(
      `Browser Web Push cleanup lost the successful DELETE exchange for installation ${installationId}.`
    );
  }

  return successfulExchange;
}

async function waitForBrowserPushCleanup(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const state = await readBrowserPushRuntimeState(page);

        return {
          installationId: state.installationId,
          hasSubscription: state.hasSubscription,
        };
      },
      {
        timeout: LIVE_WEB_PUSH_TIMEOUT_MS,
      }
    )
    .toEqual({
      installationId: null,
      hasSubscription: false,
    });
}

async function performLogout(page: Page): Promise<void> {
  const userMenu = page.getByRole("button", { name: /user menu/i });

  if (await userMenu.isVisible().catch(() => false)) {
    await userMenu.click();
    await page
      .getByRole("menuitem", { name: /sign out|abmelden|ausloggen/i })
      .click();
    return;
  }

  await page
    .getByRole("button", { name: /sign out|abmelden|ausloggen/i })
    .click();
}

async function attachFailureScreenshot(
  page: Page | undefined,
  testInfo: Parameters<typeof test>[1]
): Promise<void> {
  if (!page || testInfo.status === testInfo.expectedStatus) {
    return;
  }

  try {
    const screenshotPath = testInfo.outputPath("web-push-live-failure.png");

    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });
    await testInfo.attach("failure-screenshot", {
      path: screenshotPath,
      contentType: "image/png",
    });
  } catch {
    // Best-effort artifact capture only.
  }
}

test.describe("Live browser Web Push smoke", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    Boolean(liveWebPushMode.skipReason),
    liveWebPushMode.skipReason ??
      "Set PLAYWRIGHT_LIVE_WEB_PUSH=1 and run inside a Polyscope workspace preview to execute the live browser Web Push smoke."
  );

  test("proves bootstrap metadata, authenticated registration, and logout cleanup on the Polyscope workspace preview", async ({
    browserName,
  }, testInfo) => {
    const projectSkipReason = getLiveWebPushProjectSkipReason(
      testInfo.project.name,
      browserName
    );

    test.skip(Boolean(projectSkipReason), projectSkipReason);
    test.slow();
    test.setTimeout(180_000);

    if (!TEST_USER.email || !TEST_USER.password) {
      throw new Error(
        "TEST_USER_EMAIL and TEST_USER_PASSWORD must be set for the live browser Web Push smoke; the Polyscope workspace preview seeds a default user but TEST_USER_* lookups still returned empty."
      );
    }

    const deploymentOrigin = new URL(liveWebPushMode.baseUrl).origin;
    const traffic = createWebPushTraffic();

    let session: LiveWebPushBrowserSession | undefined;

    try {
      session = await launchLiveWebPushBrowserSession();

      const { context, page } = session;

      observeWebPushTraffic(page, traffic);

      await test.step("log in with a fresh browser-session", async () => {
        await loginViaUI(page, TEST_USER.email, TEST_USER.password);
        await expect(page).not.toHaveURL(/\/login$/);
      });

      const bootstrapProof =
        await test.step("prove browser bootstrap metadata publication", async () => {
          return await fetchBrowserPushBootstrapProof(
            page,
            liveWebPushMode.apiBaseUrl as string
          );
        });

      const runtimeState =
        await test.step("grant notification permission and prove same-origin service-worker prerequisites", async () => {
          await context.grantPermissions(["notifications"], {
            origin: deploymentOrigin,
          });

          await page.goto("/settings", { waitUntil: "networkidle" });
          await expect(
            page.getByRole("heading", { name: /settings/i })
          ).toBeVisible();

          return await assertBrowserPushPrerequisites(page, deploymentOrigin);
        });

      const successfulUpsert =
        await test.step("prove authenticated registration on the canonical PUT installation endpoint", async () => {
          const exchange = await waitForSuccessfulUpsert(page, traffic);

          expect(exchange.method).toBe("PUT");
          expect([200, 201]).toContain(exchange.status);
          expect(exchange.payload).toEqual(
            expect.objectContaining({
              channel: "web_push",
              lifecycle_event: "registered",
              runtime: expect.objectContaining({
                metadata_revision: bootstrapProof.metadataRevision,
              }),
              registration: expect.objectContaining({
                browser: expect.objectContaining({
                  service_worker_scope: runtimeState.serviceWorkerScopePath,
                }),
                subscription: expect.objectContaining({
                  endpoint: expect.any(String),
                  keys: expect.objectContaining({
                    auth: expect.any(String),
                    p256dh: expect.any(String),
                  }),
                }),
              }),
            })
          );

          expect(exchange.responseBody).toEqual(
            expect.objectContaining({
              data: expect.objectContaining({
                channel: "web_push",
              }),
            })
          );

          return exchange;
        });

      const installationId = extractInstallationId(successfulUpsert.url);

      await test.step("prove browser-side installation state after registration", async () => {
        const registeredState = await readBrowserPushRuntimeState(page);

        expect(registeredState.permission).toBe("granted");
        expect(registeredState.installationId).toBe(installationId);
        expect(registeredState.hasSubscription).toBe(true);
        expect(registeredState.subscriptionEndpoint).toBe(
          (
            successfulUpsert.payload as {
              registration?: {
                subscription?: {
                  endpoint?: string;
                };
              };
            }
          )?.registration?.subscription?.endpoint
        );
        expect(bootstrapProof.vapidPublicKey).not.toHaveLength(0);
      });

      await test.step("sign out and prove canonical DELETE cleanup", async () => {
        await performLogout(page);

        const revokeExchange = await waitForSuccessfulRevoke(
          page,
          traffic,
          installationId
        );

        expect(revokeExchange.method).toBe("DELETE");
        expect(revokeExchange.status).toBe(200);
      });

      await test.step("prove browser cleanup completed after sign-out", async () => {
        await waitForBrowserPushCleanup(page);
        await expect(page).toHaveURL(/\/login$/);
      });
    } finally {
      await attachFailureScreenshot(session?.page, testInfo);
      await session?.close();
    }
  });
});
