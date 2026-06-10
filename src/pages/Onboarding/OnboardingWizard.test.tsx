// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ApiError } from "../../services/ApiError";
import { AuthContext } from "../../contexts/auth-context";
import * as authApi from "../../services/authApi";
import { clearOfflineVaultSession } from "../../lib/offlineVault";
import { OnboardingWizard } from "./OnboardingWizard";

const onboardingApiMocks = vi.hoisted(() => ({
  createOnboardingSubmission: vi.fn(),
  fetchOnboardingNationalityOptions: vi.fn(),
  fetchOnboardingSteps: vi.fn(),
  fetchOnboardingTemplate: vi.fn(),
  deleteOnboardingFile: vi.fn(),
  uploadOnboardingFile: vi.fn(),
  updateOnboardingSubmission: vi.fn(),
}));

const employeeApiMocks = vi.hoisted(() => ({
  fetchEmployee: vi.fn(),
}));

vi.mock("../../services/onboardingApi", () => onboardingApiMocks);
vi.mock("../../services/employeeApi", () => employeeApiMocks);
vi.mock("../../services/authApi", () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  logoutAll: vi.fn(),
}));

// Pin the test clock so contract-start-date / residence-title-expiry
// validation scenarios stay deterministic. Without this, hard-coded
// fixture dates (e.g. `2026-06-01`) silently become "in the past" once
// the wall clock crosses them, breaking CI without any code change.
// We only fake `Date`, leaving real `setTimeout`/`setInterval` for
// React Testing Library's `findBy*`/`waitFor` polling, and let the
// mocked clock advance naturally so animations behave normally.
//
// The pinned date sits a few weeks before the earliest fixture date
// (`2026-06-01`) so residence-title expiries used in "happy path"
// scenarios are still strictly in the future, while expiries used in
// "expired" scenarios (e.g. `2020-01-01`) remain firmly in the past.
const FROZEN_TEST_DATE = new Date("2026-05-15T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["Date"],
    shouldAdvanceTime: true,
    now: FROZEN_TEST_DATE.getTime(),
  });
});

function renderWithProviders() {
  return render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <I18nProvider i18n={i18n}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingWizard />} />
          <Route
            path="/onboarding/submitted"
            element={
              <div>
                <h1>You&apos;re all set</h1>
              </div>
            }
          />
        </Routes>
      </I18nProvider>
    </MemoryRouter>
  );
}

function setCsrfTokenCookie(value: string) {
  document.cookie = `XSRF-TOKEN=;expires=${new Date(0).toUTCString()};path=/`;
  document.cookie = `XSRF-TOKEN=${encodeURIComponent(value)};path=/`;
}

async function renderWithAuthenticatedProviders(options?: {
  contractStartDate?: string | null;
  employeeId?: string;
  onboardingWorkflowStatus?:
    | "account_initialized"
    | "in_progress"
    | "submitted_for_review"
    | "changes_requested";
}) {
  const contractStartDate =
    options?.contractStartDate === undefined
      ? "2026-06-01"
      : options.contractStartDate;
  const employeeId = options?.employeeId ?? "employee-1";
  const onboardingWorkflowStatus =
    options?.onboardingWorkflowStatus ?? "account_initialized";
  vi.mocked(authApi.getCurrentUser).mockResolvedValue({
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    emailVerified: true,
    roles: [],
    permissions: [],
    hasOrganizationalScopes: false,
    hasCustomerAccess: false,
    hasSiteAccess: false,
    onboardingWorkflowStatus,
    employee: {
      id: employeeId,
      contract_start_date: contractStartDate,
    },
  } as Awaited<ReturnType<typeof authApi.getCurrentUser>>);

  return render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <I18nProvider i18n={i18n}>
        <AuthContext.Provider
          value={{
            user: {
              id: "user-1",
              name: "Test User",
              email: "test@example.com",
              emailVerified: true,
              employeeStatus: "pre_contract",
              onboardingWorkflowStatus,
              employee: {
                id: employeeId,
                contract_start_date: contractStartDate,
              },
            },
            isAuthenticated: true,
            isLoading: false,
            isVaultLocked: false,
            bootstrapRecoveryReason: null,
            login: vi.fn().mockResolvedValue(undefined),
            logout: vi.fn(),
            retryBootstrap: vi.fn(),
            hasPermission: vi.fn().mockReturnValue(false),
            hasOrganizationalAccess: vi.fn().mockReturnValue(false),
          }}
        >
          <Routes>
            <Route path="/onboarding" element={<OnboardingWizard />} />
            <Route
              path="/onboarding/submitted"
              element={
                <div>
                  <h1>You&apos;re all set</h1>
                </div>
              }
            />
          </Routes>
        </AuthContext.Provider>
      </I18nProvider>
    </MemoryRouter>
  );
}

async function selectNationality(
  user: ReturnType<typeof userEvent.setup>,
  query = "de"
) {
  const nationalityControl = screen.getByLabelText(/^nationalities$/i);

  if (nationalityControl instanceof HTMLSelectElement) {
    await user.selectOptions(nationalityControl, query.toUpperCase());
    return;
  }

  await user.click(nationalityControl);

  if (nationalityControl instanceof HTMLInputElement) {
    await user.clear(nationalityControl);
    await user.type(nationalityControl, query);
  } else {
    const searchbox = await screen.findByRole("searchbox");
    await user.clear(searchbox);
    await user.type(searchbox, query);
  }

  await user.keyboard("{ArrowDown}{Enter}");
}

async function enableIdentityUpload(
  user: ReturnType<typeof userEvent.setup>,
  documentKind?: "id_card" | "passport"
) {
  const uploadNowControl = screen.queryByLabelText(
    /would you like to upload your identity document now\?/i
  );
  if (uploadNowControl instanceof HTMLSelectElement) {
    await user.selectOptions(uploadNowControl, "yes");
  } else {
    const identityUploadGroup = screen.getByRole("radiogroup", {
      name: /would you like to upload your identity document now\?/i,
    });
    await user.click(
      within(identityUploadGroup).getByRole("radio", { name: /^(yes|ja)$/i })
    );
  }

  if (documentKind) {
    const kindSelector = screen.queryByLabelText(
      /which document are you uploading\?/i
    );
    if (kindSelector instanceof HTMLSelectElement) {
      await user.selectOptions(kindSelector, documentKind);
    }
  }
}

async function deferIdentityUpload(user: ReturnType<typeof userEvent.setup>) {
  const uploadNowControl = screen.queryByLabelText(
    /would you like to upload your identity document now\?/i
  );
  if (uploadNowControl instanceof HTMLSelectElement) {
    await user.selectOptions(uploadNowControl, "no");
    return;
  }

  const identityUploadGroup = screen.getByRole("radiogroup", {
    name: /would you like to upload your identity document now\?/i,
  });
  await user.click(
    within(identityUploadGroup).getByRole("radio", { name: /^(no|nein)$/i })
  );
}

async function setEmploymentPermitted(
  user: ReturnType<typeof userEvent.setup>,
  value: "yes" | "no"
) {
  const employmentControl = screen.queryByLabelText(/employment permitted/i);
  if (employmentControl instanceof HTMLSelectElement) {
    await user.selectOptions(employmentControl, value);
    return;
  }

  const employmentGroup = screen.getByRole("radiogroup", {
    name: /employment permitted/i,
  });
  await user.click(
    within(employmentGroup).getByRole("radio", {
      name: value === "yes" ? /^(yes|ja)$/i : /^(no|nein)$/i,
    })
  );
}

describe("OnboardingWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearOfflineVaultSession();
    setCsrfTokenCookie("test-csrf-token");
    i18n.load("en", {});
    i18n.activate("en");

    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValue([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Tell us who you are.",
        template_id: "template-1",
        is_required: true,
        is_completed: false,
        submission: {
          id: "submission-1",
          employee_id: "employee-1",
          form_template_id: "template-1",
          form_data: {
            birth_name: "Lovelace",
            gender: "female",
          },
          status: "draft",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
    ]);

    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValue({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["male", "female", "diverse"],
          },
          birth_name: {
            type: "string",
            title: "Birth Name",
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });

    onboardingApiMocks.createOnboardingSubmission.mockResolvedValue({
      id: "submission-1",
      employee_id: "employee-1",
      form_template_id: "template-1",
      form_data: {
        birth_name: "Ada",
      },
      status: "draft",
      created_at: "2026-04-30T00:00:00Z",
      updated_at: "2026-04-30T00:00:00Z",
    });

    onboardingApiMocks.updateOnboardingSubmission.mockResolvedValue({
      id: "submission-1",
      employee_id: "employee-1",
      form_template_id: "template-1",
      form_data: {
        birth_name: "Ada",
        gender: "female",
      },
      status: "draft",
      created_at: "2026-04-30T00:00:00Z",
      updated_at: "2026-04-30T00:00:00Z",
    });
    onboardingApiMocks.uploadOnboardingFile.mockResolvedValue({
      id: "file-1",
      filename: "contract.pdf",
    });
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValue([
      { code: "DE", name: "Germany" },
      { code: "PL", name: "Poland" },
    ]);
    employeeApiMocks.fetchEmployee.mockResolvedValue({
      contract_start_date: null,
    });
  });

  it("renders schema fields, prefills the draft submission, and updates existing drafts without alerts", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    const birthNameInput = await screen.findByLabelText(/birth name/i);
    expect(birthNameInput).toHaveValue("Lovelace");
    expect(screen.getByLabelText(/gender/i)).toHaveValue("female");

    await user.clear(birthNameInput);
    await user.type(birthNameInput, "Ada");
    await user.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      expect(
        onboardingApiMocks.updateOnboardingSubmission
      ).toHaveBeenCalledWith(
        "submission-1",
        expect.objectContaining({
          status: "draft",
          form_data: expect.objectContaining({
            birth_name: "Ada",
            gender: "female",
          }),
        })
      );
    });

    expect(
      onboardingApiMocks.createOnboardingSubmission
    ).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent(/draft saved/i);

    alertSpy.mockRestore();
  });

  it("renders the custom residential address history onboarding step", async () => {
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValueOnce([
      {
        step_number: 2,
        title: "Residential Address History",
        description: "Current and previous residences.",
        template_id: "template-addresses",
        is_required: true,
        is_completed: false,
        submission: null,
      },
    ]);

    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-addresses",
      template_key: "residential_address_history",
      name: "Residential Address History",
      title: "Residential Address History",
      description: "Current and previous residences.",
      form_schema: {
        title: "Residential Address History",
        type: "object",
        properties: {
          current_address: {
            type: "object",
            title: "Current Residential Address",
            properties: {},
          },
          previous_addresses: {
            type: "array",
            title: "Previous Residences",
            items: {
              type: "object",
              properties: {},
            },
          },
        },
        required: ["current_address"],
      },
      is_required: true,
      is_system_template: true,
      sort_order: 2,
      can_be_deleted: false,
      can_be_edited: false,
    });

    renderWithProviders();

    expect(
      await screen.findByRole("heading", {
        name: /residential address history/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /current residential address/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /bewacher id/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /previous residences/i })
    ).not.toBeInTheDocument();
  });

  it("opens the completion page when onboarding was already submitted", async () => {
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValue([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Tell us who you are.",
        template_id: "template-1",
        is_required: true,
        is_completed: true,
        submission: {
          id: "submission-1",
          employee_id: "employee-1",
          form_template_id: "template-1",
          form_data: {
            birth_name: "Lovelace",
            gender: "female",
          },
          status: "submitted",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
    ]);

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /you're all set/i })
    ).toBeInTheDocument();
  });

  it("redirects locked onboarding workflow users to the submitted page", async () => {
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValue([]);

    await renderWithAuthenticatedProviders({
      onboardingWorkflowStatus: "submitted_for_review",
    });

    expect(
      await screen.findByRole("heading", { name: /you're all set/i })
    ).toBeInTheDocument();
  });

  it("requires residence title confirmation for non-exempt nationalities", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValueOnce([
      { code: "TR", name: "Turkey" },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["male", "female", "diverse"],
          },
          contract_start_date: {
            type: "string",
            title: "Contract start date",
            format: "date",
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["TR"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await user.type(
      screen.getByLabelText(/contract start date/i),
      "2030-12-31"
    );
    await selectNationality(user, "tr");
    await enableIdentityUpload(user);

    const attachmentInput = await screen.findByLabelText(/^attachment$/i);
    await user.upload(
      attachmentInput,
      new File(["passport"], "passport.png", { type: "image/png" })
    );
    await user.click(screen.getByRole("button", { name: /upload file/i }));
    await screen.findByText(/file uploaded successfully\./i);

    expect(screen.getByLabelText(/residence title type/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/employment permitted/i)
    ).not.toBeInTheDocument();
    expect(screen.getByText("EU Blue Card")).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/unlimited residence title/i)
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(await screen.findAllByText("This field is required.")).toHaveLength(
      1
    );

    await user.selectOptions(
      screen.getByLabelText(/residence title type/i),
      "Aufenthaltserlaubnis"
    );
    expect(
      screen.queryByLabelText(/employment permitted/i)
    ).not.toBeInTheDocument();

    const expiryInput = screen.getByLabelText(/residence title valid until/i);
    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );
    expect(await screen.findAllByText("This field is required.")).toHaveLength(
      1
    );
    await user.type(expiryInput, "2030-12-31");
    expect(
      screen.queryByLabelText(/employment permitted/i)
    ).not.toBeInTheDocument();
    await user.clear(expiryInput);
    await user.type(expiryInput, "2031-01-01");
    expect(screen.getByLabelText(/employment permitted/i)).toBeInTheDocument();
    await setEmploymentPermitted(user, "no");

    const submitButton = screen.getByRole("button", {
      name: /submit for review/i,
    });
    expect(submitButton).toBeDisabled();

    await setEmploymentPermitted(user, "yes");
    expect(submitButton).toBeEnabled();
    const residenceTitleUploadGroup = await screen.findByRole("radiogroup", {
      name: /would you like to upload your residence title now\?/i,
    });
    await user.click(
      within(residenceTitleUploadGroup).getByRole("radio", {
        name: /^(no|nein)$/i,
      })
    );
    await user.clear(expiryInput);
    await user.type(expiryInput, "2031-01-01");

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    await waitFor(() => {
      expect(
        onboardingApiMocks.updateOnboardingSubmission
      ).toHaveBeenCalledWith(
        "submission-1",
        expect.objectContaining({
          form_data: expect.objectContaining({
            residence_permit_title: "Aufenthaltserlaubnis",
            residence_permit_employment_allowed: "yes",
            residence_permit_unlimited: false,
            residence_permit_expiry: "2031-01-01",
          }),
        })
      );
    });
  });

  it("uses the auth-derived contract start date even when a later date appears in step form data", async () => {
    const user = userEvent.setup();
    // Auth has 2026-05-01 (resolved from the auth token / employee record
    // path), step form data has the later 2026-06-01. The authoritative date
    // is the one resolved from the employee record / auth — the user-submitted
    // step value must NOT override it. A title expiring 2026-06-01 is AFTER
    // the auth date so it should pass validation here.
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValueOnce([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Tell us who you are.",
        template_id: "template-1",
        is_required: true,
        is_completed: false,
        submission: {
          id: "submission-1",
          employee_id: "employee-1",
          form_template_id: "template-1",
          form_data: {
            gender: "female",
            nationalities: ["TR"],
          },
          status: "draft",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
      {
        step_number: 2,
        title: "Employment Details",
        description: "Contract details",
        template_id: "template-employment",
        is_required: true,
        is_completed: false,
        submission: {
          id: "submission-employment",
          employee_id: "employee-1",
          form_template_id: "template-employment",
          form_data: {
            contract_start_date: "2026-06-01",
          },
          status: "draft",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
    ]);
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValueOnce([
      { code: "TR", name: "Turkey" },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["male", "female", "diverse"],
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["TR"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });

    await renderWithAuthenticatedProviders({
      contractStartDate: "2026-05-01",
    });

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user, "tr");
    await deferIdentityUpload(user);

    await user.selectOptions(
      screen.getByLabelText(/residence title type/i),
      "Aufenthaltserlaubnis"
    );

    const expiryInput = screen.getByLabelText(/residence title valid until/i);
    // 2026-06-01 is after auth date (2026-05-01) so validation must pass,
    // meaning employment-permitted question appears.
    fireEvent.change(expiryInput, { target: { value: "2026-06-01" } });
    fireEvent.blur(expiryInput);

    expect(
      await screen.findByLabelText(/employment permitted/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/must remain valid after your contract start date/i)
    ).not.toBeInTheDocument();
  });

  it("loads contract start date from the employee record when only employee_id is known", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValueOnce([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Tell us who you are.",
        template_id: "template-1",
        is_required: true,
        is_completed: false,
        submission: {
          id: "submission-1",
          employee_id: "employee-1",
          form_template_id: "template-1",
          form_data: {
            gender: "female",
            nationalities: ["TR"],
          },
          status: "draft",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
    ]);
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValueOnce([
      { code: "TR", name: "Turkey" },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["male", "female", "diverse"],
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["TR"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });
    employeeApiMocks.fetchEmployee.mockResolvedValueOnce({
      contract_start_date: "2026-06-01",
    });

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(employeeApiMocks.fetchEmployee).toHaveBeenCalledWith("employee-1");
    });

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user, "tr");
    await deferIdentityUpload(user);
    await user.selectOptions(
      screen.getByLabelText(/residence title type/i),
      "Aufenthaltserlaubnis"
    );

    const expiryInput = screen.getByLabelText(/residence title valid until/i);
    fireEvent.change(expiryInput, { target: { value: "2030-12-31" } });
    fireEvent.blur(expiryInput);

    expect(
      await screen.findByLabelText(/employment permitted/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/must remain valid after your contract start date/i)
    ).not.toBeInTheDocument();
  });

  it("loads contract start date from the authenticated employee when the step payload omits employee_id", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValueOnce([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Tell us who you are.",
        template_id: "template-1",
        is_required: true,
        is_completed: false,
        submission: {
          id: "submission-1",
          form_template_id: "template-1",
          form_data: {
            gender: "female",
            nationalities: ["TR"],
          },
          status: "draft",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
    ]);
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValueOnce([
      { code: "TR", name: "Turkey" },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["male", "female", "diverse"],
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["TR"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });
    employeeApiMocks.fetchEmployee.mockResolvedValueOnce({
      contract_start_date: "2026-06-01",
    });

    await renderWithAuthenticatedProviders({
      employeeId: "employee-auth-1",
      contractStartDate: null,
    });

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(employeeApiMocks.fetchEmployee).toHaveBeenCalledWith(
        "employee-auth-1"
      );
    });

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user, "tr");
    await deferIdentityUpload(user);
    await user.selectOptions(
      screen.getByLabelText(/residence title type/i),
      "Aufenthaltserlaubnis"
    );

    const expiryInput = screen.getByLabelText(/residence title valid until/i);
    fireEvent.change(expiryInput, { target: { value: "2030-12-31" } });
    fireEvent.blur(expiryInput);

    expect(
      await screen.findByLabelText(/employment permitted/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/must remain valid after your contract start date/i)
    ).not.toBeInTheDocument();
  });

  it("prefers the employee API record contract start date over a user-entered step date for residence-title validation", async () => {
    const user = userEvent.setup();
    // Step 2 form data contains an earlier date (user-submitted); the employee
    // record carries the authoritative HR-set date. The validator must use the
    // employee record so a title expiring between the two dates is still blocked.
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValueOnce([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Tell us who you are.",
        template_id: "template-1",
        is_required: true,
        is_completed: false,
        submission: {
          id: "submission-1",
          employee_id: "employee-1",
          form_template_id: "template-1",
          form_data: {
            gender: "female",
            nationalities: ["TR"],
          },
          status: "draft",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
      {
        step_number: 2,
        title: "Employment Details",
        description: "Contract details",
        template_id: "template-employment",
        is_required: true,
        is_completed: false,
        submission: {
          id: "submission-employment",
          employee_id: "employee-1",
          form_template_id: "template-employment",
          form_data: {
            // Earlier user-entered date — must NOT override the employee record.
            contract_start_date: "2026-05-01",
          },
          status: "draft",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
    ]);
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValueOnce([
      { code: "TR", name: "Turkey" },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["male", "female", "diverse"],
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["TR"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });
    // Authoritative date from the employee record: title expiring 2026-06-01
    // clears the earlier step date (2026-05-01) but must still fail against this.
    employeeApiMocks.fetchEmployee.mockResolvedValueOnce({
      contract_start_date: "2026-06-15",
    });

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(employeeApiMocks.fetchEmployee).toHaveBeenCalledWith("employee-1");
    });

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user, "tr");
    await deferIdentityUpload(user);

    await user.selectOptions(
      screen.getByLabelText(/residence title type/i),
      "Aufenthaltserlaubnis"
    );

    const expiryInput = screen.getByLabelText(/residence title valid until/i);
    // Expiry is after the step date (2026-05-01) but before the employee record (2026-06-15).
    fireEvent.change(expiryInput, { target: { value: "2026-06-01" } });
    fireEvent.blur(expiryInput);
    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(
      await screen.findByText(
        /must remain valid after your contract start date/i
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/employment permitted/i)
    ).not.toBeInTheDocument();
  });

  it("blocks limited residence titles when no contract start date is known yet", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValueOnce([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Tell us who you are.",
        template_id: "template-1",
        is_required: true,
        is_completed: false,
        submission: {
          id: "submission-1",
          employee_id: "employee-1",
          form_template_id: "template-1",
          form_data: {
            gender: "female",
            nationalities: ["TR"],
          },
          status: "draft",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
    ]);
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValueOnce([
      { code: "TR", name: "Turkey" },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["male", "female", "diverse"],
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["TR"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user, "tr");
    await deferIdentityUpload(user);
    await user.selectOptions(
      screen.getByLabelText(/residence title type/i),
      "Aufenthaltserlaubnis"
    );

    const expiryInput = screen.getByLabelText(/residence title valid until/i);
    fireEvent.change(expiryInput, { target: { value: "2030-12-31" } });
    fireEvent.blur(expiryInput);
    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText(
        /must remain valid after your contract start date/i
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/employment permitted/i)
    ).not.toBeInTheDocument();
    expect(
      onboardingApiMocks.updateOnboardingSubmission
    ).not.toHaveBeenCalled();
  });

  it("validates residence title expiry against contract start date from auth user fallback", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValueOnce([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Tell us who you are.",
        template_id: "template-1",
        is_required: true,
        is_completed: false,
        submission: {
          id: "submission-1",
          employee_id: "employee-1",
          form_template_id: "template-1",
          form_data: {
            gender: "female",
            nationalities: ["TR"],
          },
          status: "draft",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
    ]);
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValueOnce([
      { code: "TR", name: "Turkey" },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["male", "female", "diverse"],
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["TR"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });

    await renderWithAuthenticatedProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user, "tr");
    await deferIdentityUpload(user);

    await user.selectOptions(
      screen.getByLabelText(/residence title type/i),
      "Aufenthaltserlaubnis"
    );

    const expiryInput = screen.getByLabelText(/residence title valid until/i);
    fireEvent.change(expiryInput, { target: { value: "2026-06-01" } });
    fireEvent.blur(expiryInput);

    expect(
      await screen.findByText(
        /must remain valid after your contract start date/i
      )
    ).toBeInTheDocument();
  });

  it("keeps previously visible residence fields after uploading the residence title", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValueOnce([
      { code: "TR", name: "Turkey" },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["male", "female", "diverse"],
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["TR"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });
    onboardingApiMocks.updateOnboardingSubmission.mockImplementation(
      async (id, payload) => ({
        id,
        employee_id: "employee-1",
        form_template_id: "template-1",
        form_data:
          (payload as { form_data?: Record<string, unknown> }).form_data ?? {},
        status:
          (payload as { status?: "draft" | "submitted" }).status ?? "draft",
        created_at: "2026-04-30T00:00:00Z",
        updated_at: "2026-04-30T00:00:00Z",
      })
    );

    await renderWithAuthenticatedProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user, "tr");
    await deferIdentityUpload(user);
    await user.selectOptions(
      screen.getByLabelText(/residence title type/i),
      "Aufenthaltserlaubnis"
    );

    const expiryInput = screen.getByLabelText(/residence title valid until/i);
    fireEvent.change(expiryInput, { target: { value: "2031-01-01" } });
    fireEvent.blur(expiryInput);
    await setEmploymentPermitted(user, "yes");

    const residenceUploadDecisionGroup = await screen.findByRole("radiogroup", {
      name: /would you like to upload your residence title now\?/i,
    });
    await user.click(
      within(residenceUploadDecisionGroup).getByRole("radio", {
        name: /^(yes|ja)$/i,
      })
    );

    const residenceAttachmentInput =
      await screen.findByLabelText(/^attachment$/i);
    await user.upload(
      residenceAttachmentInput,
      new File(["permit-front"], "residence-title-front.png", {
        type: "image/png",
      })
    );
    await user.click(screen.getByRole("button", { name: /upload file/i }));
    await waitFor(() => {
      expect(onboardingApiMocks.uploadOnboardingFile).toHaveBeenCalled();
    });

    expect(screen.getByLabelText(/residence title type/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/residence title valid until/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/employment permitted/i)).toBeInTheDocument();
  });

  it("blocks progression when no contract start date source is available", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValueOnce([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Tell us who you are.",
        template_id: "template-1",
        is_required: true,
        is_completed: false,
        submission: {
          id: "submission-1",
          employee_id: "employee-1",
          form_template_id: "template-1",
          form_data: {
            gender: "female",
            nationalities: ["TR"],
          },
          status: "draft",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
      {
        step_number: 2,
        title: "Employment Details",
        description: "Contract details",
        template_id: "template-employment",
        is_required: true,
        is_completed: false,
        submission: {
          id: "submission-employment",
          employee_id: "employee-1",
          form_template_id: "template-employment",
          form_data: {},
          status: "draft",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
    ]);
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValueOnce([
      { code: "TR", name: "Turkey" },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["male", "female", "diverse"],
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["TR"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user, "tr");
    await deferIdentityUpload(user);
    await user.selectOptions(
      screen.getByLabelText(/residence title type/i),
      "Aufenthaltserlaubnis"
    );

    const expiryInput = screen.getByLabelText(/residence title valid until/i);
    fireEvent.change(expiryInput, { target: { value: "2026-06-01" } });
    fireEvent.blur(expiryInput);

    expect(
      await screen.findByText(
        /must remain valid after your contract start date/i
      )
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(
      screen.getByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument();
  });

  it("shows an explicit error when nationality options cannot be loaded", async () => {
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockRejectedValueOnce(
      new Error("network")
    );
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["nationalities"],
        properties: {
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        /nationality options could not be loaded right now/i
      )
    ).toBeInTheDocument();

    const nationalitySelect = screen.getByLabelText(/^nationalities$/i);
    expect(nationalitySelect).toBeDisabled();
  });

  it("shows identity upload also for exempt nationalities", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["male", "female", "diverse"],
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["DE", "TR"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user, "de");
    await enableIdentityUpload(user, "passport");

    expect(
      screen.getByRole("heading", { name: /identity document upload/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/attachment/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/document type/i)).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/proof of residence registration/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(/residence title \(front and back\)/i)
    ).not.toBeInTheDocument();
  });

  it("shows no identity upload section before a nationality is selected", async () => {
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", { name: /identity document upload/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/document category/i)
    ).not.toBeInTheDocument();
  });

  it("asks non-german applicants for passport uploads", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValueOnce([
      { code: "DE", name: "Germany" },
      { code: "TR", name: "Turkey" },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["nationalities"],
        properties: {
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["DE", "TR"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await selectNationality(user, "tr");
    await enableIdentityUpload(user);

    expect(
      screen.getByRole("heading", { name: /identity document upload/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /please upload your passport \(pdf, jpg, jpeg, png; max. 10 mb\)\./i
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^passport$/i).length).toBeGreaterThan(0);
  });

  it("normalizes nationality payloads to a single value before saving", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["nationalities"],
        properties: {
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["DE", "TR"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValueOnce([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Tell us who you are.",
        template_id: "template-1",
        is_required: true,
        is_completed: false,
        submission: {
          id: "submission-1",
          employee_id: "employee-1",
          form_template_id: "template-1",
          form_data: {
            nationalities: ["DE", "TR"],
          },
          status: "draft",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
    ]);

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      expect(
        onboardingApiMocks.updateOnboardingSubmission
      ).toHaveBeenCalledWith(
        "submission-1",
        expect.objectContaining({
          status: "draft",
          form_data: expect.objectContaining({
            nationalities: ["DE"],
          }),
        })
      );
    });
  });

  it("shows the API validation message when a file upload is rejected", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValueOnce([
      { code: "DE", name: "Germany" },
      { code: "TR", name: "Turkey" },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["nationalities"],
        properties: {
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["DE", "TR"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });
    onboardingApiMocks.uploadOnboardingFile.mockRejectedValue(
      new ApiError("The file must be a PDF, JPG, or PNG", 422, {})
    );

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await selectNationality(user, "tr");
    await enableIdentityUpload(user);

    const attachmentInput = await screen.findByLabelText(/attachment/i);
    await user.upload(
      attachmentInput,
      new File(["invalid"], "document.pdf", { type: "application/pdf" })
    );

    await user.click(screen.getByRole("button", { name: /upload file/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The file must be a PDF, JPG, or PNG"
    );
  });

  it("shows employment-permitted question for unlimited residence titles and asks about upload", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValueOnce([
      { code: "TR", name: "Turkey" },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["male", "female", "diverse"],
          },
          contract_start_date: {
            type: "string",
            title: "Contract start date",
            format: "date",
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: { type: "string", enum: ["TR"] },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });
    await renderWithAuthenticatedProviders({ contractStartDate: "2031-01-01" });

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user, "tr");
    await deferIdentityUpload(user);

    await user.selectOptions(
      screen.getByLabelText(/residence title type/i),
      "Niederlassungserlaubnis"
    );

    expect(screen.getByLabelText(/employment permitted/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/residence title valid until/i)
    ).not.toBeInTheDocument();

    await setEmploymentPermitted(user, "yes");

    expect(
      await screen.findByRole("radiogroup", {
        name: /would you like to upload your residence title now\?/i,
      })
    ).toBeInTheDocument();
  });

  it("shows a validation error when residence title upload choice is left blank", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValueOnce([
      { code: "TR", name: "Turkey" },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["male", "female", "diverse"],
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: { type: "string", enum: ["TR"] },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });
    await renderWithAuthenticatedProviders({ contractStartDate: "2031-01-01" });

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user, "tr");
    await deferIdentityUpload(user);

    await user.selectOptions(
      screen.getByLabelText(/residence title type/i),
      "Aufenthaltserlaubnis"
    );
    const expiryInput = screen.getByLabelText(/residence title valid until/i);
    fireEvent.change(expiryInput, { target: { value: "2032-01-01" } });
    fireEvent.blur(expiryInput);
    await setEmploymentPermitted(user, "yes");

    expect(
      await screen.findByRole("radiogroup", {
        name: /would you like to upload your residence title now\?/i,
      })
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText(
        /please choose whether you want to upload your residence title now/i
      )
    ).toBeInTheDocument();
    expect(
      onboardingApiMocks.updateOnboardingSubmission
    ).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "submitted" })
    );
  });

  it("shows a validation error when residence title Yes is chosen but no file is uploaded", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValueOnce([
      { code: "TR", name: "Turkey" },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["male", "female", "diverse"],
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: { type: "string", enum: ["TR"] },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });
    await renderWithAuthenticatedProviders({ contractStartDate: "2031-01-01" });

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user, "tr");
    await deferIdentityUpload(user);

    await user.selectOptions(
      screen.getByLabelText(/residence title type/i),
      "Aufenthaltserlaubnis"
    );
    const expiryInput = screen.getByLabelText(/residence title valid until/i);
    fireEvent.change(expiryInput, { target: { value: "2032-01-01" } });
    fireEvent.blur(expiryInput);
    await setEmploymentPermitted(user, "yes");

    const residenceTitleUploadGroup = await screen.findByRole("radiogroup", {
      name: /would you like to upload your residence title now\?/i,
    });
    await user.click(
      within(residenceTitleUploadGroup).getByRole("radio", {
        name: /^(yes|ja)$/i,
      })
    );

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText(
        /please upload at least one residence title file before continuing/i
      )
    ).toBeInTheDocument();
    expect(
      onboardingApiMocks.updateOnboardingSubmission
    ).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "submitted" })
    );
  });

  it("blocks submission when residence title expiry date is already in the past", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValueOnce([
      { code: "TR", name: "Turkey" },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["male", "female", "diverse"],
          },
          contract_start_date: {
            type: "string",
            title: "Contract start date",
            format: "date",
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["TR"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await user.type(
      screen.getByLabelText(/contract start date/i),
      "2030-12-31"
    );
    await selectNationality(user, "tr");
    await enableIdentityUpload(user);

    const attachmentInput = await screen.findByLabelText(/^attachment$/i);
    await user.upload(
      attachmentInput,
      new File(["passport"], "passport.png", { type: "image/png" })
    );
    await user.click(screen.getByRole("button", { name: /upload file/i }));
    await screen.findByText(/file uploaded successfully\./i);

    await user.selectOptions(
      screen.getByLabelText(/residence title type/i),
      "Aufenthaltserlaubnis"
    );

    const expiryInput = screen.getByLabelText(/residence title valid until/i);
    await user.type(expiryInput, "2020-01-01");

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText(/cannot be in the past/i)
    ).toBeInTheDocument();
    expect(
      onboardingApiMocks.updateOnboardingSubmission
    ).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "submitted" })
    );
  });

  it("shows success feedback and updates the file list after removing an uploaded file", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValueOnce([
      { code: "DE", name: "Germany" },
      { code: "TR", name: "Turkey" },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["nationalities"],
        properties: {
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["DE", "TR"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });
    onboardingApiMocks.uploadOnboardingFile.mockResolvedValueOnce({
      id: "file-1",
      filename: "passport.png",
    });
    onboardingApiMocks.deleteOnboardingFile.mockResolvedValueOnce(undefined);
    onboardingApiMocks.updateOnboardingSubmission.mockResolvedValue({
      id: "submission-1",
      employee_id: "employee-1",
      form_template_id: "template-1",
      form_data: { nationalities: ["TR"] },
      status: "draft",
      created_at: "2026-04-30T00:00:00Z",
      updated_at: "2026-04-30T00:00:00Z",
    });

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await selectNationality(user, "tr");
    await enableIdentityUpload(user);

    const attachmentInput = await screen.findByLabelText(/^attachment$/i);
    await user.upload(
      attachmentInput,
      new File(["passport"], "passport.png", { type: "image/png" })
    );
    await user.click(screen.getByRole("button", { name: /upload file/i }));
    await screen.findByText(/file uploaded successfully\./i);
    expect(screen.getByText("passport.png")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^remove$/i }));

    await waitFor(() => {
      expect(onboardingApiMocks.deleteOnboardingFile).toHaveBeenCalledWith(
        "submission-1",
        "file-1"
      );
    });

    expect(
      await screen.findByText(/file removed successfully/i)
    ).toBeInTheDocument();
    expect(screen.queryByText("passport.png")).not.toBeInTheDocument();
  });

  it("shows a validation error when identity upload choice is left blank and blocks submission", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValueOnce([
      { code: "TR", name: "Turkey" },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["male", "female", "diverse"],
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["TR"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user, "tr");

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText(
        /please choose whether you want to upload your identity document now/i
      )
    ).toBeInTheDocument();
    expect(
      onboardingApiMocks.updateOnboardingSubmission
    ).not.toHaveBeenCalled();
    expect(
      onboardingApiMocks.createOnboardingSubmission
    ).not.toHaveBeenCalled();
  });

  it("uses field-level validation errors for upload failures and localizes Laravel's generic upload message", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValueOnce([
      { code: "DE", name: "Germany" },
      { code: "TR", name: "Turkey" },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["nationalities"],
        properties: {
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["DE", "TR"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });
    onboardingApiMocks.uploadOnboardingFile.mockRejectedValue(
      new ApiError("The given data was invalid.", 422, {
        file: ["The file failed to upload."],
      })
    );

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await selectNationality(user, "tr");
    await enableIdentityUpload(user);

    const attachmentInput = await screen.findByLabelText(/attachment/i);
    await user.upload(
      attachmentInput,
      new File(["passport"], "passport.png", { type: "image/png" })
    );

    await user.click(screen.getByRole("button", { name: /upload file/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to upload file"
    );
  });
});

describe("OnboardingWizard optional emergency contact schema", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");

    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValue([
      {
        step_number: 1,
        title: "Emergency Contact",
        description: "Optional emergency contacts.",
        template_id: "template-emergency",
        is_required: false,
        is_completed: false,
        submission: null,
      },
    ]);

    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValue({
      id: "template-emergency",
      name: "Emergency Contact",
      title: "Emergency Contact",
      description: "Optional emergency contact persons",
      form_schema: {
        title: "Emergency Contact",
        description: "Optional emergency contact persons",
        type: "object",
        required: [],
        properties: {
          contact_1_name: {
            type: "string",
            title: "Contact 1: Name",
            maxLength: 100,
          },
          contact_1_phone: {
            type: "string",
            title: "Contact 1: Phone",
          },
          contact_1_relationship: {
            type: "string",
            title: "Contact 1: Relationship",
            enum: ["spouse", "friend"],
          },
          contact_2_name: {
            type: "string",
            title: "Contact 2: Name",
            maxLength: 100,
          },
          contact_2_phone: {
            type: "string",
            title: "Contact 2: Phone",
          },
          contact_2_relationship: {
            type: "string",
            title: "Contact 2: Relationship",
            enum: ["spouse", "friend"],
          },
        },
      },
      is_required: false,
      is_system_template: true,
      sort_order: 3,
      can_be_deleted: false,
      can_be_edited: false,
    });

    onboardingApiMocks.createOnboardingSubmission.mockResolvedValue({
      id: "submission-emergency",
      employee_id: "employee-1",
      form_template_id: "template-emergency",
      form_data: {},
      status: "submitted",
      created_at: "2026-04-30T00:00:00Z",
      updated_at: "2026-04-30T00:00:00Z",
    });
  });

  it("does not mark emergency contact fields required and submits empty data", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /emergency contact/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/^Optional$/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /skip this step/i })
    ).not.toBeInTheDocument();

    expect(screen.getByLabelText(/contact 1: name/i)).not.toHaveAttribute(
      "required"
    );
    expect(screen.getByLabelText(/contact 1: phone/i)).not.toHaveAttribute(
      "required"
    );
    expect(
      screen.getByLabelText(/contact 1: relationship/i)
    ).not.toHaveAttribute("required");

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    await waitFor(() => {
      expect(
        onboardingApiMocks.createOnboardingSubmission
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          form_template_id: "template-emergency",
          status: "submitted",
          form_data: {},
        })
      );
    });

    expect(
      await screen.findByRole("heading", { name: /you're all set/i })
    ).toBeInTheDocument();
  });

  it("shows the second emergency contact only after the first contact has details", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /emergency contact/i })
    ).toBeInTheDocument();

    expect(screen.queryByLabelText(/contact 2: name/i)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/contact 2: phone/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/contact 2: relationship/i)
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/contact 1: name/i), "Ada Lovelace");

    expect(screen.getByLabelText(/contact 2: name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contact 2: phone/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/contact 2: relationship/i)
    ).toBeInTheDocument();
  });

  it("does not render upload section on steps without nationality fields", async () => {
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /emergency contact/i })
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", { name: /supporting documents/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/document type/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /upload file/i })
    ).not.toBeInTheDocument();
  });

  it("hides stale residence title fields when the step schema has no nationalities field", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValueOnce([
      {
        step_number: 1,
        title: "Emergency Contact",
        description: "Optional emergency contacts.",
        template_id: "template-emergency",
        is_required: false,
        is_completed: false,
        submission: {
          id: "submission-emergency",
          employee_id: "employee-1",
          form_template_id: "template-emergency",
          form_data: {
            contact_1_name: "Ada Lovelace",
            nationalities: ["TR"],
            residence_permit_title: "Aufenthaltserlaubnis",
            residence_permit_employment_allowed: "yes",
            residence_permit_expiry: "2030-12-31",
          },
          status: "draft",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
    ]);
    onboardingApiMocks.updateOnboardingSubmission.mockResolvedValueOnce({
      id: "submission-emergency",
      employee_id: "employee-1",
      form_template_id: "template-emergency",
      form_data: {
        contact_1_name: "Ada Lovelace",
      },
      status: "draft",
      created_at: "2026-04-30T00:00:00Z",
      updated_at: "2026-04-30T00:00:00Z",
    });

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /emergency contact/i })
    ).toBeInTheDocument();

    expect(
      screen.queryByLabelText(/residence title type/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/employment permitted/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/residence title valid until/i)
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      expect(
        onboardingApiMocks.updateOnboardingSubmission
      ).toHaveBeenCalledTimes(1);

      const payload =
        onboardingApiMocks.updateOnboardingSubmission.mock.calls[0]?.[1];

      expect(payload).toMatchObject({
        status: "draft",
        form_data: {
          contact_1_name: "Ada Lovelace",
          nationalities: ["TR"],
        },
      });
      expect(payload?.form_data).not.toHaveProperty("residence_permit_title");
      expect(payload?.form_data).not.toHaveProperty(
        "residence_permit_employment_allowed"
      );
      expect(payload?.form_data).not.toHaveProperty("residence_permit_expiry");
    });
  });

  it("requires a phone number for each emergency contact with a name", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /emergency contact/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/contact 1: phone/i)).not.toHaveAttribute(
      "required"
    );

    await user.type(screen.getByLabelText(/contact 1: name/i), "Ada Lovelace");

    expect(screen.getByLabelText(/contact 1: phone/i)).toBeRequired();

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText("This field is required.")
    ).toBeInTheDocument();
    expect(
      onboardingApiMocks.createOnboardingSubmission
    ).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/contact 1: phone/i), "+491234567");
    await user.type(screen.getByLabelText(/contact 2: name/i), "Grace Hopper");

    expect(screen.getByLabelText(/contact 2: phone/i)).toBeRequired();

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText("This field is required.")
    ).toBeInTheDocument();
    expect(
      onboardingApiMocks.createOnboardingSubmission
    ).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/contact 2: phone/i), "+499876543");
    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    await waitFor(() => {
      expect(
        onboardingApiMocks.createOnboardingSubmission
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          form_template_id: "template-emergency",
          status: "submitted",
          form_data: expect.objectContaining({
            contact_1_name: "Ada Lovelace",
            contact_1_phone: "+491234567",
            contact_2_name: "Grace Hopper",
            contact_2_phone: "+499876543",
          }),
        })
      );
    });
  });

  it("keeps second-contact data when first-contact details are temporarily cleared", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /emergency contact/i })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/contact 1: name/i), "Ada Lovelace");
    await user.type(screen.getByLabelText(/contact 2: name/i), "Grace Hopper");
    await user.type(screen.getByLabelText(/contact 2: phone/i), "+499876543");

    await user.clear(screen.getByLabelText(/contact 1: name/i));
    await user.type(screen.getByLabelText(/contact 1: name/i), "Ada Lovelace");

    expect(screen.getByLabelText(/contact 2: name/i)).toHaveValue(
      "Grace Hopper"
    );
    expect(screen.getByLabelText(/contact 2: phone/i)).toHaveValue(
      "+499876543"
    );
  });

  it("clears conditional phone required errors when the corresponding contact name is removed", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /emergency contact/i })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/contact 1: name/i), "Ada Lovelace");
    await user.type(screen.getByLabelText(/contact 1: phone/i), "+491234567");
    await user.type(screen.getByLabelText(/contact 2: name/i), "Grace Hopper");

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText("This field is required.")
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/contact 2: name/i));

    await waitFor(() => {
      expect(
        screen.queryByText("This field is required.")
      ).not.toBeInTheDocument();
    });
  });
});

describe("OnboardingWizard HR-managed intended activities (BWR)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");

    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValue([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Your details.",
        template_id: "template-personal",
        is_required: true,
        is_completed: false,
        submission: null,
      },
    ]);

    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValue({
      id: "template-personal",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "Personal details for onboarding.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["gender", "nationalities", "intended_activities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["male", "female", "diverse"],
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["DE", "AT"],
            },
          },
          intended_activities: {
            type: "array",
            title: "Intended Activities",
            items: {
              type: "string",
              enum: ["door_control", "event_security"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });

    onboardingApiMocks.createOnboardingSubmission.mockResolvedValue({
      id: "submission-personal",
      employee_id: "employee-1",
      form_template_id: "template-personal",
      form_data: {
        gender: "female",
        nationalities: ["DE"],
      },
      status: "submitted",
      created_at: "2026-04-30T00:00:00Z",
      updated_at: "2026-04-30T00:00:00Z",
    });
  });

  it("does not show or submit intended activities in employee onboarding", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/intended activities/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user);
    await deferIdentityUpload(user);

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    await waitFor(() => {
      expect(
        onboardingApiMocks.createOnboardingSubmission
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          form_template_id: "template-personal",
          status: "submitted",
          form_data: expect.objectContaining({
            gender: "female",
            nationalities: ["DE"],
          }),
        })
      );
    });

    const call =
      onboardingApiMocks.createOnboardingSubmission.mock.calls[0]?.[0];
    expect(call?.form_data).not.toHaveProperty("intended_activities");

    expect(
      await screen.findByRole("heading", { name: /you're all set/i })
    ).toBeInTheDocument();
  });
});

describe("OnboardingWizard server-side validation feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");

    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValue([
      {
        step_number: 1,
        title: "Bank Account Details",
        description: "Salary payment.",
        template_id: "template-bank",
        is_required: false,
        is_completed: false,
        submission: null,
      },
    ]);

    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValue({
      id: "template-bank",
      name: "Bank Account Details",
      title: "Bank Account Details",
      description: "Bank info",
      form_schema: {
        type: "object",
        required: ["iban", "account_holder"],
        properties: {
          iban: {
            type: "string",
            title: "IBAN",
          },
          account_holder: {
            type: "string",
            title: "Account Holder",
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 2,
      can_be_deleted: false,
      can_be_edited: false,
    });
  });

  it("shows API field validation messages inline after Submit for Review", async () => {
    onboardingApiMocks.createOnboardingSubmission.mockRejectedValueOnce(
      new ApiError("The given data was invalid.", 422, {
        "form_data.iban": ["The string does not match the required pattern."],
      })
    );

    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /bank account details/i })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^iban$/i), "DE44500105175407324931");
    await user.type(screen.getByLabelText(/^account holder$/i), "Ada Lovelace");

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText(/IBAN: Please use the required format/i)
    ).toBeInTheDocument();
  });

  it("maps API validation errors to fields when saving a draft via Next", async () => {
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValue([
      {
        step_number: 1,
        title: "Bank Account Details",
        description: "Salary payment.",
        template_id: "template-bank",
        is_required: true,
        is_completed: false,
        submission: {
          id: "submission-bank",
          employee_id: "employee-1",
          form_template_id: "template-bank",
          form_data: {
            iban: "DE44500105175407324931",
            account_holder: "Ada Lovelace",
          },
          status: "draft",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
      {
        step_number: 2,
        title: "Final Step",
        description: "Other",
        template_id: "template-final",
        is_required: true,
        is_completed: false,
        submission: null,
      },
    ]);

    onboardingApiMocks.fetchOnboardingTemplate.mockImplementation(
      async (templateId: string) => {
        if (templateId === "template-final") {
          return {
            id: "template-final",
            name: "Final Step",
            title: "Final Step",
            description: "Other info",
            form_schema: {
              type: "object",
              required: [],
              properties: {
                note: { type: "string", title: "Note" },
              },
            },
            is_required: true,
            is_system_template: true,
            sort_order: 2,
            can_be_deleted: false,
            can_be_edited: false,
          };
        }

        return {
          id: "template-bank",
          name: "Bank Account Details",
          title: "Bank Account Details",
          description: "Bank info",
          form_schema: {
            type: "object",
            required: ["iban", "account_holder"],
            properties: {
              iban: {
                type: "string",
                title: "IBAN",
              },
              account_holder: {
                type: "string",
                title: "Account Holder",
              },
            },
          },
          is_required: true,
          is_system_template: true,
          sort_order: 1,
          can_be_deleted: false,
          can_be_edited: false,
        };
      }
    );

    onboardingApiMocks.updateOnboardingSubmission.mockRejectedValueOnce(
      new ApiError("The given data was invalid.", 422, {
        "form_data.iban": ["The string does not match the required pattern."],
      })
    );

    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /bank account details/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(
      await screen.findByText(/IBAN: Please use the required format/i)
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        "We couldn't save your draft yet. Please review the highlighted fields."
      )
    ).toBeInTheDocument();
  });

  it("names the affected array field when the API rejects a nested value", async () => {
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-bank",
      name: "Personal Information",
      title: "Personal Information",
      description: "Personal details",
      form_schema: {
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["female", "male"],
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["DE", "FR"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 2,
      can_be_deleted: false,
      can_be_edited: false,
    });
    onboardingApiMocks.createOnboardingSubmission.mockRejectedValueOnce(
      new ApiError("The given data was invalid.", 422, {
        form_data: ["The string should match pattern: ^[A-Z]{2}$"],
        "form_data.nationalities.0": [
          "The string should match pattern: ^[A-Z]{2}$",
        ],
      })
    );

    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information/i })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user);
    await deferIdentityUpload(user);
    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText(
        "Nationalities: Use a two-letter country code in uppercase, for example DE."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "We couldn't submit the form yet. Please review the highlighted fields."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText("The string should match pattern: ^[A-Z]{2}$")
    ).not.toBeInTheDocument();
  });

  it("rewrites global pattern validation messages with the affected field name", async () => {
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-bank",
      name: "Personal Information",
      title: "Personal Information",
      description: "Personal details",
      form_schema: {
        type: "object",
        required: ["birth_country"],
        properties: {
          birth_country: {
            type: "string",
            title: "Birth Country",
            pattern: "^[A-Z]{2}$",
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 2,
      can_be_deleted: false,
      can_be_edited: false,
    });
    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information/i })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^birth country$/i), "D1");
    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText(
        "Birth Country: Use a two-letter country code in uppercase, for example DE."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText("The string should match pattern: ^[A-Z]{2}$")
    ).not.toBeInTheDocument();
    expect(
      onboardingApiMocks.createOnboardingSubmission
    ).not.toHaveBeenCalled();
  });

  it("shows supplemental feedback when API errors target hidden HR-managed fields", async () => {
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-bank",
      name: "Personal Information",
      title: "Personal Information",
      description: "Personal details",
      form_schema: {
        type: "object",
        required: ["gender", "nationalities", "intended_activities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["female", "male"],
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["DE", "FR"],
            },
          },
          intended_activities: {
            type: "array",
            title: "Intended Activities",
            items: {
              type: "string",
              enum: ["door_control"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 2,
      can_be_deleted: false,
      can_be_edited: false,
    });
    onboardingApiMocks.createOnboardingSubmission.mockRejectedValueOnce(
      new ApiError("The given data was invalid.", 422, {
        form_data: ["Submission contains HR-managed fields."],
        "form_data.intended_activities": ["The selected value is invalid."],
      })
    );

    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information/i })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user);
    await deferIdentityUpload(user);
    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText("Submission contains HR-managed fields.")
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "We couldn't submit the form yet. Please review the highlighted fields."
      )
    ).not.toBeInTheDocument();
  });

  it("refreshes the wizard after generic onboarding workflow API errors", async () => {
    onboardingApiMocks.createOnboardingSubmission.mockRejectedValueOnce(
      new ApiError("The given data was invalid.", 422, {
        form_data: [
          "Cannot submit: onboarding workflow is not in an expected state for this employee.",
        ],
      })
    );

    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /bank account details/i })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^iban$/i), "DE44500105175407324931");
    await user.type(screen.getByLabelText(/^account holder$/i), "Ada Lovelace");

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText(
        /Your onboarding state changed on the server while you were editing\. The wizard was refreshed to the current server state\./i
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/form_data:/i)).not.toBeInTheDocument();
  });

  it("refreshes auth state and reloads steps for workflow-conflict 422 responses", async () => {
    onboardingApiMocks.fetchOnboardingSteps
      .mockResolvedValueOnce([
        {
          step_number: 1,
          title: "Bank Account Details",
          description: "Salary payment.",
          template_id: "template-bank",
          is_required: false,
          is_completed: false,
          submission: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          step_number: 1,
          title: "Bank Account Details",
          description: "Salary payment.",
          template_id: "template-bank",
          is_required: false,
          is_completed: false,
          submission: null,
        },
      ]);
    onboardingApiMocks.createOnboardingSubmission.mockRejectedValueOnce(
      new ApiError("The given data was invalid.", 422, {
        form_data: [
          "Cannot submit: onboarding workflow is not in an expected state for this employee.",
        ],
      })
    );

    const user = userEvent.setup();
    await renderWithAuthenticatedProviders();

    expect(
      await screen.findByRole("heading", { name: /bank account details/i })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^iban$/i), "DE44500105175407324931");
    await user.type(screen.getByLabelText(/^account holder$/i), "Ada Lovelace");

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    await waitFor(() => {
      expect(onboardingApiMocks.fetchOnboardingSteps).toHaveBeenCalledTimes(2);
    });
    expect(authApi.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(
        /Your onboarding state changed on the server while you were editing\. The wizard was refreshed to the current server state\./i
      )
    ).toBeInTheDocument();
  });

  it("lists whole-form API messages next to inline field errors", async () => {
    onboardingApiMocks.createOnboardingSubmission.mockRejectedValueOnce(
      new ApiError("The given data was invalid.", 422, {
        form_data: ["Submission contains HR-managed fields."],
        "form_data.iban": ["The string does not match the required pattern."],
      })
    );

    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /bank account details/i })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^iban$/i), "INVALID");
    await user.type(screen.getByLabelText(/^account holder$/i), "Ada Lovelace");

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText(/IBAN: Please use the required format/i)
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("region", {
        name: /Additional validation messages from the server/i,
      })
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Submission contains HR-managed fields\./i)
    ).toBeInTheDocument();
  });
});

describe("OnboardingWizard skip step behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");

    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValue([
      {
        step_number: 1,
        title: "Emergency Contact",
        description: "Optional emergency contacts.",
        template_id: "template-emergency",
        is_required: false,
        is_completed: false,
        submission: null,
      },
      {
        step_number: 2,
        title: "Bank Account Details",
        description: "Salary payment.",
        template_id: "template-bank",
        is_required: true,
        is_completed: false,
        submission: null,
      },
    ]);

    onboardingApiMocks.fetchOnboardingTemplate.mockImplementation(
      async (templateId: string) => {
        if (templateId === "template-emergency") {
          return {
            id: "template-emergency",
            name: "Emergency Contact",
            title: "Emergency Contact",
            description: "Optional emergency contact persons",
            form_schema: {
              title: "Emergency Contact",
              type: "object",
              required: [],
              properties: {
                contact_1_name: {
                  type: "string",
                  title: "Contact 1: Name",
                  maxLength: 100,
                },
              },
            },
            is_required: false,
            is_system_template: true,
            sort_order: 1,
            can_be_deleted: false,
            can_be_edited: false,
          };
        }

        return {
          id: "template-bank",
          name: "Bank Account Details",
          title: "Bank Account Details",
          description: "Bank info",
          form_schema: {
            type: "object",
            required: ["iban"],
            properties: {
              iban: { type: "string", title: "IBAN" },
            },
          },
          is_required: true,
          is_system_template: true,
          sort_order: 2,
          can_be_deleted: false,
          can_be_edited: false,
        };
      }
    );
  });

  it("advances to the next step without creating a submission when Skip this step is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /emergency contact/i })
    ).toBeInTheDocument();

    const skipButton = screen.getByRole("button", { name: /skip this step/i });
    expect(skipButton).toBeInTheDocument();

    await user.click(skipButton);

    expect(
      await screen.findByRole("heading", { name: /bank account details/i })
    ).toBeInTheDocument();

    expect(
      onboardingApiMocks.createOnboardingSubmission
    ).not.toHaveBeenCalled();
  });

  it("allows skipping optional steps even when existing draft values do not match pattern rules", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValue([
      {
        step_number: 1,
        title: "Emergency Contact",
        description: "Optional emergency contacts.",
        template_id: "template-emergency",
        is_required: false,
        is_completed: false,
        submission: {
          id: "submission-emergency",
          employee_id: "employee-1",
          form_template_id: "template-emergency",
          form_data: {
            contact_1_country: "d1",
          },
          status: "draft",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
      {
        step_number: 2,
        title: "Bank Account Details",
        description: "Salary payment.",
        template_id: "template-bank",
        is_required: true,
        is_completed: false,
        submission: null,
      },
    ]);

    onboardingApiMocks.fetchOnboardingTemplate.mockImplementation(
      async (templateId: string) => {
        if (templateId === "template-emergency") {
          return {
            id: "template-emergency",
            name: "Emergency Contact",
            title: "Emergency Contact",
            description: "Optional emergency contact persons",
            form_schema: {
              title: "Emergency Contact",
              type: "object",
              required: [],
              properties: {
                contact_1_country: {
                  type: "string",
                  title: "Contact 1: Country",
                  pattern: "^[A-Z]{2}$",
                },
              },
            },
            is_required: false,
            is_system_template: true,
            sort_order: 1,
            can_be_deleted: false,
            can_be_edited: false,
          };
        }

        return {
          id: "template-bank",
          name: "Bank Account Details",
          title: "Bank Account Details",
          description: "Bank info",
          form_schema: {
            type: "object",
            required: ["iban"],
            properties: {
              iban: { type: "string", title: "IBAN" },
            },
          },
          is_required: true,
          is_system_template: true,
          sort_order: 2,
          can_be_deleted: false,
          can_be_edited: false,
        };
      }
    );

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /emergency contact/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /skip this step/i }));

    expect(
      await screen.findByRole("heading", { name: /bank account details/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Use a two-letter country code in uppercase/i)
    ).not.toBeInTheDocument();
  });

  it("allows advancing from read-only steps without running required-field validation", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValue([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Submitted already.",
        template_id: "template-read-only",
        is_required: true,
        is_completed: true,
        submission: {
          id: "submission-read-only",
          employee_id: "employee-1",
          form_template_id: "template-read-only",
          form_data: {},
          status: "submitted",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
      {
        step_number: 2,
        title: "Bank Account Details",
        description: "Salary payment.",
        template_id: "template-bank",
        is_required: true,
        is_completed: false,
        submission: null,
      },
    ]);

    onboardingApiMocks.fetchOnboardingTemplate.mockImplementation(
      async (templateId: string) => {
        if (templateId === "template-read-only") {
          return {
            id: "template-read-only",
            name: "Personal Information",
            title: "Personal Information",
            description: "Read-only schema",
            form_schema: {
              type: "object",
              required: ["gender"],
              properties: {
                gender: { type: "string", title: "Gender" },
              },
            },
            is_required: true,
            is_system_template: true,
            sort_order: 1,
            can_be_deleted: false,
            can_be_edited: false,
          };
        }

        return {
          id: "template-bank",
          name: "Bank Account Details",
          title: "Bank Account Details",
          description: "Bank info",
          form_schema: {
            type: "object",
            required: ["iban"],
            properties: {
              iban: { type: "string", title: "IBAN" },
            },
          },
          is_required: true,
          is_system_template: true,
          sort_order: 2,
          can_be_deleted: false,
          can_be_edited: false,
        };
      }
    );

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(
      await screen.findByRole("heading", { name: /bank account details/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByText("This field is required.")
    ).not.toBeInTheDocument();
    expect(
      onboardingApiMocks.createOnboardingSubmission
    ).not.toHaveBeenCalled();
    expect(
      onboardingApiMocks.updateOnboardingSubmission
    ).not.toHaveBeenCalled();
  });
});

describe("OnboardingWizard initial loading and error states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("announces the initial loading state on the inner CardContent (not the outer Card)", () => {
    let resolveSteps: (value: unknown[]) => void = () => {};
    onboardingApiMocks.fetchOnboardingSteps.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSteps = resolve as (value: unknown[]) => void;
        })
    );
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValue([]);

    renderWithProviders();

    const loadingRegion = screen.getByRole("status");
    expect(loadingRegion).toHaveTextContent(/loading onboarding/i);
    expect(loadingRegion).toHaveAttribute("aria-live", "polite");
    // The role/aria-live must live on the inner CardContent, not the outer Card,
    // so a region landmark is not promoted on the surrounding container.
    expect(loadingRegion.tagName.toLowerCase()).toBe("div");

    resolveSteps([]);
  });

  it("renders a top-level error alert (without focusing through feedbackErrorRef) when steps fail to load", async () => {
    onboardingApiMocks.fetchOnboardingSteps.mockRejectedValueOnce(
      new ApiError("Server error", 500)
    );
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValue([]);

    renderWithProviders();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("focuses the feedback error alert when a save-draft submission fails (uses feedbackErrorRef)", async () => {
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValue([
      {
        step_number: 1,
        title: "Bank Account Details",
        description: "Salary payment.",
        template_id: "template-bank",
        is_required: false,
        is_completed: false,
        submission: null,
      },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValue({
      id: "template-bank",
      name: "Bank Account Details",
      title: "Bank Account Details",
      description: "Bank info",
      form_schema: {
        type: "object",
        required: [],
        properties: {
          iban: { type: "string", title: "IBAN" },
        },
      },
      is_required: false,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValue([]);
    onboardingApiMocks.createOnboardingSubmission.mockRejectedValueOnce(
      new ApiError("Backend was unreachable", 500)
    );

    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /bank account details/i })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^iban$/i), "DE123");
    await user.click(screen.getByRole("button", { name: /save draft/i }));

    const errorAlert = await screen.findByRole("alert");
    expect(errorAlert).toBeInTheDocument();
    await waitFor(() => expect(errorAlert).toHaveFocus());
  });
});
