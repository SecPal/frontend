// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { User } from "../contexts/auth-context";

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
}

/**
 * LocalStorage implementation of AuthStorage
 */
class LocalStorageAuthStorage implements AuthStorage {
  private readonly USER_KEY = "auth_user";

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

  getUser(): User | null {
    const storedUser = localStorage.getItem(this.USER_KEY);
    if (!storedUser) return null;

    try {
      return JSON.parse(storedUser) as User;
    } catch (error) {
      console.error("Failed to parse stored user data:", error);
      this.removeUser();
      return null;
    }
  }

  setUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  removeUser(): void {
    localStorage.removeItem(this.USER_KEY);
  }

  clear(): void {
    this.removeUser();
  }
}

/**
 * Default auth storage instance
 * Can be replaced with a mock for testing (Dependency Inversion Principle)
 */
export const authStorage: AuthStorage = new LocalStorageAuthStorage();
