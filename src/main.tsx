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

function AppWithI18n() {
  const [localeLoaded, setLocaleLoaded] = useState(false);

  useEffect(() => {
    const initLocale = async () => {
      const locale = detectLocale();
      await activateLocale(locale);
      setLocaleLoaded(true);
    };
    initLocale();
  }, []);

  if (!localeLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <I18nProvider i18n={i18n}>
      <App />
    </I18nProvider>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppWithI18n />
  </StrictMode>
);
