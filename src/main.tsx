// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import App from "./App";
import { activateLocale, detectLocale } from "./i18n";
import { initWebVitals } from "./lib/webVitals";
import "./index.css";

export function AppWithI18n() {
  const [localeLoaded, setLocaleLoaded] = useState(false);

  useEffect(() => {
    const initLocale = async () => {
      try {
        const locale = detectLocale();
        await activateLocale(locale);
      } catch (err) {
        console.error("Failed to initialize i18n locale:", err);
      } finally {
        setLocaleLoaded(true);
      }
    };
    initLocale();
  }, []);

  if (!localeLoaded) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{ padding: "2rem", textAlign: "center" }}
      >
        Loading...
      </div>
    );
  }

  return (
    <I18nProvider i18n={i18n}>
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

  createRoot(rootElement).render(
    <StrictMode>
      <AppWithI18n />
    </StrictMode>
  );

  // Initialize Web Vitals tracking
  initWebVitals();
}
