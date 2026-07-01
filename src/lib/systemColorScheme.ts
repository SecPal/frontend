// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

const DARK_MODE_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function applySystemColorSchemeClass(
  rootElement: HTMLElement,
  isDarkMode: boolean
): void {
  rootElement.classList.toggle("dark", isDarkMode);
  rootElement.style.colorScheme = isDarkMode ? "dark" : "light";
}

export function installSystemColorSchemeSync(
  win: Pick<Window, "document" | "matchMedia"> = window
): () => void {
  const rootElement = win.document.documentElement;
  const mediaQuery = win.matchMedia(DARK_MODE_MEDIA_QUERY);

  const syncColorScheme = (matches: boolean) => {
    applySystemColorSchemeClass(rootElement, matches);
  };

  syncColorScheme(mediaQuery.matches);

  const handleChange = (event: MediaQueryListEvent) => {
    syncColorScheme(event.matches);
  };

  mediaQuery.addEventListener("change", handleChange);

  return () => {
    mediaQuery.removeEventListener("change", handleChange);
  };
}
