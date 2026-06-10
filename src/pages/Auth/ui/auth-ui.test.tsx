// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  LoginBrandPanel,
  LoginButton,
  LoginCard,
  LoginCardHeader,
  LoginCardTitle,
  LoginDialog,
  LoginDialogDescription,
  LoginDialogTitle,
  LoginField,
  LoginFieldDescription,
  LoginFieldError,
  LoginFieldLabel,
  LoginForm,
  LoginFormActions,
  LoginInput,
  LoginOtpInput,
  LoginShell,
  LoginStatusMessage,
} from ".";

describe("auth login shadcn primitives", () => {
  it("renders a reusable login shell and card without Catalyst wrappers", () => {
    render(
      <LoginShell>
        <LoginCard aria-labelledby="auth-card-title">
          <LoginCardHeader>
            <LoginCardTitle id="auth-card-title">SecPal</LoginCardTitle>
          </LoginCardHeader>
          <p>Shared login surface</p>
        </LoginCard>
        <LoginBrandPanel aria-label="Brand panel">
          <p>Brand promise</p>
        </LoginBrandPanel>
      </LoginShell>
    );

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "SecPal" })).toHaveTextContent(
      "Shared login surface"
    );
    expect(
      screen.getByRole("complementary", { name: "Brand panel" })
    ).toHaveTextContent("Brand promise");
  });

  it("wires auth form labels, descriptions, and errors explicitly", () => {
    render(
      <LoginForm aria-label="Login form">
        <LoginField>
          <LoginFieldLabel htmlFor="email">Email address</LoginFieldLabel>
          <LoginInput
            id="email"
            type="email"
            aria-describedby="email-help email-error"
            aria-invalid
          />
          <LoginFieldDescription id="email-help">
            Use your work account.
          </LoginFieldDescription>
          <LoginFieldError id="email-error">Email is required.</LoginFieldError>
        </LoginField>
        <LoginFormActions>
          <LoginButton type="submit">Log in</LoginButton>
        </LoginFormActions>
      </LoginForm>
    );

    const email = screen.getByRole("textbox", { name: "Email address" });

    expect(
      screen.getByRole("form", { name: "Login form" })
    ).toBeInTheDocument();
    expect(email).toBeInvalid();
    expect(email).toHaveAccessibleDescription(
      "Use your work account. Email is required."
    );
    expect(screen.getByRole("button", { name: "Log in" })).toHaveAttribute(
      "type",
      "submit"
    );
  });

  it("supports themed status messages for shared login, passkey, and MFA states", () => {
    render(
      <>
        <LoginStatusMessage variant="error" live="assertive" title="Locked">
          <p>Wait before trying again.</p>
        </LoginStatusMessage>
        <LoginStatusMessage variant="warning" title="System not ready">
          <p>Contact your administrator.</p>
        </LoginStatusMessage>
      </>
    );

    const alerts = screen.getAllByRole("alert");

    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toHaveAttribute("aria-live", "assertive");
    expect(alerts[0]).toHaveTextContent("LockedWait before trying again.");
    expect(alerts[1]).toHaveTextContent(
      "System not readyContact your administrator."
    );
  });

  it("renders the MFA dialog with native shadcn-style modal semantics", () => {
    const handleClose = vi.fn();

    render(
      <LoginDialog open onClose={handleClose}>
        <LoginDialogTitle>Second factor required</LoginDialogTitle>
        <LoginDialogDescription>
          Complete MFA to finish signing in.
        </LoginDialogDescription>
        <p>Challenge body</p>
      </LoginDialog>
    );

    const dialog = screen.getByRole("dialog", {
      name: "Second factor required",
    });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(
      "Complete MFA to finish signing in."
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("offers a controlled OTP input with paste support", async () => {
    const handleChange = vi.fn();

    render(
      <LoginOtpInput
        value="12"
        onChange={handleChange}
        aria-label="Authenticator code"
      />
    );

    expect(
      screen.getByRole("group", { name: "Authenticator code" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Authenticator code digit 1")).toHaveValue(
      "1"
    );
    expect(screen.getByLabelText("Authenticator code digit 2")).toHaveValue(
      "2"
    );

    fireEvent.paste(screen.getByLabelText("Authenticator code digit 1"), {
      clipboardData: {
        getData: () => "65 43-21",
      },
    } as unknown as ClipboardEvent);

    fireEvent.change(screen.getByLabelText("Authenticator code digit 3"), {
      target: { value: "x9" },
    });

    expect(handleChange).toHaveBeenNthCalledWith(1, "654321");
    expect(handleChange).toHaveBeenNthCalledWith(2, "129");
  });
});
