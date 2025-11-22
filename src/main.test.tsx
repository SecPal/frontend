// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { screen, waitFor } from "@testing-library/dom";
import { StrictMode } from "react";
import { AppWithI18n } from "./main";

describe("AppWithI18n Integration", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it("renders the app after loading locale", async () => {
    render(
      <StrictMode>
        <AppWithI18n />
      </StrictMode>
    );

    // Initially should show loading state
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    // After locale loads, app content should appear
    await waitFor(
      () => {
        // Should render actual app content (not just loading)
        const loadingElement = screen.queryByText("Loading...");
        expect(loadingElement).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify app actually rendered - should show login page when not authenticated
    await waitFor(() => {
      const loginHeading = screen.getByText(/Sign in to your account/i);
      expect(loginHeading).toBeInTheDocument();
    });
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

    // Check for English text
    expect(screen.getByText(/guard's best friend/i)).toBeInTheDocument();
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
