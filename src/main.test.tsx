// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { screen, waitFor } from "@testing-library/dom";
import { StrictMode } from "react";
import { AppWithI18n } from "./main";
import { authStorage } from "./services/storage";

describe("AppWithI18n Integration", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    authStorage.beginSensitiveLogoutBarrierCleanup();
    window.history.replaceState({}, "", "/login");
  });

  it("renders the app after loading locale", async () => {
    render(
      <StrictMode>
        <AppWithI18n />
      </StrictMode>
    );

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("loads English locale by default", async () => {
    render(
      <StrictMode>
        <AppWithI18n />
      </StrictMode>
    );

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    // Check for English text on Login page
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
  });

  it("does not render blank/black screen on locale load failure", async () => {
    render(
      <StrictMode>
        <AppWithI18n />
      </StrictMode>
    );

    // Wait for loading to finish
    await waitFor(
      () => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Ensure SOMETHING is rendered (not blank)
    const body = document.body;
    expect(body.textContent).not.toBe("");
    expect(body.textContent).not.toBe("Loading...");
  });
});
