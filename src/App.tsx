// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { OfflineIndicator } from "./components/OfflineIndicator";

function Home() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">SecPal</h1>
      <p className="text-lg mb-6">
        Your Security Pal - the security guard's best friend
      </p>
      <nav className="space-x-4">
        <Link to="/about" className="text-blue-600 hover:underline">
          About
        </Link>
      </nav>
    </div>
  );
}

function About() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">About SecPal</h1>
      <p className="text-lg mb-6">
        SecPal - Your Security Pal. An offline-first progressive web app for
        security personnel, combining digital guard books with modern service
        management.
      </p>
      <nav>
        <Link to="/" className="text-blue-600 hover:underline">
          Back to Home
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
