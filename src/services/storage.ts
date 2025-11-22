// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { User } from "../contexts/auth-context";

/**
 * Storage abstraction layer for auth data
 * Implements Single Responsibility Principle (SOLID)
 * Allows easy mocking in tests and future storage backend changes
 */
export interface AuthStorage {
  getToken(): string | null;
  setToken(token: string): void;
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
    this.removeToken();
    this.removeUser();
  }
}

/**
 * Default auth storage instance
 * Can be replaced with a mock for testing (Dependency Inversion Principle)
 */
export const authStorage: AuthStorage = new LocalStorageAuthStorage();
