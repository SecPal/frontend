// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { User } from "../contexts/auth-context";

/**
 * Storage abstraction layer for auth data
 * Implements Single Responsibility Principle (SOLID)
 * Allows easy mocking in tests and future storage backend changes
 *
 * @deprecated Token methods (getToken, setToken, removeToken) are deprecated
 * as authentication now uses httpOnly cookies. These methods are scheduled for removal in v2.0.0.
 * See issue #208 (Epic #208) for migration details and timeline.
 */
export interface AuthStorage {
  /** @deprecated Use httpOnly cookies instead */
  getToken(): string | null;
  /** @deprecated Use httpOnly cookies instead */
  setToken(token: string): void;
  /** @deprecated Use httpOnly cookies instead */
  removeToken(): void;
  getUser(): User | null;
  setUser(user: User): void;
  removeUser(): void;
  clear(): void;
}

/**
 * LocalStorage implementation of AuthStorage
 */
class LocalStorageAuthStorage implements AuthStorage {
  private readonly TOKEN_KEY = "auth_token";
  private readonly USER_KEY = "auth_user";

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
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
    // Note: Token methods still called for backwards compatibility
    // but will be removed when token methods are fully removed
    // TODO(#208): Remove token cleanup once fully migrated to httpOnly cookies
    this.removeToken();
    this.removeUser();
  }
}

/**
 * Default auth storage instance
 * Can be replaced with a mock for testing (Dependency Inversion Principle)
 */
export const authStorage: AuthStorage = new LocalStorageAuthStorage();
