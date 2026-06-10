// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("renders the MFA dialog with native shadcn-style modal semantics", async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <LoginShell>
        <button type="button">Language</button>
        <LoginDialog open onClose={handleClose}>
          <LoginDialogTitle>Second factor required</LoginDialogTitle>
          <LoginDialogDescription>
            Complete MFA to finish signing in.
          </LoginDialogDescription>
          <div className="mt-6 flex gap-2">
            <LoginButton type="button">Cancel</LoginButton>
            <LoginButton type="submit">Verify</LoginButton>
          </div>
        </LoginDialog>
      </LoginShell>
    );

    const dialog = screen.getByRole("dialog", {
      name: "Second factor required",
    });
    const backgroundButton = screen.getByRole("button", { name: "Language" });
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    const verifyButton = screen.getByRole("button", { name: "Verify" });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription(
      "Complete MFA to finish signing in."
    );
    expect(backgroundButton).toHaveAttribute("inert");
    expect(cancelButton).toHaveFocus();

    await user.tab();
    expect(verifyButton).toHaveFocus();

    await user.tab();
    expect(cancelButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(verifyButton).toHaveFocus();

    fireEvent.click(dialog);
    expect(handleClose).not.toHaveBeenCalled();

    fireEvent.click(dialog.parentElement!);
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it("offers a controlled digits-only OTP input rendered as shadcn slots", async () => {
    const handleChange = vi.fn();

    const { container } = render(
      <LoginOtpInput
        idPrefix="auth-otp"
        value="12"
        onChange={handleChange}
        aria-label="Authenticator code"
      />
    );

    const otpInput = screen.getByLabelText("Authenticator code");
    expect(otpInput).toHaveAttribute("id", "auth-otp");
    expect(otpInput).toHaveAttribute("inputmode", "numeric");
    expect(otpInput).toHaveAttribute("autocomplete", "one-time-code");
    expect(otpInput).toHaveValue("12");

    const slots = container.querySelectorAll(
      '[data-slot="login-input-otp-slot"]'
    );
    expect(slots).toHaveLength(6);
    expect(slots[0]).toHaveTextContent("1");
    expect(slots[1]).toHaveTextContent("2");

    fireEvent.change(otpInput, { target: { value: "654321" } });
    expect(handleChange).toHaveBeenCalledWith("654321");

    handleChange.mockClear();
    fireEvent.change(otpInput, { target: { value: "12a 34-56" } });
    expect(handleChange).not.toHaveBeenCalled();
  });
});
