// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

(function () {
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');

  if (!themeColorMeta) {
    return;
  }

  const updateThemeColor = function (isDark) {
    themeColorMeta.setAttribute("content", isDark ? "#18181b" : "#ffffff");
  };

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = function (event) {
    updateThemeColor(event.matches);
  };

  updateThemeColor(mediaQuery.matches);

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleChange);
    return;
  }

  if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(handleChange);
  }
})();
