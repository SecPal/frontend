// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLoginRateLimiter } from "./useLoginRateLimiter";

const STORAGE_KEY = "login_rate_limit";

describe("useLoginRateLimiter", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("should start with 5 remaining attempts", () => {
      const { result } = renderHook(() => useLoginRateLimiter());

      expect(result.current.remainingAttempts).toBe(5);
      expect(result.current.isLocked).toBe(false);
      expect(result.current.lockoutEndTime).toBeNull();
    });

    it("should restore state from localStorage on mount", () => {
      const storedState = {
        attempts: 3,
        lockoutEndTime: null,
        lastAttemptTime: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));

      const { result } = renderHook(() => useLoginRateLimiter());

      expect(result.current.remainingAttempts).toBe(2); // 5 - 3 = 2
      expect(result.current.isLocked).toBe(false);
    });

    it("should reset attempts if stored data is older than 15 minutes", () => {
      const fifteenMinutesAgo = Date.now() - 16 * 60 * 1000;
      const storedState = {
        attempts: 4,
        lockoutEndTime: null,
        lastAttemptTime: fifteenMinutesAgo,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));

      const { result } = renderHook(() => useLoginRateLimiter());

      expect(result.current.remainingAttempts).toBe(5); // Reset due to age
    });

    it("should restore active lockout from localStorage", () => {
      const futureTime = Date.now() + 30000; // 30 seconds in future
      const storedState = {
        attempts: 5,
        lockoutEndTime: futureTime,
        lastAttemptTime: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));

      const { result } = renderHook(() => useLoginRateLimiter());

      expect(result.current.isLocked).toBe(true);
      expect(result.current.lockoutEndTime).toBe(futureTime);
      expect(result.current.remainingAttempts).toBe(0);
    });

    it("should clear expired lockout from localStorage", () => {
      const pastTime = Date.now() - 1000; // 1 second ago
      const storedState = {
        attempts: 5,
        lockoutEndTime: pastTime,
        lastAttemptTime: Date.now() - 31000,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));

      const { result } = renderHook(() => useLoginRateLimiter());

      expect(result.current.isLocked).toBe(false);
      expect(result.current.remainingAttempts).toBe(5);
    });
  });

  describe("recordFailedAttempt", () => {
    it("should decrement remaining attempts on failed login", () => {
      const { result } = renderHook(() => useLoginRateLimiter());

      act(() => {
        result.current.recordFailedAttempt();
      });

      expect(result.current.remainingAttempts).toBe(4);
      expect(result.current.isLocked).toBe(false);
    });

    it("should persist attempt count to localStorage", () => {
      const { result } = renderHook(() => useLoginRateLimiter());

      act(() => {
        result.current.recordFailedAttempt();
      });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(stored.attempts).toBe(1);
    });

    it("should trigger lockout after 5 failed attempts", () => {
      const { result } = renderHook(() => useLoginRateLimiter());

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.recordFailedAttempt();
        });
      }

      expect(result.current.remainingAttempts).toBe(0);
      expect(result.current.isLocked).toBe(true);
      expect(result.current.lockoutEndTime).not.toBeNull();
    });

    it("should set lockout duration to 30 seconds", () => {
      const { result } = renderHook(() => useLoginRateLimiter());
      const now = Date.now();

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.recordFailedAttempt();
        });
      }

      const lockoutEnd = result.current.lockoutEndTime!;
      // Lockout should be approximately 30 seconds from now
      expect(lockoutEnd - now).toBeGreaterThanOrEqual(29000);
      expect(lockoutEnd - now).toBeLessThanOrEqual(31000);
    });

    it("should not count additional attempts while locked", () => {
      const { result } = renderHook(() => useLoginRateLimiter());

      // Trigger lockout
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.recordFailedAttempt();
        });
      }

      const lockoutEnd = result.current.lockoutEndTime;

      // Try to add more attempts while locked
      act(() => {
        result.current.recordFailedAttempt();
      });

      // Lockout end time should not change
      expect(result.current.lockoutEndTime).toBe(lockoutEnd);
    });
  });

  describe("canAttemptLogin", () => {
    it("should return true when attempts remain", () => {
      const { result } = renderHook(() => useLoginRateLimiter());

      expect(result.current.canAttemptLogin()).toBe(true);
    });

    it("should return false when locked", () => {
      const { result } = renderHook(() => useLoginRateLimiter());

      // Trigger lockout
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.recordFailedAttempt();
        });
      }

      expect(result.current.canAttemptLogin()).toBe(false);
    });
  });

  describe("lockout expiration", () => {
    it("should automatically unlock after lockout duration expires", () => {
      const { result } = renderHook(() => useLoginRateLimiter());

      // Trigger lockout
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.recordFailedAttempt();
        });
      }

      expect(result.current.isLocked).toBe(true);

      // Advance time past lockout period (30 seconds)
      act(() => {
        vi.advanceTimersByTime(31000);
      });

      expect(result.current.isLocked).toBe(false);
      expect(result.current.remainingAttempts).toBe(5);
      expect(result.current.canAttemptLogin()).toBe(true);
    });

    it("should provide remaining lockout seconds", () => {
      const { result } = renderHook(() => useLoginRateLimiter());

      // Trigger lockout
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.recordFailedAttempt();
        });
      }

      // Just triggered, should be ~30 seconds
      expect(result.current.remainingLockoutSeconds).toBeGreaterThanOrEqual(29);
      expect(result.current.remainingLockoutSeconds).toBeLessThanOrEqual(30);

      // Advance 10 seconds
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Should be ~20 seconds now
      expect(result.current.remainingLockoutSeconds).toBeGreaterThanOrEqual(19);
      expect(result.current.remainingLockoutSeconds).toBeLessThanOrEqual(21);
    });

    it("should return 0 remaining seconds when not locked", () => {
      const { result } = renderHook(() => useLoginRateLimiter());

      expect(result.current.remainingLockoutSeconds).toBe(0);
    });
  });

  describe("resetAttempts", () => {
    it("should reset attempts after successful login", () => {
      const { result } = renderHook(() => useLoginRateLimiter());

      // Make some failed attempts (each in separate act to allow state updates)
      act(() => {
        result.current.recordFailedAttempt();
      });
      act(() => {
        result.current.recordFailedAttempt();
      });

      expect(result.current.remainingAttempts).toBe(3);

      // Simulate successful login
      act(() => {
        result.current.resetAttempts();
      });

      expect(result.current.remainingAttempts).toBe(5);
      expect(result.current.isLocked).toBe(false);
    });

    it("should clear localStorage on reset", () => {
      const { result } = renderHook(() => useLoginRateLimiter());

      act(() => {
        result.current.recordFailedAttempt();
      });

      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

      act(() => {
        result.current.resetAttempts();
      });

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle corrupted localStorage data gracefully", () => {
      localStorage.setItem(STORAGE_KEY, "invalid-json");

      const { result } = renderHook(() => useLoginRateLimiter());

      expect(result.current.remainingAttempts).toBe(5);
      expect(result.current.isLocked).toBe(false);
    });

    it("should handle missing localStorage fields gracefully", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ attempts: 2 }));

      const { result } = renderHook(() => useLoginRateLimiter());

      // Should still work with partial data
      expect(result.current.remainingAttempts).toBe(3);
    });

    it("should cleanup interval on unmount", () => {
      const { result, unmount } = renderHook(() => useLoginRateLimiter());

      // Trigger lockout
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.recordFailedAttempt();
        });
      }

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });
  });
});
