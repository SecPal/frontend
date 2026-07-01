// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as deMessages } from "../../../../src/locales/de/messages.mjs";
import { messages as enMessages } from "../../../../src/locales/en/messages.mjs";
import { OnboardingComplete } from "../../../../src/pages/Onboarding/OnboardingComplete";
import * as onboardingApi from "../../../../src/services/onboardingApi";
import { formatLocalYmd } from "../../../../src/utils/localDate";
import { AuthProvider } from "../../../../src/contexts/AuthContext";

// Mock the API
vi.mock("../../../../src/services/onboardingApi");

// Mock AuthContext
const mockLogin = vi.fn();
vi.mock("../../../../src/hooks/useAuth", () => ({
  useAuth: () => ({
    login: mockLogin,
    logout: vi.fn(),
    user: null,
    isAuthenticated: false,
    isLoading: false,
    hasRole: vi.fn(),
    hasPermission: vi.fn(),
    hasOrganizationalAccess: vi.fn(),
  }),
}));

// Wrapper to provide all required contexts
function renderWithProviders(ui: React.ReactElement, route?: string) {
  const initialEntries = route ? [route] : ["/onboarding/complete"];
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </I18nProvider>
  );
}

// Helper to wait for token validation to complete
async function waitForFormReady() {
  await waitFor(() => {
    expect(screen.getByLabelText(/first name|vorname/i)).toBeInTheDocument();
  });
}

function expectOnboardingAuthFrame() {
  const shell = document.querySelector('[data-slot="onboarding-auth-shell"]');
  const card = document.querySelector('[data-slot="onboarding-auth-card"]');
  const header = document.querySelector('[data-slot="onboarding-auth-header"]');

  expect(shell).toBeInTheDocument();
  expect(shell).toHaveClass("bg-background", "text-foreground");
  expect(card).toBeInTheDocument();
  expect(card).toHaveClass("border-border", "bg-card", "text-card-foreground");
  expect(header).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "SecPal" })).toBeInTheDocument();
  expect(
    screen.getByRole("combobox", { name: /select language|sprache auswählen/i })
  ).toBeInTheDocument();
}

function fillValidFormAndSubmit({
  firstName = "John",
  lastName = "Doe",
  dateOfBirth = "1990-01-01",
  password = "SecurePass123!",
  confirmPassword = password,
}: {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  password?: string;
  confirmPassword?: string;
} = {}) {
  const firstNameInput = screen.getByLabelText(/first name|vorname/i);
  const lastNameInput = screen.getByLabelText(/last name|nachname/i);
  const dateOfBirthInput = screen.getByLabelText(/date of birth|geburtsdatum/i);
  const passwordInput = screen.getByLabelText(/^password$|^passwort$/i);
  const confirmPasswordInput = document.querySelector(
    'input[name="password_confirmation"]'
  ) as HTMLInputElement | null;
  if (!confirmPasswordInput) {
    throw new Error("password_confirmation input not found");
  }
  const submitButton = screen.getByRole("button", {
    name: /complete account setup|vollständige kontoeinrichtung/i,
  });

  fireEvent.change(firstNameInput, { target: { value: firstName } });
  fireEvent.change(lastNameInput, { target: { value: lastName } });
  fireEvent.change(dateOfBirthInput, { target: { value: dateOfBirth } });
  fireEvent.change(passwordInput, { target: { value: password } });
  fireEvent.change(confirmPasswordInput, {
    target: { value: confirmPassword },
  });
  fireEvent.click(submitButton);
}

describe("OnboardingComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", enMessages);
    i18n.load("de", deMessages);
    i18n.activate("en");

    // Mock validateOnboardingToken. The endpoint deliberately returns a minimal
    // payload only (no first_name, last_name, or email) so that a stolen magic
    // link cannot be used to harvest profile data.
    vi.mocked(onboardingApi.validateOnboardingToken).mockResolvedValue({
      data: {
        valid: true,
      },
    });
  });

  it("renders form with all required fields", async () => {
    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    // Wait for token validation to complete
    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    });

    expectOnboardingAuthFrame();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
    expect(document.querySelector('input[name="password"]')).toBeTruthy();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/profile photo/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /complete account setup/i })
    ).toBeInTheDocument();
  });

  it("renders the password aria label in German", async () => {
    i18n.activate("de");

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

    expect(document.querySelector('input[name="password"]')).toHaveAttribute(
      "aria-label",
      "Passwort"
    );
  });

  it("does not prefill identity fields from token validation", async () => {
    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

    expect(screen.getByLabelText(/first name/i)).toHaveValue("");
    expect(screen.getByLabelText(/last name/i)).toHaveValue("");
    expect(screen.getByLabelText(/date of birth/i)).toHaveValue("");
    expect(screen.queryByText(/original:/i)).not.toBeInTheDocument();
  });

  it("does not show any client-side name-similarity hints (server is source of truth)", async () => {
    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

    // Typing a totally different name must NOT reveal anything about the stored
    // record: the validate-token endpoint no longer leaks the original name, so
    // the page cannot (and must not) compute similarity in the browser.
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Smith" },
    });

    expect(screen.queryByText(/too significant/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hr will be notified/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/name change detected/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /complete account setup/i })
    ).toBeEnabled();
  });

  it("renders the generic identity-verification error from the backend (no field oracle)", async () => {
    // Backend signals an identity mismatch with a 422 that contains ONLY a
    // `message` and no `errors` payload. The frontend must surface that message
    // as-is and must NOT highlight any specific field, otherwise an attacker
    // could probe DOB/name one at a time.
    //
    // We intentionally use a message string that differs from the frontend's own
    // fallback (which also mentions "could not verify your identity") so that the
    // assertion below proves the BACKEND-supplied text was rendered verbatim.
    // If the frontend fell back to its own hardcoded message instead, the unique
    // sentinel phrase "ref: ident-7" would be absent and the test would fail.
    const backendMessage =
      "We could not verify your identity with the details provided. For security reasons this onboarding link has been deactivated. Please contact HR for a new invitation. [ref: ident-7]";

    const mockError = {
      response: {
        status: 422,
        data: {
          message: backendMessage,
        },
      },
    };

    vi.mocked(onboardingApi.completeOnboarding).mockRejectedValue(mockError);

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

    fillValidFormAndSubmit({
      firstName: "John",
      lastName: "Doe",
      dateOfBirth: "1991-04-15", // wrong DOB
    });

    await waitFor(() => {
      // The sentinel phrase proves the backend-supplied string reached the DOM,
      // not the frontend's own fallback message.
      expect(screen.getByText(/ref: ident-7/i)).toBeInTheDocument();
    });

    // The deactivation + "contact HR" guidance is the user-facing contract of
    // the single-shot policy and must reach the page verbatim.
    expect(
      screen.getByText(/onboarding link has been deactivated/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/contact hr for a new invitation/i)
    ).toBeInTheDocument();

    // No per-field error highlight — the response carried no `errors` payload.
    expect(
      screen.queryByText(/first name is required/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/date of birth is required/i)
    ).not.toBeInTheDocument();

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("rejects a date of birth with an invalid format", async () => {
    // jsdom enforces the HTML spec on <input type="date"> and resets invalid
    // values to "", which would trigger the "required" error instead of the
    // "invalid format" error. We bypass jsdom's sanitization by overwriting the
    // value property directly on the input element so the format branch is
    // exercised independently.
    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

    const dobInput = screen.getByLabelText(
      /date of birth/i
    ) as HTMLInputElement;

    // Override value to a non-empty, non-YYYY-MM-DD string bypassing jsdom's sanitizer.
    Object.defineProperty(dobInput, "value", {
      writable: true,
      value: "13/05/1990",
    });
    fireEvent.change(dobInput, { target: {} });

    // Fill remaining valid fields without overriding the DOB input.
    const firstNameInput = screen.getByLabelText(/first name|vorname/i);
    const lastNameInput = screen.getByLabelText(/last name|nachname/i);
    const passwordInput = screen.getByLabelText(/^password$|^passwort$/i);
    const confirmPasswordInput = document.querySelector(
      'input[name="password_confirmation"]'
    ) as HTMLInputElement;

    fireEvent.change(firstNameInput, { target: { value: "John" } });
    fireEvent.change(lastNameInput, { target: { value: "Doe" } });
    fireEvent.change(passwordInput, { target: { value: "SecurePass123!" } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: "SecurePass123!" },
    });

    const submitButton = screen.getByRole("button", {
      name: /complete account setup/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/please enter a valid date of birth/i)
      ).toBeInTheDocument();
    });

    expect(onboardingApi.completeOnboarding).not.toHaveBeenCalled();
  });

  it("rejects an impossible calendar day (e.g. 1990-02-31) before submitting", async () => {
    // The shape regex alone would happily forward a typo like 1990-02-31 to
    // the backend, where the single-shot identity policy would then burn the
    // magic link over a simple mistake. Client-side calendar validation is the
    // last line of defense for the invitee.
    //
    // jsdom sanitizes invalid values out of <input type="date">, so we bypass
    // its sanitizer by writing directly to the value property — the same
    // pattern used for the "invalid format" test below.
    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

    const dobInput = screen.getByLabelText(
      /date of birth/i
    ) as HTMLInputElement;
    Object.defineProperty(dobInput, "value", {
      writable: true,
      value: "1990-02-31",
    });
    fireEvent.change(dobInput, { target: {} });

    const firstNameInput = screen.getByLabelText(/first name|vorname/i);
    const lastNameInput = screen.getByLabelText(/last name|nachname/i);
    const passwordInput = screen.getByLabelText(/^password$|^passwort$/i);
    const confirmPasswordInput = document.querySelector(
      'input[name="password_confirmation"]'
    ) as HTMLInputElement;

    fireEvent.change(firstNameInput, { target: { value: "John" } });
    fireEvent.change(lastNameInput, { target: { value: "Doe" } });
    fireEvent.change(passwordInput, { target: { value: "SecurePass123!" } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: "SecurePass123!" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /complete account setup/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/please enter a valid date of birth/i)
      ).toBeInTheDocument();
    });

    expect(onboardingApi.completeOnboarding).not.toHaveBeenCalled();
  });

  it("treats a 200 token-validation response that lacks `valid: true` as invalid", async () => {
    // Defense-in-depth: the API contract pins `data.valid` to `const: true` on
    // a 200, but we must not let a contract regression (or a mocked backend)
    // silently send the user into the form with an unusable link.
    vi.mocked(onboardingApi.validateOnboardingToken).mockResolvedValueOnce({
      data: { valid: false as unknown as true },
    });

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitFor(() => {
      expect(screen.getByText(/invalid onboarding link/i)).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: /complete account setup/i })
    ).not.toBeInTheDocument();
  });

  it("rejects a date of birth that is today or in the future", async () => {
    // Must match the local-day definition used by the production code.
    // Using toISOString() here would test against the UTC day instead and
    // hide the off-by-one bug that the production code is meant to avoid.
    const today = formatLocalYmd(new Date());

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

    fillValidFormAndSubmit({ dateOfBirth: today });

    await waitFor(() => {
      expect(
        screen.getByText(/date of birth must be in the past/i)
      ).toBeInTheDocument();
    });

    expect(onboardingApi.completeOnboarding).not.toHaveBeenCalled();
  });

  it("shows error if token or email missing", async () => {
    renderWithProviders(<OnboardingComplete />, "/onboarding/complete");

    await waitFor(() => {
      expect(screen.getByText(/missing token and email/i)).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /go to login/i })
    ).toBeInTheDocument();
    expectOnboardingAuthFrame();
  });

  it("renders the validating state through the onboarding auth shell", () => {
    vi.mocked(onboardingApi.validateOnboardingToken).mockReturnValueOnce(
      new Promise(() => {
        // Keep the component in its initial validating state.
      })
    );

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    expect(
      screen.getByRole("status", { name: /validating onboarding link/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/validating your link/i)).not.toBeInTheDocument();
    expectOnboardingAuthFrame();
  });

  it("shows a dedicated rate-limit state when token validation returns 429", async () => {
    vi.mocked(onboardingApi.validateOnboardingToken).mockRejectedValueOnce({
      response: {
        status: 429,
        data: {
          message: "Too many onboarding attempts. Please try again later.",
        },
        retryAfterSeconds: 120,
      },
    });

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitFor(() => {
      expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/invalid link/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/please try again in about 2 minutes/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /try again/i })
    ).toBeInTheDocument();
    expectOnboardingAuthFrame();
  });

  it("shows singular minute hint when retryAfterSeconds is ≤60", async () => {
    vi.mocked(onboardingApi.validateOnboardingToken).mockRejectedValueOnce({
      response: {
        status: 429,
        data: {
          message: "Too many onboarding attempts. Please try again later.",
        },
        retryAfterSeconds: 45,
      },
    });

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitFor(() => {
      expect(
        screen.getByText(/please try again in about 1 minute/i)
      ).toBeInTheDocument();
    });
  });

  it("validates required fields on submit", async () => {
    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

    const form = screen
      .getByRole("button", {
        name: /complete account setup/i,
      })
      .closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
      expect(
        screen.getByText(/date of birth is required/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });

    expect(onboardingApi.completeOnboarding).not.toHaveBeenCalled();
  });

  it("validates password minimum length (12 characters)", async () => {
    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

    fillValidFormAndSubmit({
      password: "short",
      confirmPassword: "",
    });

    await waitFor(() => {
      expect(
        screen.getByText(/^Password must be at least 12 characters$/i)
      ).toBeInTheDocument();
    });

    expect(onboardingApi.completeOnboarding).not.toHaveBeenCalled();
  });

  it("validates password confirmation match", async () => {
    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

    fillValidFormAndSubmit({ confirmPassword: "different" });

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });

    expect(onboardingApi.completeOnboarding).not.toHaveBeenCalled();
  });

  it("successfully completes onboarding with valid data", async () => {
    const mockResponse = {
      message: "Onboarding completed successfully",
      data: {
        user: {
          id: 1,
          email: "john@secpal.dev",
          email_verified: true,
          name: "John Doe",
        },
        employee: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          first_name: "John",
          last_name: "Doe",
          status: "pre_contract",
        },
      },
    };

    vi.mocked(onboardingApi.completeOnboarding).mockResolvedValue(mockResponse);

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

    fillValidFormAndSubmit();

    await waitFor(() => {
      expect(onboardingApi.completeOnboarding).toHaveBeenCalledWith({
        token: "abc",
        email: "test@secpal.dev",
        first_name: "John",
        last_name: "Doe",
        date_of_birth: "1990-01-01",
        password: "SecurePass123!",
      });
    });

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        id: "1",
        email: "john@secpal.dev",
        emailVerified: true,
        employeeStatus: "pre_contract",
        name: "John Doe",
      });
    });
  });

  it("defaults emailVerified to false when email_verified is omitted (fail closed)", async () => {
    const mockResponse = {
      message: "Onboarding completed successfully",
      data: {
        user: {
          id: 1,
          email: "john@secpal.dev",
          name: "John Doe",
        },
        employee: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          first_name: "John",
          last_name: "Doe",
          status: "pre_contract",
        },
      },
    };

    vi.mocked(onboardingApi.completeOnboarding).mockResolvedValue(mockResponse);

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();
    fillValidFormAndSubmit();

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        expect.objectContaining({ emailVerified: false })
      );
    });
  });

  it("respects email_verified false from API", async () => {
    const mockResponse = {
      message: "Onboarding completed successfully",
      data: {
        user: {
          id: 1,
          email: "john@secpal.dev",
          email_verified: false,
          name: "John Doe",
        },
        employee: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          first_name: "John",
          last_name: "Doe",
          status: "pre_contract",
        },
      },
    };

    vi.mocked(onboardingApi.completeOnboarding).mockResolvedValue(mockResponse);

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();
    fillValidFormAndSubmit();

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        expect.objectContaining({ emailVerified: false })
      );
    });
  });

  it("surfaces the backend's generic 422 message verbatim (invalid token)", async () => {
    // The backend returns its OWN localized message for generic 422 cases that
    // don't carry a per-field `errors` payload (invalid token, email mismatch,
    // identity verification failure, …). We must display it as-is and not
    // overlay a frontend guess, so the user sees the correct reason.
    const mockError = {
      response: {
        status: 422,
        data: {
          message:
            "Invalid or expired onboarding link. Please request a new invitation.",
        },
      },
    };

    vi.mocked(onboardingApi.completeOnboarding).mockRejectedValue(mockError);

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=invalid&email=test@secpal.dev"
    );

    await waitForFormReady();

    fillValidFormAndSubmit();

    await waitFor(() => {
      expect(
        screen.getByText(/invalid or expired onboarding link/i)
      ).toBeInTheDocument();
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("handles API error (rate limiting 429)", async () => {
    const mockError = {
      response: {
        status: 429,
        data: {
          message: "Too many requests",
        },
      },
    };

    vi.mocked(onboardingApi.completeOnboarding).mockRejectedValue(mockError);

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

    fillValidFormAndSubmit();

    await waitFor(() => {
      expect(
        screen.getByText(/too many onboarding attempts/i)
      ).toBeInTheDocument();
    });

    expect(screen.queryByText(/^invalid link$/i)).not.toBeInTheDocument();
  });

  it("shows inline retry guidance when submit-time rate limiting includes Retry-After", async () => {
    const mockError = {
      response: {
        status: 429,
        data: {
          message: "Too many requests",
        },
        retryAfterSeconds: 120,
      },
    };

    vi.mocked(onboardingApi.completeOnboarding).mockRejectedValue(mockError);

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

    fillValidFormAndSubmit();

    await waitFor(() => {
      expect(
        screen.getByText(
          /too many onboarding attempts\. please try again later\./i
        )
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/please try again in about 2 minutes/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/^too many requests$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^invalid link$/i)).not.toBeInTheDocument();
  });

  it("uses onboarding-specific fallback wording for submit-time rate limits without Retry-After", async () => {
    const mockError = {
      response: {
        status: 429,
        data: {
          message: "Too many requests",
        },
      },
    };

    vi.mocked(onboardingApi.completeOnboarding).mockRejectedValue(mockError);

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

    fillValidFormAndSubmit();

    await waitFor(() => {
      expect(
        screen.getByText(
          /^too many onboarding attempts\. please try again later\.$/i
        )
      ).toBeInTheDocument();
    });

    expect(screen.queryByText(/^too many requests$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^invalid link$/i)).not.toBeInTheDocument();
  });

  it("handles API validation errors from backend", async () => {
    const mockError = {
      response: {
        status: 422,
        data: {
          message: "The given data was invalid.",
          errors: {
            first_name: ["The first name field is required."],
            password: ["The password must be at least 12 characters."],
          },
        },
      },
    };

    vi.mocked(onboardingApi.completeOnboarding).mockRejectedValue(mockError);

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

    fillValidFormAndSubmit({
      password: "ValidPassword123!",
      confirmPassword: "ValidPassword123!",
    });

    await waitFor(() => {
      expect(
        screen.getByText("Please review the highlighted fields and try again.")
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText("The given data was invalid.")
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("The first name field is required.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("The password must be at least 12 characters.")
    ).toBeInTheDocument();
  });

  it("localizes known password leak message in German", async () => {
    i18n.activate("de");
    const mockError = {
      response: {
        status: 422,
        data: {
          message: "The given data was invalid.",
          errors: {
            password: [
              "The given password has appeared in a data leak. Please choose a different password.",
            ],
          },
        },
      },
    };

    vi.mocked(onboardingApi.completeOnboarding).mockRejectedValue(mockError);

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();
    fillValidFormAndSubmit({
      password: "ValidPassword123!",
      confirmPassword: "ValidPassword123!",
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Das angegebene Passwort ist in einem Datenleck aufgetaucht. Bitte wählen Sie ein anderes Passwort."
        )
      ).toBeInTheDocument();
    });

    i18n.activate("en");
  });

  it("handles generic API errors (500)", async () => {
    const mockError = {
      response: {
        status: 500,
        data: {
          message: "Internal server error",
        },
      },
    };

    vi.mocked(onboardingApi.completeOnboarding).mockRejectedValue(mockError);

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

    fillValidFormAndSubmit();

    await waitFor(() => {
      expect(
        screen.getByText(
          /a server error occurred\. please try again later or contact support if the problem persists\./i
        )
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/internal server error/i)
    ).not.toBeInTheDocument();
  });

  it("handles network errors (no response)", async () => {
    const mockError = {
      message: "Network Error",
    };

    vi.mocked(onboardingApi.completeOnboarding).mockRejectedValue(mockError);

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

    fillValidFormAndSubmit();

    await waitFor(() => {
      expect(
        screen.getByText(/failed to complete onboarding/i)
      ).toBeInTheDocument();
    });
  });

  it("navigates to login when clicking 'Go to Login' button", () => {
    renderWithProviders(<OnboardingComplete />, "/onboarding/complete");

    const loginButton = screen.getByRole("button", { name: /go to login/i });
    expect(loginButton).toBeInTheDocument();

    // Verify button is interactive and clickable
    fireEvent.click(loginButton);
    expect(loginButton).toBeEnabled();
  });
});
