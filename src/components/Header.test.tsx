// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { BrowserRouter } from "react-router-dom";
import { Header } from "./Header";
import { AuthProvider } from "../contexts/AuthContext";
import * as authApi from "../services/authApi";

vi.mock("../services/authApi");

const renderHeader = () => {
  return render(
    <BrowserRouter>
      <I18nProvider i18n={i18n}>
        <AuthProvider>
          <Header />
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  );
};

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders header even when user is not authenticated", () => {
    // Note: Header now always renders, null check was removed as redundant
    // since Header is only used in ProtectedRoute which ensures authentication
    const { container } = renderHeader();
    // Header renders but user name might not be present
    expect(container.querySelector("header")).toBeInTheDocument();
  });

  it("displays user name when authenticated", () => {
    localStorage.setItem(
      "auth_user",
      JSON.stringify({ id: 1, name: "John Doe", email: "john@example.com" })
    );

    renderHeader();

    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("displays SecPal logo", () => {
    localStorage.setItem(
      "auth_user",
      JSON.stringify({ id: 1, name: "Test", email: "test@example.com" })
    );

    renderHeader();

    expect(screen.getByText("SecPal")).toBeInTheDocument();
  });

  it("displays logout button", () => {
    localStorage.setItem(
      "auth_user",
      JSON.stringify({ id: 1, name: "Test", email: "test@example.com" })
    );

    renderHeader();

    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
  });

  it("calls logout API and clears auth on logout click", async () => {
    const mockLogout = vi.mocked(authApi.logout);
    mockLogout.mockResolvedValueOnce(undefined);

    localStorage.setItem(
      "auth_user",
      JSON.stringify({ id: 1, name: "Test", email: "test@example.com" })
    );

    renderHeader();

    const logoutButton = screen.getByRole("button", { name: /logout/i });
    fireEvent.click(logoutButton);

    // Local storage should be cleared BEFORE API call
    await waitFor(() => {
      expect(localStorage.getItem("auth_user")).toBeNull();
    });

    // API call should still happen
    expect(mockLogout).toHaveBeenCalled();
  });

  it("clears auth even if logout API fails", async () => {
    const mockLogout = vi.mocked(authApi.logout);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockLogout.mockRejectedValueOnce(new Error("API Error"));

    localStorage.setItem(
      "auth_user",
      JSON.stringify({ id: 1, name: "Test", email: "test@example.com" })
    );

    renderHeader();

    const logoutButton = screen.getByRole("button", { name: /logout/i });
    fireEvent.click(logoutButton);

    // Local storage cleared immediately (before API call)
    await waitFor(() => {
      expect(localStorage.getItem("auth_user")).toBeNull();
    });

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Logout API call failed:",
        expect.any(Error)
      );
    });

    expect(localStorage.getItem("auth_user")).toBeNull();

    consoleErrorSpy.mockRestore();
  });

  it("renders language switcher", () => {
    localStorage.setItem(
      "auth_user",
      JSON.stringify({ id: 1, name: "Test", email: "test@example.com" })
    );

    renderHeader();

    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
