// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { Link } from "./components/link";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { LanguageSwitcher } from "./components/LanguageSwitcher";

function Home() {
  return (
    <div className="p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">SecPal</h1>
        <LanguageSwitcher />
      </div>
      <p className="text-lg mb-6">
        <Trans>SecPal - a guard's best friend</Trans>
      </p>
      <nav className="space-x-4">
        <Link href="/about" className="text-blue-600 hover:underline">
          <Trans>About</Trans>
        </Link>
      </nav>
    </div>
  );
}

function About() {
  return (
    <div className="p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          <Trans>About SecPal</Trans>
        </h1>
        <LanguageSwitcher />
      </div>
      <p className="text-lg mb-6">
        <Trans>
          SecPal - a guard's best friend. An offline-first progressive web app
          for security personnel, combining digital guard books with modern
          service management.
        </Trans>
      </p>
      <nav>
        <Link href="/" className="text-blue-600 hover:underline">
          <Trans>Back to Home</Trans>
        </Link>
      </nav>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </div>
      <OfflineIndicator />
    </BrowserRouter>
  );
}

export default App;
