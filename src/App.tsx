// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { Link } from "./components/link";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { SyncStatusIndicator } from "./components/SyncStatusIndicator";
import { ShareTarget } from "./pages/ShareTarget";
import { SecretList } from "./pages/Secrets/SecretList";
import { SecretDetail } from "./pages/Secrets/SecretDetail";
import { SecretCreate } from "./pages/Secrets/SecretCreate";
import { SecretEdit } from "./pages/Secrets/SecretEdit";
import { getApiBaseUrl } from "./config";

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
        <Link href="/secrets" className="text-blue-600 hover:underline">
          <Trans>Secrets</Trans>
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
          <Route path="/share" element={<ShareTarget />} />
          <Route path="/secrets" element={<SecretList />} />
          <Route path="/secrets/new" element={<SecretCreate />} />
          <Route path="/secrets/:id" element={<SecretDetail />} />
          <Route path="/secrets/:id/edit" element={<SecretEdit />} />
        </Routes>
      </div>
      <OfflineIndicator />
      <SyncStatusIndicator apiBaseUrl={getApiBaseUrl()} />
    </BrowserRouter>
  );
}

export default App;
