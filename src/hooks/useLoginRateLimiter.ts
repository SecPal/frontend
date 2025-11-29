// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "login_rate_limit";
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 1000; // 30 seconds
const ATTEMPT_RESET_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface RateLimitState {
  attempts: number;
  lockoutEndTime: number | null;
  lastAttemptTime: number | null;
}

interface UseLoginRateLimiterResult {
  /** Number of login attempts remaining before lockout */
  remainingAttempts: number;
  /** Whether the user is currently locked out */
  isLocked: boolean;
  /** Unix timestamp when lockout ends, or null if not locked */
  lockoutEndTime: number | null;
  /** Seconds remaining until lockout ends, or 0 if not locked */
  remainingLockoutSeconds: number;
  /** Check if a login attempt is currently allowed */
  canAttemptLogin: () => boolean;
  /** Record a failed login attempt */
  recordFailedAttempt: () => void;
  /** Reset all attempts (call after successful login) */
  resetAttempts: () => void;
}

/**
 * Hook for rate limiting login attempts on the frontend.
 *
 * Features:
 * - Limits to 5 failed attempts before 30-second lockout
 * - Persists state in localStorage to survive page refreshes
 * - Automatically resets after 15 minutes of inactivity
 * - Updates remaining lockout time every second
 */
export function useLoginRateLimiter(): UseLoginRateLimiterResult {
  const [state, setState] = useState<RateLimitState>(() => loadState());
  const [now, setNow] = useState(() => Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update current time every second while locked
  useEffect(() => {
    if (state.lockoutEndTime && state.lockoutEndTime > Date.now()) {
      intervalRef.current = setInterval(() => {
        const currentTime = Date.now();
        setNow(currentTime);

        // Auto-unlock when lockout expires
        if (state.lockoutEndTime && currentTime >= state.lockoutEndTime) {
          setState({
            attempts: 0,
            lockoutEndTime: null,
            lastAttemptTime: null,
          });
          localStorage.removeItem(STORAGE_KEY);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.lockoutEndTime]);

  // Computed values
  const isLocked = state.lockoutEndTime !== null && state.lockoutEndTime > now;
  const remainingAttempts = isLocked ? 0 : MAX_ATTEMPTS - state.attempts;
  const remainingLockoutSeconds = isLocked
    ? Math.max(0, Math.ceil((state.lockoutEndTime! - now) / 1000))
    : 0;

  const canAttemptLogin = useCallback(() => {
    return !isLocked && remainingAttempts > 0;
  }, [isLocked, remainingAttempts]);

  const recordFailedAttempt = useCallback(() => {
    // Don't record attempts while locked
    if (state.lockoutEndTime && state.lockoutEndTime > Date.now()) {
      return;
    }

    const newAttempts = state.attempts + 1;
    const currentTime = Date.now();
    let newLockoutEndTime: number | null = null;

    // Trigger lockout after max attempts
    if (newAttempts >= MAX_ATTEMPTS) {
      newLockoutEndTime = currentTime + LOCKOUT_DURATION_MS;
    }

    const newState: RateLimitState = {
      attempts: newAttempts,
      lockoutEndTime: newLockoutEndTime,
      lastAttemptTime: currentTime,
    };

    setState(newState);
    saveState(newState);
  }, [state.attempts, state.lockoutEndTime]);

  const resetAttempts = useCallback(() => {
    setState({
      attempts: 0,
      lockoutEndTime: null,
      lastAttemptTime: null,
    });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    remainingAttempts,
    isLocked,
    lockoutEndTime: state.lockoutEndTime,
    remainingLockoutSeconds,
    canAttemptLogin,
    recordFailedAttempt,
    resetAttempts,
  };
}

function loadState(): RateLimitState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return getInitialState();
    }

    const parsed = JSON.parse(stored) as Partial<RateLimitState>;
    const now = Date.now();

    // Check if lockout has expired
    if (parsed.lockoutEndTime && parsed.lockoutEndTime <= now) {
      localStorage.removeItem(STORAGE_KEY);
      return getInitialState();
    }

    // Check if attempts should be reset due to age
    if (
      parsed.lastAttemptTime &&
      now - parsed.lastAttemptTime > ATTEMPT_RESET_DURATION_MS
    ) {
      localStorage.removeItem(STORAGE_KEY);
      return getInitialState();
    }

    return {
      attempts: parsed.attempts ?? 0,
      lockoutEndTime: parsed.lockoutEndTime ?? null,
      lastAttemptTime: parsed.lastAttemptTime ?? null,
    };
  } catch {
    // Corrupted data, start fresh
    localStorage.removeItem(STORAGE_KEY);
    return getInitialState();
  }
}

function saveState(state: RateLimitState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage might be full or disabled, ignore
  }
}

function getInitialState(): RateLimitState {
  return {
    attempts: 0,
    lockoutEndTime: null,
    lastAttemptTime: null,
  };
}
