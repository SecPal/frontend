// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@testing-library/jest-dom";
import { i18n } from "@lingui/core";
import { messages as enMessages } from "../src/locales/en/messages";
import "fake-indexeddb/auto";

// Initialize i18n for tests
i18n.load("en", enMessages);
i18n.activate("en");

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
