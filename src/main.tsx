// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import App from "./App";
import { initializeLocale } from "./i18n";
import { RuntimeStyleCspSupport } from "./lib/RuntimeStyleCspSupport";
import {
  installSystemColorSchemeSync,
  syncSystemColorScheme,
} from "./lib/systemColorScheme";
import { initWebVitals } from "./lib/webVitals";
import "./index.css";

export function AppWithI18n() {
  useEffect(() => installSystemColorSchemeSync(), []);

  useEffect(() => {
    window.dispatchEvent(new Event("app-bootstrap-ready"));
  }, []);

  return (
    <I18nProvider i18n={i18n}>
      <RuntimeStyleCspSupport />
      <App />
    </I18nProvider>
  );
}

// Only run if not in test environment
const isTest = typeof import.meta.env !== "undefined" && import.meta.env.VITEST;
if (typeof window !== "undefined" && !isTest) {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }

  initializeLocale();
  syncSystemColorScheme();

  // Cache root instance to avoid HMR warning
  type WindowWithRoot = Window & { __app_root?: ReturnType<typeof createRoot> };
  let root = (window as WindowWithRoot).__app_root;
  if (!root) {
    root = createRoot(rootElement);
    (window as WindowWithRoot).__app_root = root;
  }

  root.render(
    <StrictMode>
      <AppWithI18n />
    </StrictMode>
  );

  // Initialize Web Vitals tracking
  initWebVitals();
}
