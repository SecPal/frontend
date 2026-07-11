// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

(function () {
  var locale = "en";

  try {
    var storedLocale = window.localStorage.getItem("secpal-locale");
    if (storedLocale === "de" || storedLocale === "en") {
      locale = storedLocale;
    } else if (navigator.language.split("-")[0] === "de") {
      locale = "de";
    }
  } catch {
    if (navigator.language.split("-")[0] === "de") {
      locale = "de";
    }
  }

  document.documentElement.lang = locale;
})();
