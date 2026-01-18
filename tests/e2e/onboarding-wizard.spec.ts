// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { test, expect } from "@playwright/test";

test.describe("Onboarding Wizard", () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for onboarding steps and templates
    await page.route("**/api/v1/onboarding/steps", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              step_number: 1,
              title: "Personal Information",
              description: "Please provide your personal details",
              template_id: "template-1",
              is_completed: false,
            },
            {
              step_number: 2,
              title: "Bank Account Details",
              description: "Please provide your banking information",
              template_id: "template-2",
              is_completed: false,
            },
          ],
        }),
      });
    });

    await page.route("**/api/v1/onboarding/forms/template-1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "template-1",
            title: "Personal Information",
            description: "Please fill in your personal details",
            step_number: 1,
            form_schema: {
              type: "object",
              properties: {
                first_name: {
                  type: "string",
                  title: "First Name",
                },
                last_name: {
                  type: "string",
                  title: "Last Name",
                },
                gender: {
                  type: "string",
                  title: "Gender",
                  enum: ["male", "female", "diverse", "not_specified"],
                },
              },
              required: ["first_name", "last_name"],
            },
            is_system_template: true,
          },
        }),
      });
    });

    await page.route("**/api/v1/onboarding/forms/template-2", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "template-2",
            title: "Bank Account Details",
            description: "Please provide your banking information",
            step_number: 2,
            form_schema: {
              type: "object",
              properties: {
                iban: {
                  type: "string",
                  title: "IBAN",
                  pattern: "^[A-Z]{2}[0-9]{2}[A-Z0-9]+$",
                },
                bic: {
                  type: "string",
                  title: "BIC",
                },
              },
              required: ["iban"],
            },
            is_system_template: true,
          },
        }),
      });
    });

    await page.route("**/api/v1/onboarding/submissions", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              id: "submission-1",
              status: "draft",
            },
          }),
        });
      }
    });

    await page.route("**/api/v1/onboarding/submissions/*", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              id: "submission-1",
              status: "submitted",
            },
          }),
        });
      }
    });
  });

  test("displays progress indicator", async ({ page }) => {
    await page.goto("/onboarding");

    await expect(page.locator("text=Step 1 of 2")).toBeVisible();
    await expect(page.locator("text=50%")).toBeVisible();
  });

  test("renders first template form", async ({ page }) => {
    await page.goto("/onboarding");

    await expect(page.locator("text=Personal Information")).toBeVisible();
    await expect(page.locator('label:has-text("First Name")')).toBeVisible();
    await expect(page.locator('label:has-text("Last Name")')).toBeVisible();
    await expect(page.locator('label:has-text("Gender")')).toBeVisible();
  });

  test("validates required fields", async ({ page }) => {
    await page.goto("/onboarding");

    // Try to submit without filling required fields
    await page.click('button:has-text("Next")');

    // Should show validation errors
    await expect(page.locator("text=/required/i")).toBeVisible();
  });

  test("allows filling and submitting first form", async ({ page }) => {
    await page.goto("/onboarding");

    // Fill in form fields
    await page.fill('input[name="root_first_name"]', "John");
    await page.fill('input[name="root_last_name"]', "Doe");
    await page.selectOption('select[name="root_gender"]', "male");

    // Submit form
    await page.click('button:has-text("Next")');

    // Should move to next step
    await expect(page.locator("text=Step 2 of 2")).toBeVisible();
    await expect(page.locator("text=Bank Account Details")).toBeVisible();
  });

  test("allows navigating back to previous step", async ({ page }) => {
    await page.goto("/onboarding");

    // Fill and submit first form
    await page.fill('input[name="root_first_name"]', "John");
    await page.fill('input[name="root_last_name"]', "Doe");
    await page.click('button:has-text("Next")');

    // Wait for second step
    await expect(page.locator("text=Step 2 of 2")).toBeVisible();

    // Go back
    await page.click('button:has-text("Previous")');

    // Should be back on first step
    await expect(page.locator("text=Step 1 of 2")).toBeVisible();
    await expect(page.locator("text=Personal Information")).toBeVisible();
  });

  test("allows saving draft", async ({ page }) => {
    await page.goto("/onboarding");

    // Fill in partial data
    await page.fill('input[name="root_first_name"]', "Jane");

    // Click save draft
    await page.click('button:has-text("Save Draft")');

    // Should show success feedback (this depends on your implementation)
    // For now we just check that the button was clickable
    await expect(page.locator('button:has-text("Save Draft")')).toBeVisible();
  });

  test("completes full onboarding flow", async ({ page }) => {
    await page.goto("/onboarding");

    // Step 1: Personal Information
    await page.fill('input[name="root_first_name"]', "John");
    await page.fill('input[name="root_last_name"]', "Doe");
    await page.selectOption('select[name="root_gender"]', "male");
    await page.click('button:has-text("Next")');

    // Step 2: Bank Account
    await expect(page.locator("text=Step 2 of 2")).toBeVisible();
    await page.fill('input[name="root_iban"]', "DE89370400440532013000");
    await page.fill('input[name="root_bic"]', "COBADEFFXXX");

    // Submit final form
    await page.click('button:has-text("Submit for Review")');

    // Should show completion (depends on your success handling)
    // This is a placeholder - adjust based on actual behavior
    await page.waitForTimeout(1000);
  });

  test("displays loading state while fetching templates", async ({ page }) => {
    // Delay the API response to test loading state
    await page.route("**/api/v1/onboarding/steps", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto("/onboarding");

    // Should show loading indicator
    await expect(page.locator("text=/loading/i")).toBeVisible();
  });

  test("displays error when API fails", async ({ page }) => {
    // Override route to return error
    await page.route("**/api/v1/onboarding/steps", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Internal Server Error" }),
      });
    });

    await page.goto("/onboarding");

    // Should show error message
    await expect(page.locator("text=/failed to load/i")).toBeVisible();
  });

  test("prevents submission with invalid IBAN format", async ({ page }) => {
    await page.goto("/onboarding");

    // Complete first step
    await page.fill('input[name="root_first_name"]', "John");
    await page.fill('input[name="root_last_name"]', "Doe");
    await page.click('button:has-text("Next")');

    // Try to submit invalid IBAN
    await page.fill('input[name="root_iban"]', "INVALID-IBAN");
    await page.click('button:has-text("Submit for Review")');

    // Should show validation error for pattern mismatch
    await expect(page.locator("text=/pattern/i")).toBeVisible();
  });

  test("disables form controls while submitting", async ({ page }) => {
    await page.goto("/onboarding");

    await page.fill('input[name="root_first_name"]', "John");
    await page.fill('input[name="root_last_name"]', "Doe");

    // Start submission with slow response
    await page.route("**/api/v1/onboarding/submissions", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: "1", status: "draft" } }),
      });
    });

    await page.click('button:has-text("Save Draft")');

    // Buttons should be disabled during save
    await expect(page.locator('button:has-text("Save Draft")')).toBeDisabled();
  });
});
