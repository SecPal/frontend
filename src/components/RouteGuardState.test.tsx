// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { AuthApiError } from "../services/authApi";
import { RouteEmailVerificationState } from "./RouteGuardState";
import * as authApi from "../services/authApi";

vi.mock("../services/authApi", async () => {
  const actual = await vi.importActual("../services/authApi");

  return {
    ...actual,
    sendVerificationNotification: vi.fn(),
  };
});

function renderEmailVerificationState() {
  const onRetry = vi.fn();
  const onSignInAgain = vi.fn();

  render(
    <I18nProvider i18n={i18n}>
      <RouteEmailVerificationState
        email="user@secpal.dev"
        onRetry={onRetry}
        onSignInAgain={onSignInAgain}
      />
    </I18nProvider>
  );

  return { onRetry, onSignInAgain };
}

describe("RouteEmailVerificationState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders the verification guidance and account email", () => {
    renderEmailVerificationState();

    expect(
      screen.getByRole("heading", { name: /verify your email address/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/user@secpal\.dev/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send verification email again/i })
    ).toBeInTheDocument();
  });

  it("requests another verification email and shows the API success message", async () => {
    vi.mocked(authApi.sendVerificationNotification).mockResolvedValueOnce({
      message: "Verification link sent successfully.",
    });

    renderEmailVerificationState();

    fireEvent.click(
      screen.getByRole("button", { name: /send verification email again/i })
    );

    expect(
      screen.getByRole("button", { name: /sending verification email/i })
    ).toBeDisabled();

    await waitFor(() => {
      expect(authApi.sendVerificationNotification).toHaveBeenCalledTimes(1);
    });

    expect(
      await screen.findByText(/verification link sent successfully\./i)
    ).toBeInTheDocument();
  });

  it("shows AuthApiError messages when resending fails", async () => {
    vi.mocked(authApi.sendVerificationNotification).mockRejectedValueOnce(
      new AuthApiError("Too many requests.")
    );

    renderEmailVerificationState();

    fireEvent.click(
      screen.getByRole("button", { name: /send verification email again/i })
    );

    expect(await screen.findByText(/too many requests\./i)).toBeInTheDocument();
  });

  it("shows a fallback error message when resend fails with an unknown error", async () => {
    vi.mocked(authApi.sendVerificationNotification).mockRejectedValueOnce(
      "unexpected"
    );

    renderEmailVerificationState();

    fireEvent.click(
      screen.getByRole("button", { name: /send verification email again/i })
    );

    expect(
      await screen.findByText(
        /we could not send a new verification email\. please try again\./i
      )
    ).toBeInTheDocument();
  });

  it("triggers retry and sign-in-again actions", () => {
    const { onRetry, onSignInAgain } = renderEmailVerificationState();

    fireEvent.click(
      screen.getByRole("button", { name: /i have verified my email/i })
    );
    fireEvent.click(screen.getByRole("button", { name: /go to login/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onSignInAgain).toHaveBeenCalledTimes(1);
  });
});
