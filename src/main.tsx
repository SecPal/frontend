// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import App from "./App";
import { activateLocale, detectLocale } from "./i18n";
import "@fontsource/inter";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
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
        aria-label="Loading translations"
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
// @ts-expect-error - VITEST is injected by vitest at runtime
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
}
