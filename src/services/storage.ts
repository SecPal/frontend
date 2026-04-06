// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { User } from "../contexts/auth-context";
import { sanitizePersistedAuthUser } from "./authState";

/**
 * Storage abstraction layer for auth data
 * Implements Single Responsibility Principle (SOLID)
 * Allows easy mocking in tests and future storage backend changes
 *
 * Note: Token storage was removed in v0.x as authentication now uses
 * httpOnly cookies (Sanctum SPA mode). See issue #246.
 */
export interface AuthStorage {
  getUser(): User | null;
  setUser(user: User): void;
  removeUser(): void;
  clear(): void;
  hasLogoutBarrier(): boolean;
}

/**
 * LocalStorage implementation of AuthStorage
 */
class LocalStorageAuthStorage implements AuthStorage {
  private readonly USER_KEY = "auth_user";
  private readonly LOGOUT_BARRIER_KEY = "auth_logout_barrier";

  /**
   * Clean up any legacy auth_token that might exist from before migration.
   * This is called once on init to ensure no stale tokens remain.
   */
  private cleanupLegacyToken(): void {
    localStorage.removeItem("auth_token");
  }

  constructor() {
    // Clean up any legacy token from before httpOnly cookie migration
    this.cleanupLegacyToken();
  }

  private clearLogoutBarrier(): void {
    localStorage.removeItem(this.LOGOUT_BARRIER_KEY);
  }

  private setLogoutBarrier(): void {
    localStorage.setItem(this.LOGOUT_BARRIER_KEY, "1");
  }

  hasLogoutBarrier(): boolean {
    return localStorage.getItem(this.LOGOUT_BARRIER_KEY) !== null;
  }

  getUser(): User | null {
    if (this.hasLogoutBarrier()) {
      this.removeUser();
      return null;
    }

    const storedUser = localStorage.getItem(this.USER_KEY);
    if (!storedUser) return null;

    try {
      const sanitizedUser = sanitizePersistedAuthUser(JSON.parse(storedUser));

      if (!sanitizedUser) {
        this.removeUser();
        return null;
      }

      return sanitizedUser;
    } catch (error) {
      console.error("Failed to parse stored user data:", error);
      this.removeUser();
      return null;
    }
  }

  setUser(user: User): void {
    const sanitizedUser = sanitizePersistedAuthUser(user);

    if (!sanitizedUser) {
      this.removeUser();
      return;
    }

    this.clearLogoutBarrier();
    // Auth state (name, email, capability flags, and employee lifecycle fields) is
    // stored as cleartext by design: the persisted record intentionally omits the
    // full employee record and only retains the minimal subset required for offline
    // route gating.  The same-origin XSS risk profile is accepted for the same
    // reason existing PII (name, email) is already stored here.  Full at-rest
    // encryption of the persisted auth state is tracked in issue #784.
    // codeql[js/clear-text-storage-of-sensitive-data]
    localStorage.setItem(this.USER_KEY, JSON.stringify(sanitizedUser));
  }

  removeUser(): void {
    localStorage.removeItem(this.USER_KEY);
  }

  clear(): void {
    this.setLogoutBarrier();
    this.removeUser();
  }
}

/**
 * Default auth storage instance
 * Can be replaced with a mock for testing (Dependency Inversion Principle)
 */
export const authStorage: AuthStorage = new LocalStorageAuthStorage();
