// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createElement, type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, renderHook, act } from "@testing-library/react";
import { waitFor } from "@testing-library/dom";
import { useNotifications } from "./useNotifications";
import {
  clearBrowserPushInstallationId,
  getOrCreateBrowserPushInstallationId,
  peekBrowserPushInstallationId,
  setBrowserPushLogoutInProgress,
} from "../lib/browserPushState";
import { AuthContext, type AuthContextType } from "../contexts/auth-context";

const originalNotificationDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "Notification"
);
const originalPushManagerDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "PushManager"
);
const originalServiceWorkerDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "serviceWorker"
);

function restoreProperty(
  target: object,
  property: PropertyKey,
  descriptor: PropertyDescriptor | undefined
): void {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor);
    return;
  }

  Reflect.deleteProperty(target, property);
}

// Mock Notification API
const mockNotification = vi.fn();
const mockPushManager = {
  getSubscription: vi.fn(),
  subscribe: vi.fn(),
};
const mockServiceWorkerRegistration = {
  showNotification: vi.fn().mockResolvedValue(undefined),
  pushManager: mockPushManager,
};
const mockPushSubscription = {
  endpoint:
    "https://fcm.googleapis.com/fcm/send/cVJmVnB1c2g6MTIzNDU2Nzg5MA:APA91bHabcdefghijklmno1234567890",
  expirationTime: 1782475200000,
  toJSON: vi.fn().mockReturnValue({
    endpoint:
      "https://fcm.googleapis.com/fcm/send/cVJmVnB1c2g6MTIzNDU2Nzg5MA:APA91bHabcdefghijklmno1234567890",
    expirationTime: 1782475200000,
    keys: {
      p256dh: "BElx7P1qA2rS9tUvWxYz0123456789abcdefghijklmnopqrstuv",
      auth: "K7d9Lm2PqRs",
    },
  }),
  unsubscribe: vi.fn().mockResolvedValue(true),
};

const authenticatedAuthContextValue: AuthContextType = {
  user: {
    id: "1",
    name: "Notification User",
    email: "notifications@secpal.dev",
    emailVerified: true,
  },
  isAuthenticated: true,
  isLoading: false,
  bootstrapRecoveryReason: null,
  login: vi.fn(),
  logout: vi.fn(),
  retryBootstrap: vi.fn(),
  hasPermission: vi.fn().mockReturnValue(true),
  hasOrganizationalAccess: vi.fn().mockReturnValue(true),
};

function AuthenticatedWrapper({ children }: { children: ReactNode }) {
  return createElement(
    AuthContext.Provider,
    {
      value: authenticatedAuthContextValue,
    },
    children
  );
}

describe("useNotifications", () => {
  beforeEach(() => {
    // Setup Notification mock
    globalThis.Notification = mockNotification as never;
    Object.defineProperty(globalThis.Notification, "permission", {
      writable: true,
      value: "default",
    });
    globalThis.Notification.requestPermission = vi
      .fn()
      .mockResolvedValue("granted");

    // Setup Service Worker mock
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve(mockServiceWorkerRegistration),
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, "PushManager", {
      value: function PushManager() {},
      writable: true,
      configurable: true,
    });

    mockPushManager.getSubscription.mockResolvedValue(null);
    mockPushManager.subscribe.mockResolvedValue(mockPushSubscription);
  });

  afterEach(() => {
    cleanup();
    setBrowserPushLogoutInProgress(false);
    clearBrowserPushInstallationId();
    localStorage.clear();
    document.cookie = "XSRF-TOKEN=; Max-Age=0; path=/";
    restoreProperty(globalThis, "Notification", originalNotificationDescriptor);
    restoreProperty(window, "PushManager", originalPushManagerDescriptor);
    restoreProperty(
      navigator,
      "serviceWorker",
      originalServiceWorkerDescriptor
    );
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with correct default values", async () => {
      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(mockPushManager.getSubscription).toHaveBeenCalled();
      });

      expect(result.current.permission).toBe("default");
      expect(result.current.isSupported).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should detect unsupported browsers", async () => {
      // Remove Notification from window
      const originalNotification = globalThis.Notification;
      // @ts-expect-error - intentionally testing unsupported environment
      delete globalThis.Notification;

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(mockPushManager.getSubscription).toHaveBeenCalled();
      });

      expect(result.current.isSupported).toBe(false);

      // Restore
      globalThis.Notification = originalNotification;
    });
  });

  describe("requestPermission", () => {
    it("should request and update permission state", async () => {
      const { result } = renderHook(() => useNotifications());

      let permissionResult: string | undefined;
      await act(async () => {
        permissionResult = await result.current.requestPermission();
      });

      expect(permissionResult).toBe("granted");
      expect(result.current.permission).toBe("granted");
      expect(globalThis.Notification.requestPermission).toHaveBeenCalledOnce();
    });

    it("should handle denied permission", async () => {
      globalThis.Notification.requestPermission = vi
        .fn()
        .mockResolvedValue("denied");

      const { result } = renderHook(() => useNotifications());

      let permissionResult: string | undefined;
      await act(async () => {
        permissionResult = await result.current.requestPermission();
      });

      expect(permissionResult).toBe("denied");
      expect(result.current.permission).toBe("denied");
    });

    it("should throw error if notifications not supported", async () => {
      // Remove Notification from window
      const originalNotification = globalThis.Notification;
      // @ts-expect-error - intentionally testing unsupported environment
      delete globalThis.Notification;

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await expect(result.current.requestPermission()).rejects.toThrow(
          "Notifications are not supported"
        );
      });

      // Restore
      globalThis.Notification = originalNotification;
    });

    it("should handle permission request errors", async () => {
      const testError = new Error("Permission request failed");
      globalThis.Notification.requestPermission = vi
        .fn()
        .mockRejectedValue(testError);

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await expect(result.current.requestPermission()).rejects.toThrow(
          testError
        );
      });

      expect(result.current.error).toBe(testError);
    });

    it("bootstraps deployment web push metadata and registers the authenticated browser subscription when permission is granted", async () => {
      document.cookie = "XSRF-TOKEN=test-xsrf-token; path=/";

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                client_platform: "browser",
                compatibility: {
                  bootstrap_version: "v1",
                  schema_version: 3,
                },
                features: {
                  notification_channels: {
                    android_fcm: false,
                    web_push: true,
                  },
                },
                notification_channels: {
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
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                installation_id: "installation-id",
                channel: "web_push",
              },
            }),
            {
              status: 201,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        );

      vi.stubGlobal("fetch", mockFetch);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: AuthenticatedWrapper,
      });

      await act(async () => {
        await result.current.requestPermission();
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/v1/bootstrap?client_platform=browser"),
          expect.objectContaining({
            credentials: "include",
          })
        );
      });

      expect(mockPushManager.subscribe).toHaveBeenCalledWith({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/v1\/me\/notification-installations\//),
        expect.objectContaining({
          credentials: "include",
          method: "PUT",
        })
      );
    });
  });

  describe("showNotification", () => {
    beforeEach(() => {
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "granted",
      });
    });

    it("should show notification via service worker", async () => {
      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: "Test Notification",
          body: "This is a test",
        });
      });

      expect(
        mockServiceWorkerRegistration.showNotification
      ).toHaveBeenCalledWith(
        "Test Notification",
        expect.objectContaining({
          body: "This is a test",
          icon: "/pwa-192x192.png",
          badge: "/pwa-192x192.png",
        })
      );
    });

    it("should include custom options", async () => {
      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: "Custom Notification",
          body: "With options",
          icon: "/custom-icon.png",
          tag: "custom-tag",
          requireInteraction: true,
          data: { id: 123 },
        });
      });

      expect(
        mockServiceWorkerRegistration.showNotification
      ).toHaveBeenCalledWith(
        "Custom Notification",
        expect.objectContaining({
          body: "With options",
          icon: "/custom-icon.png",
          tag: "custom-tag",
          requireInteraction: true,
          data: { id: 123 },
        })
      );
    });

    it("should throw error if permission not granted", async () => {
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "denied",
      });
      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await expect(
          result.current.showNotification({
            title: "Test",
            body: "Should fail",
          })
        ).rejects.toThrow("Notification permission not granted");
      });
    });

    it("should fallback to browser notification if service worker unavailable", async () => {
      // Mock service worker without showNotification
      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: vi.fn().mockResolvedValue(null),
            },
          }),
        },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: "Fallback Notification",
          body: "Using browser API",
        });
      });

      expect(mockNotification).toHaveBeenCalledWith("Fallback Notification", {
        body: "Using browser API",
        icon: "/pwa-192x192.svg",
        tag: undefined,
        requireInteraction: undefined,
        data: undefined,
      });
    });

    it("should handle notification errors", async () => {
      const testError = new Error("Notification failed");
      mockServiceWorkerRegistration.showNotification.mockRejectedValueOnce(
        testError
      );

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await expect(
          result.current.showNotification({
            title: "Test",
            body: "Should fail",
          })
        ).rejects.toThrow(testError);
      });

      await waitFor(() => {
        expect(result.current.error).toBe(testError);
      });
    });
  });

  describe("loading states", () => {
    it("should set loading state during permission request", async () => {
      let resolvePermission: (value: string) => void;
      const permissionPromise = new Promise<string>((resolve) => {
        resolvePermission = resolve;
      });

      globalThis.Notification.requestPermission = vi
        .fn()
        .mockReturnValue(permissionPromise);

      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.requestPermission();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await act(async () => {
        resolvePermission!("granted");
        await permissionPromise;
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("should set loading state during notification display", async () => {
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "granted",
      }); // Ensure permission is granted

      mockServiceWorkerRegistration.showNotification.mockResolvedValueOnce(
        undefined
      );

      const { result } = renderHook(() => useNotifications());

      // Notification should complete successfully
      await act(async () => {
        await result.current.showNotification({
          title: "Test",
          body: "Loading test",
        });
      });

      // After completion, loading should be false
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe("autoSync", () => {
    it("does not re-register immediately after requestPermission grants access", async () => {
      document.cookie = "XSRF-TOKEN=test-xsrf-token; path=/";

      const mockFetch = vi.fn((input, init) => {
        const url = String(input);

        if (url.includes("/v1/bootstrap?client_platform=browser")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: {
                  client_platform: "browser",
                  compatibility: {
                    bootstrap_version: "v1",
                    schema_version: 3,
                  },
                  features: {
                    notification_channels: {
                      android_fcm: false,
                      web_push: true,
                    },
                  },
                  notification_channels: {
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
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                },
              }
            )
          );
        }

        if (
          /\/v1\/me\/notification-installations\//.test(url) &&
          init?.method === "PUT"
        ) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: {
                  installation_id: "installation-id",
                  channel: "web_push",
                },
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                },
              }
            )
          );
        }

        throw new Error(`Unexpected fetch request: ${url}`);
      });

      vi.stubGlobal("fetch", mockFetch);

      const { result } = renderHook(
        () => useNotifications({ autoSync: true }),
        {
          wrapper: AuthenticatedWrapper,
        }
      );

      await act(async () => {
        await result.current.requestPermission();
      });

      await waitFor(() => {
        const bootstrapCalls = mockFetch.mock.calls.filter(([input]) =>
          String(input).includes("/v1/bootstrap?client_platform=browser")
        );
        const upsertCalls = mockFetch.mock.calls.filter(
          ([input, init]) =>
            /\/v1\/me\/notification-installations\//.test(String(input)) &&
            init?.method === "PUT"
        );

        expect(bootstrapCalls).toHaveLength(1);
        expect(upsertCalls).toHaveLength(1);
      });

      expect(result.current.permission).toBe("granted");
    });

    it("reconciles an existing authenticated browser subscription on app load", async () => {
      document.cookie = "XSRF-TOKEN=test-xsrf-token; path=/";
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "granted",
      });
      mockPushManager.getSubscription.mockResolvedValue(mockPushSubscription);

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                client_platform: "browser",
                compatibility: {
                  bootstrap_version: "v1",
                  schema_version: 3,
                },
                features: {
                  notification_channels: {
                    android_fcm: false,
                    web_push: true,
                  },
                },
                notification_channels: {
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
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                installation_id: "installation-id",
                channel: "web_push",
              },
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        );

      vi.stubGlobal("fetch", mockFetch);

      renderHook(() => useNotifications({ autoSync: true }), {
        wrapper: AuthenticatedWrapper,
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/v1/bootstrap?client_platform=browser"),
          expect.objectContaining({
            credentials: "include",
          })
        );
      });

      expect(mockPushManager.subscribe).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/v1\/me\/notification-installations\//),
        expect.objectContaining({
          credentials: "include",
          method: "PUT",
        })
      );
    });

    it("rotates an existing authenticated browser subscription when the bootstrap VAPID key changes", async () => {
      document.cookie = "XSRF-TOKEN=test-xsrf-token; path=/";
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "granted",
      });

      const existingSubscription = {
        ...mockPushSubscription,
        options: {
          applicationServerKey: new Uint8Array([0x00, 0x01, 0x02]).buffer,
        },
        unsubscribe: vi.fn().mockResolvedValue(true),
      };
      const rotatedPushSubscription = {
        endpoint:
          "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABoVmFwaWRSb3RhdGlvbi1rZXktY2hhbmdlLTEyMzQ1Njc4OTA",
        expirationTime: 1782561600000,
        options: {
          applicationServerKey: new Uint8Array([0x03, 0x04, 0x05]).buffer,
        },
        toJSON: vi.fn().mockReturnValue({
          endpoint:
            "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABoVmFwaWRSb3RhdGlvbi1rZXktY2hhbmdlLTEyMzQ1Njc4OTA",
          expirationTime: 1782561600000,
          keys: {
            p256dh: "BMozillaRotatedP256dhKeyChange0123456789abcdefghijkl",
            auth: "Lm9PqRs8UvW",
          },
        }),
        unsubscribe: vi.fn().mockResolvedValue(true),
      };

      mockPushManager.getSubscription.mockResolvedValue(existingSubscription);
      mockPushManager.subscribe.mockResolvedValue(rotatedPushSubscription);

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                client_platform: "browser",
                compatibility: {
                  bootstrap_version: "v1",
                  schema_version: 3,
                },
                features: {
                  notification_channels: {
                    android_fcm: false,
                    web_push: true,
                  },
                },
                notification_channels: {
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
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                installation_id: "installation-id",
                channel: "web_push",
              },
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        );

      vi.stubGlobal("fetch", mockFetch);

      renderHook(() => useNotifications({ autoSync: true }), {
        wrapper: AuthenticatedWrapper,
      });

      await waitFor(() => {
        expect(existingSubscription.unsubscribe).toHaveBeenCalledTimes(1);
      });

      expect(mockPushManager.subscribe).toHaveBeenCalledTimes(1);

      const finalUpsertCall = mockFetch.mock.calls[1];
      const finalUpsertPayload = JSON.parse(
        String(finalUpsertCall?.[1]?.body ?? "{}")
      ) as {
        lifecycle_event: string;
        registration: { subscription: { endpoint: string } };
      };

      expect(finalUpsertPayload.lifecycle_event).toBe("credential_rotated");
      expect(finalUpsertPayload.registration.subscription.endpoint).toBe(
        rotatedPushSubscription.endpoint
      );
    });

    it("reloads bootstrap and rotates the local subscription when the backend rejects stale runtime metadata", async () => {
      document.cookie = "XSRF-TOKEN=test-xsrf-token; path=/";
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "granted",
      });

      const rotatedPushSubscription = {
        endpoint:
          "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABoQnRhdGVkLWtleS0xMjM0NTY3ODkw",
        expirationTime: 1782561600000,
        toJSON: vi.fn().mockReturnValue({
          endpoint:
            "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABoQnRhdGVkLWtleS0xMjM0NTY3ODkw",
          expirationTime: 1782561600000,
          keys: {
            p256dh: "BMozillaRotatedP256dh0123456789abcdefghijklmnopqrstu",
            auth: "Lm9PqRs7TuV",
          },
        }),
        unsubscribe: vi.fn().mockResolvedValue(true),
      };

      mockPushManager.getSubscription.mockResolvedValue(mockPushSubscription);
      mockPushManager.subscribe.mockResolvedValue(rotatedPushSubscription);

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                client_platform: "browser",
                compatibility: {
                  bootstrap_version: "v1",
                  schema_version: 3,
                },
                features: {
                  notification_channels: {
                    android_fcm: false,
                    web_push: true,
                  },
                },
                notification_channels: {
                  web_push: {
                    channel: "web_push",
                    metadata_revision: 4,
                    public_runtime_metadata: {
                      vapid_public_key:
                        "BE9tfo-aCxwtPk9QYXKDlAUGBwgJCgsMDQ4PEBESExQVobLD1OX2BxgpMEFSY3SFlgcYKTBLXG1-j5ABAgMEBQA",
                    },
                  },
                },
              },
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              message:
                "Notification runtime metadata changed; refresh bootstrap before retrying this installation update.",
              code: "NOTIFICATION_RUNTIME_STATE_INVALID",
              details: {
                bootstrap_version: "v1",
                schema_version: 3,
                channel: "web_push",
                provided_metadata_revision: 4,
                expected_metadata_revision: 5,
              },
            }),
            {
              status: 409,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                client_platform: "browser",
                compatibility: {
                  bootstrap_version: "v1",
                  schema_version: 3,
                },
                features: {
                  notification_channels: {
                    android_fcm: false,
                    web_push: true,
                  },
                },
                notification_channels: {
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
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                installation_id: "installation-id",
                channel: "web_push",
              },
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        );

      vi.stubGlobal("fetch", mockFetch);

      const { result } = renderHook(
        () => useNotifications({ autoSync: true }),
        {
          wrapper: AuthenticatedWrapper,
        }
      );

      await waitFor(() => {
        expect(mockPushSubscription.unsubscribe).toHaveBeenCalledTimes(1);
      });

      expect(mockPushManager.subscribe).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(4);
      expect(result.current.error).toBeNull();

      const finalUpsertCall = mockFetch.mock.calls[3];
      const finalUpsertPayload = JSON.parse(
        String(finalUpsertCall?.[1]?.body ?? "{}")
      ) as {
        lifecycle_event: string;
        runtime: { metadata_revision: number };
        registration: { subscription: { endpoint: string } };
      };

      expect(finalUpsertPayload.lifecycle_event).toBe("credential_rotated");
      expect(finalUpsertPayload.runtime.metadata_revision).toBe(5);
      expect(finalUpsertPayload.registration.subscription.endpoint).toBe(
        rotatedPushSubscription.endpoint
      );
    });

    it("retries auto sync after a rotated subscription fails to upsert", async () => {
      document.cookie = "XSRF-TOKEN=test-xsrf-token; path=/";
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "granted",
      });

      let currentSubscription: typeof mockPushSubscription | null =
        mockPushSubscription;
      const rotatedPushSubscription = {
        endpoint:
          "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABoUmVjb3Zlcnktc3Vic2NyaXB0aW9uLTEyMzQ1Njc4OTA",
        expirationTime: 1782565200000,
        toJSON: vi.fn().mockReturnValue({
          endpoint:
            "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABoUmVjb3Zlcnktc3Vic2NyaXB0aW9uLTEyMzQ1Njc4OTA",
          expirationTime: 1782565200000,
          keys: {
            p256dh: "BMozillaRecoveryP256dh0123456789abcdefghijklmnopqrst",
            auth: "Pm9QqRs7UvW",
          },
        }),
        unsubscribe: vi.fn().mockImplementation(async () => {
          currentSubscription = null;
          return true;
        }),
      };

      mockPushSubscription.unsubscribe.mockImplementationOnce(async () => {
        currentSubscription = null;
        return true;
      });
      mockPushManager.getSubscription.mockImplementation(
        async () => currentSubscription
      );
      mockPushManager.subscribe.mockImplementation(async () => {
        currentSubscription = rotatedPushSubscription;
        return rotatedPushSubscription;
      });

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                client_platform: "browser",
                compatibility: {
                  bootstrap_version: "v1",
                  schema_version: 3,
                },
                features: {
                  notification_channels: {
                    android_fcm: false,
                    web_push: true,
                  },
                },
                notification_channels: {
                  web_push: {
                    channel: "web_push",
                    metadata_revision: 4,
                    public_runtime_metadata: {
                      vapid_public_key:
                        "BE9tfo-aCxwtPk9QYXKDlAUGBwgJCgsMDQ4PEBESExQVobLD1OX2BxgpMEFSY3SFlgcYKTBLXG1-j5ABAgMEBQA",
                    },
                  },
                },
              },
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              message:
                "Notification runtime metadata changed; refresh bootstrap before retrying this installation update.",
              code: "NOTIFICATION_RUNTIME_STATE_INVALID",
              details: {
                bootstrap_version: "v1",
                schema_version: 3,
                channel: "web_push",
                provided_metadata_revision: 4,
                expected_metadata_revision: 5,
              },
            }),
            {
              status: 409,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                client_platform: "browser",
                compatibility: {
                  bootstrap_version: "v1",
                  schema_version: 3,
                },
                features: {
                  notification_channels: {
                    android_fcm: false,
                    web_push: true,
                  },
                },
                notification_channels: {
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
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              message: "Temporary installation sync failure",
            }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                client_platform: "browser",
                compatibility: {
                  bootstrap_version: "v1",
                  schema_version: 3,
                },
                features: {
                  notification_channels: {
                    android_fcm: false,
                    web_push: true,
                  },
                },
                notification_channels: {
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
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                installation_id: "installation-id",
                channel: "web_push",
              },
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        );

      vi.stubGlobal("fetch", mockFetch);

      const { result } = renderHook(
        () => useNotifications({ autoSync: true }),
        {
          wrapper: AuthenticatedWrapper,
        }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(6);
        expect(result.current.error).toBeNull();
      });

      expect(mockPushSubscription.unsubscribe).toHaveBeenCalledTimes(1);
      expect(mockPushManager.subscribe).toHaveBeenCalledTimes(1);

      const recoveredUpsertCall = mockFetch.mock.calls[5];
      const recoveredUpsertPayload = JSON.parse(
        String(recoveredUpsertCall?.[1]?.body ?? "{}")
      ) as {
        lifecycle_event: string;
        runtime: { metadata_revision: number };
        registration: { subscription: { endpoint: string } };
      };

      expect(recoveredUpsertPayload.lifecycle_event).toBe("client_updated");
      expect(recoveredUpsertPayload.runtime.metadata_revision).toBe(5);
      expect(recoveredUpsertPayload.registration.subscription.endpoint).toBe(
        rotatedPushSubscription.endpoint
      );
    });

    it("retries auto sync after requestPermission hits a rotation retry and the rotated upsert fails once", async () => {
      document.cookie = "XSRF-TOKEN=test-xsrf-token; path=/";

      let currentSubscription: typeof mockPushSubscription | null = null;
      const rotatedPushSubscription = {
        endpoint:
          "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABoUmVxdWVzdFBlcm1pc3Npb25SZXRyeTEyMzQ1Njc4OTA",
        expirationTime: 1782568800000,
        toJSON: vi.fn().mockReturnValue({
          endpoint:
            "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABoUmVxdWVzdFBlcm1pc3Npb25SZXRyeTEyMzQ1Njc4OTA",
          expirationTime: 1782568800000,
          keys: {
            p256dh: "BMozillaRequestRetryP256dh0123456789abcdefghijklmnopq",
            auth: "Qm9PqRs7WxY",
          },
        }),
        unsubscribe: vi.fn().mockImplementation(async () => {
          currentSubscription = null;
          return true;
        }),
      };

      mockPushManager.getSubscription.mockImplementation(
        async () => currentSubscription
      );
      mockPushManager.subscribe.mockImplementation(async () => {
        currentSubscription = rotatedPushSubscription;
        return rotatedPushSubscription;
      });

      globalThis.Notification.requestPermission = vi
        .fn()
        .mockImplementation(async () => {
          Object.defineProperty(globalThis.Notification, "permission", {
            writable: true,
            value: "granted",
          });
          return "granted";
        });

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                client_platform: "browser",
                compatibility: {
                  bootstrap_version: "v1",
                  schema_version: 3,
                },
                features: {
                  notification_channels: {
                    android_fcm: false,
                    web_push: true,
                  },
                },
                notification_channels: {
                  web_push: {
                    channel: "web_push",
                    metadata_revision: 4,
                    public_runtime_metadata: {
                      vapid_public_key:
                        "BE9tfo-aCxwtPk9QYXKDlAUGBwgJCgsMDQ4PEBESExQVobLD1OX2BxgpMEFSY3SFlgcYKTBLXG1-j5ABAgMEBQA",
                    },
                  },
                },
              },
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              message:
                "Notification runtime metadata changed; refresh bootstrap before retrying this installation update.",
              code: "NOTIFICATION_RUNTIME_STATE_INVALID",
              details: {
                bootstrap_version: "v1",
                schema_version: 3,
                channel: "web_push",
                provided_metadata_revision: 4,
                expected_metadata_revision: 5,
              },
            }),
            {
              status: 409,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                client_platform: "browser",
                compatibility: {
                  bootstrap_version: "v1",
                  schema_version: 3,
                },
                features: {
                  notification_channels: {
                    android_fcm: false,
                    web_push: true,
                  },
                },
                notification_channels: {
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
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              message: "Temporary installation sync failure",
            }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                client_platform: "browser",
                compatibility: {
                  bootstrap_version: "v1",
                  schema_version: 3,
                },
                features: {
                  notification_channels: {
                    android_fcm: false,
                    web_push: true,
                  },
                },
                notification_channels: {
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
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                installation_id: "installation-id",
                channel: "web_push",
              },
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        );

      vi.stubGlobal("fetch", mockFetch);

      const { result } = renderHook(
        () => useNotifications({ autoSync: true }),
        {
          wrapper: AuthenticatedWrapper,
        }
      );

      await act(async () => {
        await expect(result.current.requestPermission()).rejects.toThrow(
          "Temporary installation sync failure"
        );
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(6);
      });

      const recoveredUpsertCall = mockFetch.mock.calls[5];
      const recoveredUpsertPayload = JSON.parse(
        String(recoveredUpsertCall?.[1]?.body ?? "{}")
      ) as {
        lifecycle_event: string;
        runtime: { metadata_revision: number };
        registration: { subscription: { endpoint: string } };
      };

      expect(rotatedPushSubscription.unsubscribe).toHaveBeenCalledTimes(1);
      expect(mockPushManager.subscribe).toHaveBeenCalledTimes(2);
      expect(recoveredUpsertPayload.lifecycle_event).toBe("client_updated");
      expect(recoveredUpsertPayload.runtime.metadata_revision).toBe(5);
      expect(recoveredUpsertPayload.registration.subscription.endpoint).toBe(
        rotatedPushSubscription.endpoint
      );
    });

    it("caps auto sync recovery attempts after repeated rotated upsert failures", async () => {
      document.cookie = "XSRF-TOKEN=test-xsrf-token; path=/";
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "granted",
      });

      let currentSubscription: typeof mockPushSubscription | null =
        mockPushSubscription;
      const rotatedPushSubscription = {
        endpoint:
          "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABoQ2FwcGVkLXJvdGF0aW9uLXN1YnNjcmlwdGlvbi0xMjM0NTY",
        expirationTime: 1782568800000,
        toJSON: vi.fn().mockReturnValue({
          endpoint:
            "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABoQ2FwcGVkLXJvdGF0aW9uLXN1YnNjcmlwdGlvbi0xMjM0NTY",
          expirationTime: 1782568800000,
          keys: {
            p256dh: "BMozillaCappedP256dh0123456789abcdefghijklmnopqrstu",
            auth: "Qm9RqSt8VwX",
          },
        }),
        unsubscribe: vi.fn().mockImplementation(async () => {
          currentSubscription = null;
          return true;
        }),
      };

      mockPushSubscription.unsubscribe.mockImplementationOnce(async () => {
        currentSubscription = null;
        return true;
      });
      mockPushManager.getSubscription.mockImplementation(
        async () => currentSubscription
      );
      mockPushManager.subscribe.mockImplementation(async () => {
        currentSubscription = rotatedPushSubscription;
        return rotatedPushSubscription;
      });

      const createBootstrapResponse = (
        metadataRevision: number,
        vapidPublicKey: string
      ) =>
        new Response(
          JSON.stringify({
            data: {
              client_platform: "browser",
              compatibility: {
                bootstrap_version: "v1",
                schema_version: 3,
              },
              features: {
                notification_channels: {
                  android_fcm: false,
                  web_push: true,
                },
              },
              notification_channels: {
                web_push: {
                  channel: "web_push",
                  metadata_revision: metadataRevision,
                  public_runtime_metadata: {
                    vapid_public_key: vapidPublicKey,
                  },
                },
              },
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      const createRuntimeStateInvalidResponse = () =>
        new Response(
          JSON.stringify({
            message:
              "Notification runtime metadata changed; refresh bootstrap before retrying this installation update.",
            code: "NOTIFICATION_RUNTIME_STATE_INVALID",
            details: {
              bootstrap_version: "v1",
              schema_version: 3,
              channel: "web_push",
              provided_metadata_revision: 4,
              expected_metadata_revision: 5,
            },
          }),
          {
            status: 409,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      const createTemporaryFailureResponse = () =>
        new Response(
          JSON.stringify({
            message: "Temporary installation sync failure",
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      const responses = [
        createBootstrapResponse(
          4,
          "BE9tfo-aCxwtPk9QYXKDlAUGBwgJCgsMDQ4PEBESExQVobLD1OX2BxgpMEFSY3SFlgcYKTBLXG1-j5ABAgMEBQA"
        ),
        createRuntimeStateInvalidResponse(),
        createBootstrapResponse(
          5,
          "BE9tfo-aCxwtPk9QYXKDlAUGBwgJCgsMDQ4PEBESExQVobLD1OX2BxgpMEFSY3SFlgcYKTBLXG1-j5ABAgMEBQY"
        ),
        createTemporaryFailureResponse(),
        createBootstrapResponse(
          4,
          "BE9tfo-aCxwtPk9QYXKDlAUGBwgJCgsMDQ4PEBESExQVobLD1OX2BxgpMEFSY3SFlgcYKTBLXG1-j5ABAgMEBQA"
        ),
        createRuntimeStateInvalidResponse(),
        createBootstrapResponse(
          5,
          "BE9tfo-aCxwtPk9QYXKDlAUGBwgJCgsMDQ4PEBESExQVobLD1OX2BxgpMEFSY3SFlgcYKTBLXG1-j5ABAgMEBQY"
        ),
        createTemporaryFailureResponse(),
      ];
      let responseIndex = 0;
      const mockFetch = vi.fn(() => {
        const response = responses[responseIndex];
        responseIndex += 1;

        if (!response) {
          throw new Error("Unexpected extra auto-sync retry");
        }

        return Promise.resolve(response);
      });

      vi.stubGlobal("fetch", mockFetch);

      const { result } = renderHook(
        () => useNotifications({ autoSync: true }),
        {
          wrapper: AuthenticatedWrapper,
        }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(8);
        expect(result.current.error?.message).toBe(
          "Temporary installation sync failure"
        );
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(mockFetch).toHaveBeenCalledTimes(8);
    });

    it("revokes the authenticated browser installation and clears local push state when permission is denied", async () => {
      document.cookie = "XSRF-TOKEN=test-xsrf-token; path=/";
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "denied",
      });

      const installationId = getOrCreateBrowserPushInstallationId();

      mockPushManager.getSubscription.mockResolvedValue(mockPushSubscription);

      const mockFetch = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              installation_id: installationId,
              channel: "web_push",
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
      );

      vi.stubGlobal("fetch", mockFetch);

      renderHook(() => useNotifications({ autoSync: true }), {
        wrapper: AuthenticatedWrapper,
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(
            `/v1/me/notification-installations/${installationId}`
          ),
          expect.objectContaining({
            credentials: "include",
            method: "DELETE",
          })
        );
      });

      expect(mockPushSubscription.unsubscribe).toHaveBeenCalledTimes(1);
      expect(peekBrowserPushInstallationId()).toBeNull();
    });

    it("skips denied auto-sync cleanup while unauthenticated", async () => {
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "denied",
      });

      const installationId = getOrCreateBrowserPushInstallationId();

      mockPushManager.getSubscription.mockResolvedValue(mockPushSubscription);

      const UnauthenticatedWrapper = ({ children }: { children: ReactNode }) =>
        createElement(
          AuthContext.Provider,
          {
            value: {
              ...authenticatedAuthContextValue,
              isAuthenticated: false,
              user: null,
            },
          },
          children
        );

      renderHook(() => useNotifications({ autoSync: true }), {
        wrapper: UnauthenticatedWrapper,
      });

      await waitFor(() => {
        expect(mockPushManager.getSubscription).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockPushManager.getSubscription).toHaveBeenCalledTimes(1);
      expect(mockPushSubscription.unsubscribe).not.toHaveBeenCalled();
      expect(peekBrowserPushInstallationId()).toBe(installationId);
    });

    it("waits for auth bootstrap before denied auto-sync cleanup", async () => {
      document.cookie = "XSRF-TOKEN=test-xsrf-token; path=/";
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "denied",
      });

      const installationId = getOrCreateBrowserPushInstallationId();
      let authContextValue: AuthContextType = {
        ...authenticatedAuthContextValue,
        isAuthenticated: false,
        isLoading: true,
        user: null,
      };

      mockPushManager.getSubscription.mockResolvedValue(mockPushSubscription);

      const mockFetch = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              installation_id: installationId,
              channel: "web_push",
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
      );

      vi.stubGlobal("fetch", mockFetch);

      const AuthBootstrapWrapper = ({ children }: { children: ReactNode }) =>
        createElement(
          AuthContext.Provider,
          { value: authContextValue },
          children
        );

      const { rerender } = renderHook(
        () => useNotifications({ autoSync: true }),
        {
          wrapper: AuthBootstrapWrapper,
        }
      );

      await waitFor(() => {
        expect(mockPushManager.getSubscription).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockPushSubscription.unsubscribe).not.toHaveBeenCalled();
      expect(peekBrowserPushInstallationId()).toBe(installationId);

      authContextValue = authenticatedAuthContextValue;

      await act(async () => {
        rerender();
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(
            `/v1/me/notification-installations/${installationId}`
          ),
          expect.objectContaining({
            credentials: "include",
            method: "DELETE",
          })
        );
      });

      expect(mockPushSubscription.unsubscribe).toHaveBeenCalledTimes(1);
      expect(peekBrowserPushInstallationId()).toBeNull();
    });

    it("does not re-run denied auto-sync cleanup when auth state changes", async () => {
      document.cookie = "XSRF-TOKEN=test-xsrf-token; path=/";
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "denied",
      });

      const installationId = getOrCreateBrowserPushInstallationId();
      let isAuthenticated = true;

      mockPushManager.getSubscription.mockResolvedValue(mockPushSubscription);

      const mockFetch = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              installation_id: installationId,
              channel: "web_push",
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
      );

      vi.stubGlobal("fetch", mockFetch);

      const AuthStateWrapper = ({ children }: { children: ReactNode }) =>
        createElement(
          AuthContext.Provider,
          {
            value: {
              ...authenticatedAuthContextValue,
              isAuthenticated,
              user: isAuthenticated ? authenticatedAuthContextValue.user : null,
            },
          },
          children
        );

      const { rerender } = renderHook(
        () => useNotifications({ autoSync: true }),
        {
          wrapper: AuthStateWrapper,
        }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockPushSubscription.unsubscribe).toHaveBeenCalledTimes(1);
      });

      const getSubscriptionCallCount =
        mockPushManager.getSubscription.mock.calls.length;
      const fetchCallCount = mockFetch.mock.calls.length;
      const unsubscribeCallCount =
        mockPushSubscription.unsubscribe.mock.calls.length;

      isAuthenticated = false;

      await act(async () => {
        rerender();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockPushManager.getSubscription).toHaveBeenCalledTimes(
        getSubscriptionCallCount
      );
      expect(mockFetch).toHaveBeenCalledTimes(fetchCallCount);
      expect(mockPushSubscription.unsubscribe).toHaveBeenCalledTimes(
        unsubscribeCallCount
      );
    });

    it("preserves the local push installation ID when remote revocation fails", async () => {
      document.cookie = "XSRF-TOKEN=test-xsrf-token; path=/";
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "denied",
      });

      const installationId = getOrCreateBrowserPushInstallationId();
      const networkError = new Error("network down");

      mockPushManager.getSubscription.mockResolvedValue(mockPushSubscription);

      const mockFetch = vi.fn().mockRejectedValueOnce(networkError);

      vi.stubGlobal("fetch", mockFetch);

      const { result } = renderHook(
        () => useNotifications({ autoSync: true }),
        {
          wrapper: AuthenticatedWrapper,
        }
      );

      await waitFor(() => {
        expect(mockPushSubscription.unsubscribe).toHaveBeenCalledTimes(1);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `/v1/me/notification-installations/${installationId}`
        ),
        expect.objectContaining({
          credentials: "include",
          method: "DELETE",
        })
      );
      expect(peekBrowserPushInstallationId()).toBe(installationId);
      expect(result.current.error).toBe(networkError);
    });

    it("surfaces both revoke and unsubscribe failures", async () => {
      document.cookie = "XSRF-TOKEN=test-xsrf-token; path=/";
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "denied",
      });

      const installationId = getOrCreateBrowserPushInstallationId();
      const networkError = new Error("network down");
      const unsubscribeError = new Error("unsubscribe blocked");

      mockPushManager.getSubscription.mockResolvedValue(mockPushSubscription);
      mockPushSubscription.unsubscribe.mockRejectedValueOnce(unsubscribeError);

      const mockFetch = vi.fn().mockRejectedValueOnce(networkError);

      vi.stubGlobal("fetch", mockFetch);

      const { result } = renderHook(
        () => useNotifications({ autoSync: true }),
        {
          wrapper: AuthenticatedWrapper,
        }
      );

      await waitFor(() => {
        expect(result.current.error).toBeInstanceOf(AggregateError);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `/v1/me/notification-installations/${installationId}`
        ),
        expect.objectContaining({
          credentials: "include",
          method: "DELETE",
        })
      );
      expect(mockPushSubscription.unsubscribe).toHaveBeenCalledTimes(1);
      expect(peekBrowserPushInstallationId()).toBe(installationId);
      expect(result.current.error).toMatchObject({
        errors: [networkError, unsubscribeError],
        message: "Failed to fully revoke browser push state",
      });
    });

    it("does not recreate an installation when logout cancels an in-flight auto sync", async () => {
      document.cookie = "XSRF-TOKEN=test-xsrf-token; path=/";
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "granted",
      });

      let authContextValue: AuthContextType = authenticatedAuthContextValue;
      let resolveBootstrapResponse: ((response: Response) => void) | null =
        null;

      function DynamicAuthWrapper({ children }: { children: ReactNode }) {
        return createElement(
          AuthContext.Provider,
          {
            value: authContextValue,
          },
          children
        );
      }

      mockPushManager.getSubscription.mockResolvedValue(mockPushSubscription);

      const mockFetch = vi.fn((input, init) => {
        const url = String(input);

        if (url.includes("/v1/bootstrap?client_platform=browser")) {
          return new Promise<Response>((resolve) => {
            resolveBootstrapResponse = resolve;
          });
        }

        if (
          /\/v1\/me\/notification-installations\//.test(url) &&
          init?.method === "PUT"
        ) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: {
                  installation_id: "installation-id",
                  channel: "web_push",
                },
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                },
              }
            )
          );
        }

        throw new Error(`Unexpected fetch request: ${url}`);
      });

      vi.stubGlobal("fetch", mockFetch);

      const { rerender } = renderHook(
        () => useNotifications({ autoSync: true }),
        {
          wrapper: DynamicAuthWrapper,
        }
      );

      await waitFor(() => {
        expect(resolveBootstrapResponse).not.toBeNull();
      });

      authContextValue = {
        ...authenticatedAuthContextValue,
        user: null,
        isAuthenticated: false,
      };
      rerender();

      await act(async () => {
        resolveBootstrapResponse?.(
          new Response(
            JSON.stringify({
              data: {
                client_platform: "browser",
                compatibility: {
                  bootstrap_version: "v1",
                  schema_version: 3,
                },
                features: {
                  notification_channels: {
                    android_fcm: false,
                    web_push: true,
                  },
                },
                notification_channels: {
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
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(peekBrowserPushInstallationId()).toBeNull();
    });

    it("does not create or upsert a browser push installation while logout revocation is in progress", async () => {
      document.cookie = "XSRF-TOKEN=test-xsrf-token; path=/";
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "granted",
      });

      let resolveBootstrapResponse: ((response: Response) => void) | null =
        null;

      mockPushManager.getSubscription.mockResolvedValue(mockPushSubscription);

      const mockFetch = vi.fn((input, init) => {
        const url = String(input);

        if (url.includes("/v1/bootstrap?client_platform=browser")) {
          return new Promise<Response>((resolve) => {
            resolveBootstrapResponse = resolve;
          });
        }

        if (
          /\/v1\/me\/notification-installations\//.test(url) &&
          init?.method === "PUT"
        ) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: {
                  installation_id: "installation-id",
                  channel: "web_push",
                },
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                },
              }
            )
          );
        }

        throw new Error(`Unexpected fetch request: ${url}`);
      });

      vi.stubGlobal("fetch", mockFetch);

      renderHook(() => useNotifications({ autoSync: true }), {
        wrapper: AuthenticatedWrapper,
      });

      await waitFor(() => {
        expect(resolveBootstrapResponse).not.toBeNull();
      });

      setBrowserPushLogoutInProgress(true);

      await act(async () => {
        resolveBootstrapResponse?.(
          new Response(
            JSON.stringify({
              data: {
                client_platform: "browser",
                compatibility: {
                  bootstrap_version: "v1",
                  schema_version: 3,
                },
                features: {
                  notification_channels: {
                    android_fcm: false,
                    web_push: true,
                  },
                },
                notification_channels: {
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
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(peekBrowserPushInstallationId()).toBeNull();
    });

    it("re-registers after service worker replacement when another hook instance grants permission", async () => {
      document.cookie = "XSRF-TOKEN=test-xsrf-token; path=/";

      const controllerChangeHandlers: Array<() => void> = [];
      let currentSubscription: typeof mockPushSubscription | null = null;

      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          ready: Promise.resolve(mockServiceWorkerRegistration),
          addEventListener: vi.fn((event: string, callback: () => void) => {
            if (event === "controllerchange") {
              controllerChangeHandlers.push(callback);
            }
          }),
          removeEventListener: vi.fn(),
        },
        writable: true,
        configurable: true,
      });

      mockPushManager.getSubscription.mockImplementation(
        async () => currentSubscription
      );
      mockPushManager.subscribe.mockImplementation(async () => {
        currentSubscription = mockPushSubscription;
        return mockPushSubscription;
      });

      globalThis.Notification.requestPermission = vi
        .fn()
        .mockImplementation(async () => {
          Object.defineProperty(globalThis.Notification, "permission", {
            writable: true,
            value: "granted",
          });
          return "granted";
        });

      const mockFetch = vi.fn((input, init) => {
        const url = String(input);

        if (url.includes("/v1/bootstrap?client_platform=browser")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: {
                  client_platform: "browser",
                  compatibility: {
                    bootstrap_version: "v1",
                    schema_version: 3,
                  },
                  features: {
                    notification_channels: {
                      android_fcm: false,
                      web_push: true,
                    },
                  },
                  notification_channels: {
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
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                },
              }
            )
          );
        }

        if (
          /\/v1\/me\/notification-installations\//.test(url) &&
          init?.method === "PUT"
        ) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: {
                  installation_id: "installation-id",
                  channel: "web_push",
                },
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                },
              }
            )
          );
        }

        throw new Error(`Unexpected fetch request: ${url}`);
      });

      vi.stubGlobal("fetch", mockFetch);

      renderHook(() => useNotifications({ autoSync: true }), {
        wrapper: AuthenticatedWrapper,
      });
      const { result } = renderHook(() => useNotifications(), {
        wrapper: AuthenticatedWrapper,
      });

      await waitFor(() => {
        expect(mockPushManager.getSubscription).toHaveBeenCalledTimes(2);
      });

      await act(async () => {
        await result.current.requestPermission();
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      expect(controllerChangeHandlers).toHaveLength(2);

      await act(async () => {
        controllerChangeHandlers.forEach((handler) => {
          handler();
        });
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(4);
      });

      expect(mockPushManager.subscribe).toHaveBeenCalledTimes(1);
    });

    it("reconciles the authenticated browser subscription again after service worker replacement", async () => {
      document.cookie = "XSRF-TOKEN=test-xsrf-token; path=/";
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "granted",
      });

      const controllerChangeHandlers: Array<() => void> = [];

      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          ready: Promise.resolve(mockServiceWorkerRegistration),
          addEventListener: vi.fn((event: string, callback: () => void) => {
            if (event === "controllerchange") {
              controllerChangeHandlers.push(callback);
            }
          }),
          removeEventListener: vi.fn(),
        },
        writable: true,
        configurable: true,
      });

      mockPushManager.getSubscription.mockResolvedValue(mockPushSubscription);

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                client_platform: "browser",
                compatibility: {
                  bootstrap_version: "v1",
                  schema_version: 3,
                },
                features: {
                  notification_channels: {
                    android_fcm: false,
                    web_push: true,
                  },
                },
                notification_channels: {
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
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                installation_id: "installation-id",
                channel: "web_push",
              },
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                client_platform: "browser",
                compatibility: {
                  bootstrap_version: "v1",
                  schema_version: 3,
                },
                features: {
                  notification_channels: {
                    android_fcm: false,
                    web_push: true,
                  },
                },
                notification_channels: {
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
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                installation_id: "installation-id",
                channel: "web_push",
              },
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        );

      vi.stubGlobal("fetch", mockFetch);

      renderHook(() => useNotifications({ autoSync: true }), {
        wrapper: AuthenticatedWrapper,
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      expect(controllerChangeHandlers).toHaveLength(1);

      await act(async () => {
        controllerChangeHandlers.forEach((handler) => {
          handler();
        });
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(4);
      });

      expect(mockPushManager.subscribe).not.toHaveBeenCalled();
    });
  });
});
