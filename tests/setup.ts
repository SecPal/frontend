// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@testing-library/jest-dom";
import { i18n } from "@lingui/core";
import { messages as enMessages } from "../src/locales/en/messages";
import "fake-indexeddb/auto";
import { mockAnimationsApi } from "jsdom-testing-mocks";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Mock the Web Animations API for HeadlessUI components
// This prevents "Element.prototype.getAnimations" polyfill warnings
mockAnimationsApi();

// Initialize i18n for tests
i18n.load("en", enMessages);
i18n.activate("en");

// React 19 act() warning fix: Cleanup after each test to prevent
// warnings about state updates happening after test completion.
// This ensures all pending React updates are flushed before test ends.
afterEach(async () => {
  cleanup();
  // Give React a chance to flush any pending updates
  await new Promise((resolve) => setTimeout(resolve, 0));
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
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
