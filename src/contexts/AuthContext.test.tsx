// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "../hooks/useAuth";
import { getCurrentUser } from "../services/authApi";
import { sanitizePersistedAuthUser } from "../services/authState";
import { isOnline } from "../services/sessionEvents";
import {
  AUTH_VAULT_STORAGE_KEY,
  clearOfflineVaultSession,
} from "../lib/offlineVault";
import {
  clearBrowserPushClientState,
  clearSensitiveClientState,
} from "../lib/clientStateCleanup";
import { authStorage } from "../services/storage";
import { resetPrefetchCache } from "../hooks/usePrefetch";
import { syncOfflineSessionAccess } from "../lib/serviceWorkerSession";
import { NATIVE_AUTH_LOGOUT_EVENT_NAME } from "../services/nativeAuthEvents";

vi.mock("../services/authApi", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("../hooks/usePrefetch", async () => {
  const actual = await vi.importActual<typeof import("../hooks/usePrefetch")>(
    "../hooks/usePrefetch"
  );
  return {
    ...actual,
    resetPrefetchCache: vi.fn(),
  };
});

vi.mock("../lib/serviceWorkerSession", () => ({
  syncOfflineSessionAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/clientStateCleanup", () => ({
  clearSensitiveClientState: mockClearSensitiveClientState,
  clearDestructiveSensitiveClientState: mockClearSensitiveClientState,
  clearBrowserPushClientState: mockClearBrowserPushClientState,
}));

type SessionEventName = "session:expired" | "session:invalid";
type SessionEventHandler = () => void;
const sessionEventHandlers = new Map<SessionEventName, SessionEventHandler[]>();

vi.mock("../services/sessionEvents", () => ({
  isOnline: vi.fn(() => false),
  sessionEvents: {
    on: vi.fn((event: SessionEventName, handler: SessionEventHandler) => {
      const list = sessionEventHandlers.get(event) ?? [];
      list.push(handler);
      sessionEventHandlers.set(event, list);
      return () => {
        const current = sessionEventHandlers.get(event) ?? [];
        sessionEventHandlers.set(
          event,
          current.filter((registered) => registered !== handler)
        );
      };
    }),
  },
}));

// Test component for permission checks
function PermissionTestComponent({ permission }: { permission?: string }) {
  const auth = useAuth();
  return (
    <div>
      {permission && (
        <span data-testid="hasPermission">
          {auth.hasPermission(permission) ? "true" : "false"}
        </span>
      )}
      <span data-testid="hasOrgAccess">
        {auth.hasOrganizationalAccess() ? "true" : "false"}
      </span>
    </div>
  );
}

async function seedStoredUser(user: Record<string, unknown>) {
  const persistedUser = sanitizePersistedAuthUser({
    emailVerified: false,
    ...user,
  });

  if (!persistedUser) {
    throw new Error("Failed to seed persisted auth user for test");
  }

  await authStorage.setUser(persistedUser);
}

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
    clearOfflineVaultSession();
    document.cookie = `XSRF-TOKEN=;expires=${new Date(0).toUTCString()};path=/`;
    document.cookie = "XSRF-TOKEN=test-csrf-token;path=/";
    sessionEventHandlers.clear();
    vi.mocked(getCurrentUser).mockReset();
    vi.mocked(isOnline).mockReturnValue(false);
    vi.mocked(resetPrefetchCache).mockClear();
    vi.mocked(syncOfflineSessionAccess).mockClear();
  });

  afterEach(() => {
    clearOfflineVaultSession();
  });

  describe("hasPermission", () => {
    it("returns true for direct permission match", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        permissions: ["employees.read", "employees.create"],
      });

      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.read" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasPermission")).toHaveTextContent("true");
      });
    });

    it("returns false when permission is not present", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        permissions: ["employees.read"],
      });

      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.delete" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasPermission")).toHaveTextContent("false");
      });
    });

    it("returns true for wildcard permission match", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        permissions: ["employees.*"],
      });

      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.delete" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasPermission")).toHaveTextContent("true");
      });
    });

    it("does not match wildcard across different resources", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        permissions: ["employees.*"],
      });

      render(
        <AuthProvider>
          <PermissionTestComponent permission="shifts.read" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasPermission")).toHaveTextContent("false");
      });
    });

    it("returns false when user has no permissions", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
      });

      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.read" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasPermission")).toHaveTextContent("false");
      });
    });

    it("returns false when user is null", () => {
      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.read" />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasPermission")).toHaveTextContent("false");
    });

    it("handles permission without dot separator", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        permissions: ["manage"],
      });

      render(
        <AuthProvider>
          <PermissionTestComponent permission="manage" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasPermission")).toHaveTextContent("true");
      });
    });
  });

  describe("hasOrganizationalAccess", () => {
    it("returns true when hasOrganizationalScopes is true", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        hasOrganizationalScopes: true,
      });

      render(
        <AuthProvider>
          <PermissionTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasOrgAccess")).toHaveTextContent("true");
      });
    });

    it("returns false when hasOrganizationalScopes is false", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        hasOrganizationalScopes: false,
      });

      render(
        <AuthProvider>
          <PermissionTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasOrgAccess")).toHaveTextContent("false");
      });
    });

    it("returns false when hasOrganizationalScopes is undefined", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
      });

      render(
        <AuthProvider>
          <PermissionTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasOrgAccess")).toHaveTextContent("false");
      });
    });

    it("returns false when user is null", () => {
      render(
        <AuthProvider>
          <PermissionTestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasOrgAccess")).toHaveTextContent("false");
    });
  });

  describe("login updates permission state", () => {
    it("updates hasOrganizationalAccess after login", async () => {
      const LoginComponent = () => {
        const auth = useAuth();
        return (
          <div>
            <span data-testid="hasOrgAccess">
              {auth.hasOrganizationalAccess() ? "true" : "false"}
            </span>
            <button
              onClick={() =>
                auth.login({
                  id: "1",
                  name: "Test",
                  email: "test@test.com",
                  hasOrganizationalScopes: true,
                })
              }
            >
              Login
            </button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <LoginComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasOrgAccess")).toHaveTextContent("false");

      act(() => {
        screen.getByText("Login").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("hasOrgAccess")).toHaveTextContent("true");
      });
    });
  });

  describe("login handoff after timed-out logout cleanup", () => {
    function SessionSwitchComponent() {
      const auth = useAuth();

      return (
        <div>
          <span data-testid="userEmail">{auth.user?.email ?? "none"}</span>
          <button type="button" onClick={() => void auth.logout()}>
            Logout
          </button>
          <button
            type="button"
            onClick={() =>
              void auth.login({
                id: "2",
                name: "Next User",
                email: "next@secpal.dev",
              })
            }
          >
            Login Next User
          </button>
        </div>
      );
    }

    it("finishes destructive cleanup before persisting the next user when trailing logout cleanup times out", async () => {
      await seedStoredUser({
        id: "1",
        name: "Current User",
        email: "current@secpal.dev",
      });

      render(
        <AuthProvider>
          <SessionSwitchComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("userEmail")).toHaveTextContent(
          "current@secpal.dev"
        );
      });

      const pushCleanupPromise = new Promise<void>(() => {});
      const setUserSpy = vi.spyOn(authStorage, "setUser");

      vi.mocked(clearSensitiveClientState).mockClear();
      vi.mocked(clearBrowserPushClientState).mockClear();
      vi.mocked(clearBrowserPushClientState).mockImplementationOnce(
        () => pushCleanupPromise
      );
      vi.useFakeTimers();

      try {
        await act(async () => {
          screen.getByRole("button", { name: /logout/i }).click();
        });

        expect(screen.getByTestId("userEmail")).toHaveTextContent("none");

        await act(async () => {
          vi.advanceTimersByTime(5_000);
          await Promise.resolve();
        });

        await act(async () => {
          screen.getByRole("button", { name: /login next user/i }).click();
          await Promise.resolve();
        });

        await act(async () => {
          vi.advanceTimersByTime(5_000);
          await Promise.resolve();
        });

        expect(setUserSpy).toHaveBeenCalledTimes(1);

        const cleanupCallOrder = vi.mocked(clearSensitiveClientState).mock
          .invocationCallOrder[0]!;
        const setUserCallOrder = setUserSpy.mock.invocationCallOrder[0]!;

        expect(clearSensitiveClientState).toHaveBeenCalledTimes(1);
        expect(cleanupCallOrder).toBeLessThan(setUserCallOrder);
      } finally {
        vi.useRealTimers();
        setUserSpy.mockRestore();
      }
    });
  });

  describe("cross-tab storage event error path", () => {
    it("clears auth state when getUser throws during cross-tab storage event", async () => {
      const VaultStatusComponent = () => {
        const auth = useAuth();
        return (
          <span data-testid="isVaultLocked">
            {auth.isVaultLocked ? "true" : "false"}
          </span>
        );
      };

      vi.spyOn(authStorage, "getUser").mockRejectedValueOnce(
        new Error("Simulated decrypt failure")
      );

      render(
        <AuthProvider>
          <VaultStatusComponent />
        </AuthProvider>
      );

      await act(async () => {
        const storageEvent = new Event("storage");
        Object.defineProperties(storageEvent, {
          key: { value: AUTH_VAULT_STORAGE_KEY },
          newValue: { value: "corrupted-data" },
          storageArea: { value: localStorage },
        });
        window.dispatchEvent(storageEvent);
        await new Promise((r) => setTimeout(r, 0));
      });

      await waitFor(() => {
        expect(screen.getByTestId("isVaultLocked")).toHaveTextContent("false");
      });
    });
  });

  describe("prefetch cache isolation across session teardown", () => {
    function LogoutButton() {
      const { logout } = useAuth();
      return (
        <button type="button" onClick={() => void logout()}>
          logout
        </button>
      );
    }

    it("clears the prefetch cache on explicit logout", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        permissions: ["employees.read"],
      });

      render(
        <AuthProvider>
          <LogoutButton />
        </AuthProvider>
      );

      const logoutButton = await screen.findByRole("button", {
        name: /logout/i,
      });

      await act(async () => {
        logoutButton.click();
        await new Promise((r) => setTimeout(r, 0));
      });

      await waitFor(() => {
        expect(resetPrefetchCache).toHaveBeenCalled();
      });
    });

    it("clears the prefetch cache when session:expired tears down the session", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        permissions: ["employees.read"],
      });

      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.read" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasPermission")).toHaveTextContent("true");
      });

      await waitFor(() => {
        expect(sessionEventHandlers.get("session:expired")).toHaveLength(1);
      });

      vi.mocked(resetPrefetchCache).mockClear();

      await act(async () => {
        const handlers = sessionEventHandlers.get("session:expired") ?? [];
        handlers.forEach((handler) => handler());
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(resetPrefetchCache).toHaveBeenCalled();
    });

    it("tears down native logout events without service-worker client redirects", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        permissions: ["employees.read"],
      });

      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.read" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasPermission")).toHaveTextContent("true");
      });

      vi.mocked(resetPrefetchCache).mockClear();
      vi.mocked(syncOfflineSessionAccess).mockClear();

      await act(async () => {
        window.dispatchEvent(new Event(NATIVE_AUTH_LOGOUT_EVENT_NAME));
        await new Promise((r) => setTimeout(r, 0));
      });

      await waitFor(() => {
        expect(screen.getByTestId("hasPermission")).toHaveTextContent("false");
      });

      expect(resetPrefetchCache).toHaveBeenCalled();
      expect(syncOfflineSessionAccess).toHaveBeenCalledWith(false, {
        redirectOpenClients: false,
      });
      expect(syncOfflineSessionAccess).not.toHaveBeenCalledWith(false, {
        redirectOpenClients: true,
      });
    });

    it("updates auth state for native logout even when storage cleanup throws synchronously", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        permissions: ["employees.read"],
      });

      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.read" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasPermission")).toHaveTextContent("true");
      });

      const storageError = new Error("storage unavailable");
      const clearStorageSpy = vi
        .spyOn(authStorage, "clear")
        .mockImplementationOnce(() => {
          throw storageError;
        });
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      try {
        await act(async () => {
          window.dispatchEvent(new Event(NATIVE_AUTH_LOGOUT_EVENT_NAME));
          await new Promise((r) => setTimeout(r, 0));
        });

        await waitFor(() => {
          expect(screen.getByTestId("hasPermission")).toHaveTextContent(
            "false"
          );
        });

        expect(clearStorageSpy).toHaveBeenCalled();
        expect(syncOfflineSessionAccess).toHaveBeenCalledWith(false, {
          redirectOpenClients: false,
        });
      } finally {
        clearStorageSpy.mockRestore();
        consoleWarnSpy.mockRestore();
      }
    });

    it("clears the prefetch cache when cross-tab storage removal falls back to logout", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        permissions: ["employees.read"],
      });

      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.read" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasPermission")).toHaveTextContent("true");
      });

      vi.mocked(resetPrefetchCache).mockClear();

      await act(async () => {
        localStorage.removeItem("auth_user");
        localStorage.removeItem(AUTH_VAULT_STORAGE_KEY);

        const storageEvent = new Event("storage");
        Object.defineProperties(storageEvent, {
          key: { value: AUTH_VAULT_STORAGE_KEY },
          newValue: { value: null },
          storageArea: { value: localStorage },
        });
        window.dispatchEvent(storageEvent);
        await new Promise((r) => setTimeout(r, 0));
      });

      await waitFor(() => {
        expect(screen.getByTestId("hasPermission")).toHaveTextContent("false");
      });

      expect(resetPrefetchCache).toHaveBeenCalled();
    });

    it("does not clear the prefetch cache when browser-session bootstrap revalidation finds no session without a storage mismatch", async () => {
      vi.mocked(isOnline).mockReturnValue(true);
      vi.mocked(getCurrentUser).mockRejectedValueOnce({ status: 401 });

      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.read" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(getCurrentUser).toHaveBeenCalled();
      });

      expect(resetPrefetchCache).not.toHaveBeenCalled();
    });
  });

  describe("pageshow vault lock detection", () => {
    it("sets vault locked state when vault is locked on persisted page restore", async () => {
      const user = {
        id: "1",
        name: "Test User",
        email: "test@secpal.dev",
        emailVerified: false,
      };
      await authStorage.setUser(user);
      authStorage.lockVault();

      const VaultStatusComponent = () => {
        const auth = useAuth();
        return (
          <span data-testid="isVaultLocked">
            {auth.isVaultLocked ? "true" : "false"}
          </span>
        );
      };

      render(
        <AuthProvider>
          <VaultStatusComponent />
        </AuthProvider>
      );

      await act(async () => {
        window.dispatchEvent(
          Object.assign(new Event("pageshow"), { persisted: true })
        );
        await new Promise((r) => setTimeout(r, 0));
      });

      await waitFor(() => {
        expect(screen.getByTestId("isVaultLocked")).toHaveTextContent("true");
      });
    });
  });
});
const mockClearSensitiveClientState = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
);
const mockClearBrowserPushClientState = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
);
