// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
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
  LoginEmpty,
  LoginEmptyContent,
  LoginEmptyDescription,
  LoginEmptyHeader,
  LoginEmptyMedia,
  LoginEmptyTitle,
  LoginField,
  LoginFieldDescription,
  LoginFieldError,
  LoginFieldLabel,
  LoginForm,
  LoginFormActions,
  LoginInput,
  LoginOtpInput,
  LoginShell,
  LoginSpinner,
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

    // live="assertive" → role="alert"; default live="polite" → role="status".
    // role and aria-live are always consistent: role="alert" ↔ aria-live="assertive",
    // role="status" ↔ aria-live="polite" (WAI-ARIA 1.2 §6.3/§6.6).
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveTextContent("LockedWait before trying again.");

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent(
      "System not readyContact your administrator."
    );
  });

  it("renders the MFA dialog with shadcn Radix dialog semantics", async () => {
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
    const backgroundButton = screen.getByText("Language");
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    const verifyButton = screen.getByRole("button", { name: "Verify" });

    expect(dialog).toHaveAccessibleDescription(
      "Complete MFA to finish signing in."
    );
    expect(dialog).toHaveAttribute("data-state", "open");
    expect(backgroundButton.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(cancelButton).toHaveFocus();
    // Responsive: the dialog must cap its height to the visible viewport and
    // scroll its body when content overflows (e.g. landscape mobile), so the
    // OTP entry and action buttons remain reachable.
    expect(dialog).toHaveClass(
      "max-h-[calc(100dvh-2rem)]",
      "w-[calc(100%-2rem)]",
      "overflow-x-hidden",
      "overflow-y-auto",
      "overscroll-contain"
    );

    await user.tab();
    expect(verifyButton).toHaveFocus();

    await user.tab();
    expect(cancelButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(verifyButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("keeps focus on the active dialog input when the parent rerenders", () => {
    function DialogRerenderHarness() {
      const [code, setCode] = useState("");

      return (
        <LoginShell>
          <button type="button">Language</button>
          <LoginDialog open onClose={() => undefined}>
            <LoginDialogTitle>Second factor required</LoginDialogTitle>
            <LoginDialogDescription>
              Complete MFA to finish signing in.
            </LoginDialogDescription>
            <div className="mt-6 space-y-3">
              <label className="flex items-center gap-2">
                <input type="radio" name="mfa-method" defaultChecked />
                <span>Authenticator app</span>
              </label>
              <LoginInput
                aria-label="Authenticator code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
          </LoginDialog>
        </LoginShell>
      );
    }

    render(<DialogRerenderHarness />);

    const codeInput = screen.getByRole("textbox", {
      name: "Authenticator code",
    });

    codeInput.focus();
    expect(codeInput).toHaveFocus();

    fireEvent.change(codeInput, { target: { value: "1" } });

    expect(codeInput).toHaveFocus();
    expect(codeInput).toHaveValue("1");
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

  it("supports alphanumeric input with split groups, separator and uppercase normalization (recovery-code shape)", () => {
    const handleChange = vi.fn();

    const { container } = render(
      <LoginOtpInput
        idPrefix="auth-recovery"
        value=""
        onChange={handleChange}
        length={8}
        groups={[4, 4]}
        pattern="^[a-zA-Z0-9]+$"
        inputMode="text"
        textTransform="uppercase"
        aria-label="Recovery code"
      />
    );

    const recoveryInput = screen.getByLabelText("Recovery code");
    expect(recoveryInput).toHaveAttribute("inputmode", "text");
    expect(recoveryInput).toHaveAttribute("maxlength", "8");
    expect(recoveryInput).toHaveAttribute("autocomplete", "off");

    // 8 slots rendered in two groups separated by a single shadcn-style
    // separator (mirrors the shadcn `input-otp` "Pattern" example).
    expect(
      container.querySelectorAll('[data-slot="login-input-otp-slot"]')
    ).toHaveLength(8);
    const separators = container.querySelectorAll(
      '[data-slot="login-input-otp-separator"]'
    );
    expect(separators).toHaveLength(1);
    expect(separators[0]).toHaveAttribute("role", "separator");
    expect(separators[0]).toHaveAttribute("aria-hidden", "true");

    // Slot indices stay monotonic across the separator (0..3 in group 1,
    // 4..7 in group 2) so input-otp wires keystrokes to the right cell.
    const slots = container.querySelectorAll(
      '[data-slot="login-input-otp-slot"]'
    );
    slots.forEach((slot) => {
      expect(slot).toHaveClass("uppercase");
    });

    // Lowercase input gets normalized to uppercase before reaching the
    // consumer (so backends never see mixed-case recovery codes).
    fireEvent.change(recoveryInput, { target: { value: "b6f42q8p" } });
    expect(handleChange).toHaveBeenCalledWith("B6F42Q8P");

    // Characters outside the alphanumeric pattern are rejected by input-otp's
    // built-in regex validation.
    handleChange.mockClear();
    fireEvent.change(recoveryInput, { target: { value: "b6f4-2q8" } });
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("strips whitespace/hyphen/underscore from pasted codes before validation", () => {
    // Without a pasteTransformer, input-otp would validate the entire pasted
    // string against `pattern` — a digits-only TOTP would reject "123 456"
    // (typical SMS or password-manager copy) wholesale and leave the field
    // empty. The transformer strips inert formatting so the meaningful
    // characters reach the field.
    const handleChange = vi.fn();

    render(
      <LoginOtpInput
        idPrefix="paste-otp"
        value=""
        onChange={handleChange}
        aria-label="Authenticator code"
      />
    );

    const input = screen.getByLabelText("Authenticator code");

    // input-otp dispatches via `onPaste`; simulate the user pasting a
    // formatted code and check the transformed value reaches `onChange`.
    fireEvent.paste(input, {
      clipboardData: {
        getData: () => "123 456",
      },
    });

    // input-otp routes the paste through our `pasteTransformer`, strips the
    // space, then validates "123456" against REGEXP_ONLY_DIGITS, and emits.
    expect(handleChange).toHaveBeenCalledWith("123456");
  });

  it("uppercases pasted recovery codes and strips formatting", () => {
    const handleChange = vi.fn();

    render(
      <LoginOtpInput
        idPrefix="paste-recovery"
        value=""
        onChange={handleChange}
        length={8}
        groups={[4, 4]}
        pattern="^[a-zA-Z0-9]+$"
        inputMode="text"
        textTransform="uppercase"
        aria-label="Recovery code"
      />
    );

    const input = screen.getByLabelText("Recovery code");

    fireEvent.paste(input, {
      clipboardData: {
        getData: () => "b6f4-2q8p",
      },
    });

    expect(handleChange).toHaveBeenCalledWith("B6F42Q8P");
  });

  it("scrolls the OTP cluster into view on focus so mobile soft keyboards do not occlude the cells", () => {
    // On landscape mobile the soft keyboard covers the bottom half of
    // the viewport. The MFA dialog is `position: fixed; top: 50%` so
    // the browser's native auto-scroll-on-focus cannot help; the OTP
    // wrapper instead scrolls the visible slot cluster
    // (`[data-input-otp-container]`) into the center of its scroll
    // container after the keyboard finishes opening (200ms timer).
    vi.useFakeTimers();
    const scrollSpy = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const handleChange = vi.fn();

    const { container } = render(
      <LoginOtpInput
        idPrefix="kb-otp"
        value=""
        onChange={handleChange}
        aria-label="Authenticator code"
      />
    );

    const input = screen.getByLabelText("Authenticator code");
    const wrapper = container.querySelector("[data-input-otp-container]");
    expect(wrapper).not.toBeNull();

    fireEvent.focus(input);
    expect(scrollSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);

    expect(scrollSpy).toHaveBeenCalledWith({
      block: "center",
      behavior: "smooth",
    });
    expect(scrollSpy.mock.contexts[0]).toBe(wrapper);

    scrollSpy.mockRestore();
    vi.useRealTimers();
  });

  it("clips horizontal overflow at the LoginShell and wraps long words in text-heavy primitives", () => {
    // Defense in depth against horizontal scrollbars on the login surface:
    //   1. `LoginShell` clips horizontal overflow at the page level so a
    //      misbehaving child (long German compound word, browser-extension
    //      overlay, sub-pixel-rounded transform) can never offer a
    //      horizontal page scrollbar.
    //   2. Text-heavy primitives that render localized backend strings or
    //      long German compound words (`Wiederherstellungscode`,
    //      `Authentifizierungscode`, `MFA-Verifizierung`) declare
    //      `break-words` so they wrap mid-word inside their container
    //      instead of forcing the container wider.
    render(
      <LoginShell data-testid="shell">
        <LoginField>
          <LoginFieldDescription data-testid="desc">
            Geben Sie einen Wiederherstellungscode ein.
          </LoginFieldDescription>
          <LoginFieldError data-testid="error">
            MFA-Verifizierung fehlgeschlagen.
          </LoginFieldError>
        </LoginField>
        <LoginStatusMessage data-testid="status">
          Anmeldung läuft …
        </LoginStatusMessage>
      </LoginShell>
    );

    expect(screen.getByTestId("shell")).toHaveClass(
      "overflow-x-clip",
      "pt-[calc(1.5rem+var(--app-safe-area-inset-top))]"
    );
    expect(screen.getByTestId("desc")).toHaveClass("break-words");
    expect(screen.getByTestId("error")).toHaveClass("break-words");
    expect(screen.getByTestId("status")).toHaveClass("break-words");
  });

  it("renders the shadcn Spinner with accessible status semantics", () => {
    render(<LoginSpinner aria-label="Loading" />);

    const spinner = screen.getByRole("status", { name: "Loading" });
    expect(spinner).toHaveAttribute("data-slot", "login-spinner");
    expect(spinner).toHaveClass("animate-spin");
  });

  it("composes the shadcn Empty state with header, media (icon), title, description and content", () => {
    const { container } = render(
      <LoginEmpty data-testid="empty">
        <LoginEmptyHeader>
          <LoginEmptyMedia variant="icon">
            <LoginSpinner aria-label="Loading" />
          </LoginEmptyMedia>
          <LoginEmptyTitle>Working on it</LoginEmptyTitle>
          <LoginEmptyDescription>
            Hang tight while we finish up.
          </LoginEmptyDescription>
        </LoginEmptyHeader>
        <LoginEmptyContent>
          <button type="button">Cancel</button>
        </LoginEmptyContent>
      </LoginEmpty>
    );

    const empty = screen.getByTestId("empty");
    expect(empty).toHaveAttribute("data-slot", "login-empty");
    // The shadcn Empty container ships a dashed border. `border-dashed`
    // alone is a no-op without an explicit border-width — pin both classes
    // and the light/dark border colors so the dashed chrome actually paints.
    expect(empty).toHaveClass(
      "border",
      "border-dashed",
      "border-zinc-200",
      "dark:border-zinc-800"
    );

    expect(
      container.querySelector('[data-slot="login-empty-header"]')
    ).not.toBeNull();

    const media = container.querySelector('[data-slot="login-empty-media"]');
    expect(media).not.toBeNull();
    expect(media).toHaveAttribute("data-variant", "icon");

    expect(screen.getByText("Working on it")).toHaveAttribute(
      "data-slot",
      "login-empty-title"
    );
    expect(screen.getByText("Hang tight while we finish up.")).toHaveAttribute(
      "data-slot",
      "login-empty-description"
    );
    expect(
      container.querySelector('[data-slot="login-empty-content"]')
    ).not.toBeNull();

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});
