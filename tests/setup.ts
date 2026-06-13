// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@testing-library/jest-dom";
import { i18n } from "@lingui/core";
import { messages as enMessages } from "../src/locales/en/messages";
import "fake-indexeddb/auto";
import { mockAnimationsApi } from "jsdom-testing-mocks";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// React Testing Library's `findBy*` and `waitFor` helpers default to a 1s
// async timeout. That is generous in isolation but routinely too tight in CI
// when the suite runs with v8 coverage instrumentation: env setup alone can
// burn ~100s, and a single async state transition (e.g. the passkey-error
// rejection path in `Login.test.tsx > shows native passkey AuthApiError
// messages inline`) sometimes does not surface inside the 1s budget. Bumping
// the global async-util timeout to 5s keeps real failures fast (still well
// under the 20s per-test `testTimeout` from `vite.config.ts`) and removes a
// known source of CI-only flakiness without needing per-call timeouts.
configure({ asyncUtilTimeout: 5000 });

// Mock the Web Animations API for HeadlessUI components
// This prevents "Element.prototype.getAnimations" polyfill warnings
mockAnimationsApi();

// Initialize i18n for tests
i18n.load("en", enMessages);
i18n.activate("en");

const originalConfirm = globalThis.confirm;
const originalAlert = globalThis.alert;
const originalPrompt = globalThis.prompt;
const originalLocationHref = window.location.href;

function clearXsrfCookie(): void {
  document.cookie = `XSRF-TOKEN=;expires=${new Date(0).toUTCString()};path=/`;
}

// `input-otp` schedules internal `setTimeout(..., 0|10|50)` callbacks on every
// value/focus change that dispatch React `setState`; if they fire after vitest
// tears down the JSDOM environment, `resolveUpdatePriority` reads a now-
// undefined `window` and surfaces as a fatal "Uncaught Exception" in CI.
//
// Waiting 60ms unconditionally in `afterEach` flushes those timers but pays
// ~60ms × 2000+ tests ≈ 2 minutes of pure wall time across the suite even
// when no OTP input was rendered. Instead, observe the DOM and flip a flag
// the first time `input-otp` mounts; only that subset of tests pays the
// flush cost.
let inputOtpWasMounted = false;

if (typeof document !== "undefined" && typeof MutationObserver === "function") {
  const matchesInputOtp = (node: Node): boolean =>
    node instanceof Element &&
    (node.hasAttribute("data-input-otp") ||
      node.querySelector?.("[data-input-otp]") !== null);

  const observer = new MutationObserver((mutations) => {
    if (inputOtpWasMounted) {
      return;
    }
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (matchesInputOtp(node)) {
          inputOtpWasMounted = true;
          return;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

beforeEach(() => {
  clearXsrfCookie();
  document.cookie = `XSRF-TOKEN=${encodeURIComponent("test-csrf-token")};path=/`;
  inputOtpWasMounted = false;
});

// React 19 act() warning fix: Cleanup after each test to prevent
// warnings about state updates happening after test completion.
// This ensures all pending React updates are flushed before test ends.
afterEach(async () => {
  cleanup();

  // Reset common sources of cross-test leakage.
  localStorage.clear();
  sessionStorage.clear();
  vi.useRealTimers();
  i18n.load("en", enMessages);
  i18n.activate("en");
  globalThis.confirm = originalConfirm;
  globalThis.alert = originalAlert;
  globalThis.prompt = originalPrompt;
  window.history.replaceState({}, "", originalLocationHref);
  clearXsrfCookie();

  // Only pay the input-otp flush cost when the test actually mounted one.
  if (inputOtpWasMounted) {
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
});

// Polyfill for Blob.arrayBuffer() in test environment (JSDOM doesn't have it)
if (typeof Blob.prototype.arrayBuffer === "undefined") {
  Blob.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to read Blob as ArrayBuffer"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

// Mock ResizeObserver for HeadlessUI components (used by Listbox)
class MockResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver;

// Stubs for Radix UI primitives (Select, etc.) in JSDOM. Radix relies on
// pointer-capture and scrollIntoView APIs that JSDOM does not implement; without
// these stubs, opening a Radix Select trigger in tests throws.
if (typeof Element !== "undefined") {
  if (!("hasPointerCapture" in Element.prototype)) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!("setPointerCapture" in Element.prototype)) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!("releasePointerCapture" in Element.prototype)) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!("scrollIntoView" in Element.prototype)) {
    Element.prototype.scrollIntoView = () => {};
  }
}

// Stubs for input-otp in JSDOM. The library schedules timer-driven pointer-
// reset callbacks that call `document.elementFromPoint(x, y)` (for password-
// manager-overlay detection) and `window.scrollTo(...)` (when the input
// nudges itself into view); JSDOM implements neither. Without the stubs
// `elementFromPoint` surfaces as an "Uncaught TypeError" several seconds
// after the test that mounted the OTP input, and `scrollTo` floods the
// console with "Not implemented" warnings.
if (
  typeof document !== "undefined" &&
  typeof document.elementFromPoint !== "function"
) {
  (
    document as Document & { elementFromPoint: () => Element | null }
  ).elementFromPoint = () => null;
}
if (typeof window !== "undefined") {
  // JSDOM's `scrollTo` throws a "Not implemented" diagnostic instead of
  // being a real function; replace it with a no-op so the warning does not
  // pollute the test output.
  window.scrollTo = () => {};
}
