// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { test, expect } from "@playwright/test";

test.describe("Onboarding Complete Flow", () => {
  test("completes onboarding with valid magic link", async ({ page }) => {
    // Navigate to onboarding complete page with token
    await page.goto(
      "/onboarding/complete?token=test-token-12345&email=john.doe@example.com"
    );

    // Verify page loaded
    await expect(page.locator("h2")).toContainText("Welcome to SecPal");

    // Fill form
    await page.fill('input[name="first_name"]', "John");
    await page.fill('input[name="last_name"]', "Doe");
    await page.fill(
      'input[type="password"][name="password"]',
      "SecurePass123!"
    );
    await page.fill(
      'input[type="password"][name="password_confirmation"]',
      "SecurePass123!"
    );

    // Submit
    await page.click('button:has-text("Complete Account Setup")');

    // Should redirect to onboarding wizard
    await expect(page).toHaveURL("/onboarding");
    await expect(page.locator("h1")).toContainText(
      "Welcome to SecPal Onboarding"
    );
  });

  test("shows error for invalid token", async ({ page }) => {
    await page.goto(
      "/onboarding/complete?token=invalid&email=test@example.com"
    );

    await page.fill('input[name="first_name"]', "John");
    await page.fill('input[name="last_name"]', "Doe");
    await page.fill(
      'input[type="password"][name="password"]',
      "SecurePass123!"
    );
    await page.fill(
      'input[type="password"][name="password_confirmation"]',
      "SecurePass123!"
    );

    await page.click('button:has-text("Complete Account Setup")');

    // Should show error message
    await expect(page.locator("text=Invalid or expired")).toBeVisible();
  });

  test("shows error for missing token", async ({ page }) => {
    await page.goto("/onboarding/complete");

    // Should show invalid link error immediately
    await expect(page.locator("text=Invalid onboarding link")).toBeVisible();
    await expect(page.locator('button:has-text("Go to Login")')).toBeVisible();
  });

  test("validates password mismatch", async ({ page }) => {
    await page.goto(
      "/onboarding/complete?token=valid-token&email=test@example.com"
    );

    await page.fill('input[name="first_name"]', "John");
    await page.fill('input[name="last_name"]', "Doe");
    await page.fill('input[type="password"][name="password"]', "password1");
    await page.fill(
      'input[type="password"][name="password_confirmation"]',
      "password2"
    );

    await page.click('button:has-text("Complete Account Setup")');

    // Should show validation error
    await expect(page.locator("text=Passwords do not match")).toBeVisible();
  });

  test("validates password minimum length", async ({ page }) => {
    await page.goto(
      "/onboarding/complete?token=valid-token&email=test@example.com"
    );

    await page.fill('input[name="first_name"]', "John");
    await page.fill('input[name="last_name"]', "Doe");
    await page.fill('input[type="password"][name="password"]', "short");
    await page.fill(
      'input[type="password"][name="password_confirmation"]',
      "short"
    );

    await page.click('button:has-text("Complete Account Setup")');

    // Should show validation error
    await expect(page.locator("text=at least 8 characters")).toBeVisible();
  });

  test("validates required fields", async ({ page }) => {
    await page.goto(
      "/onboarding/complete?token=valid-token&email=test@example.com"
    );

    // Submit empty form
    await page.click('button:has-text("Complete Account Setup")');

    // Should show validation errors for all required fields
    await expect(page.locator("text=First name is required")).toBeVisible();
    await expect(page.locator("text=Last name is required")).toBeVisible();
    await expect(page.locator("text=Password is required")).toBeVisible();
  });

  test("uploads profile photo", async ({ page }) => {
    await page.goto(
      "/onboarding/complete?token=valid-token&email=test@example.com"
    );

    // Create a test image file
    const buffer = Buffer.from("fake-image-data");
    await page.setInputFiles('input[type="file"]', {
      name: "profile-photo.jpg",
      mimeType: "image/jpeg",
      buffer: buffer,
    });

    // Verify preview shown
    await expect(page.locator('img[alt="Preview"]')).toBeVisible();

    // Fill rest of form
    await page.fill('input[name="first_name"]', "John");
    await page.fill('input[name="last_name"]', "Doe");
    await page.fill(
      'input[type="password"][name="password"]',
      "SecurePass123!"
    );
    await page.fill(
      'input[type="password"][name="password_confirmation"]',
      "SecurePass123!"
    );

    await page.click('button:has-text("Complete Account Setup")');

    // Should succeed
    await expect(page).toHaveURL("/onboarding");
  });

  test("shows loading state during submission", async ({ page }) => {
    await page.goto(
      "/onboarding/complete?token=valid-token&email=test@example.com"
    );

    await page.fill('input[name="first_name"]', "John");
    await page.fill('input[name="last_name"]', "Doe");
    await page.fill(
      'input[type="password"][name="password"]',
      "SecurePass123!"
    );
    await page.fill(
      'input[type="password"][name="password_confirmation"]',
      "SecurePass123!"
    );

    // Click submit
    await page.click('button:has-text("Complete Account Setup")');

    // Should show loading spinner immediately
    await expect(
      page.locator('button:has-text("Completing Setup")')
    ).toBeVisible();

    // Inputs should be disabled during submission
    await expect(page.locator('input[name="first_name"]')).toBeDisabled();
    await expect(page.locator('input[name="last_name"]')).toBeDisabled();
  });

  test("allows removing uploaded photo", async ({ page }) => {
    await page.goto(
      "/onboarding/complete?token=valid-token&email=test@example.com"
    );

    // Upload photo
    const buffer = Buffer.from("fake-image-data");
    await page.setInputFiles('input[type="file"]', {
      name: "profile-photo.jpg",
      mimeType: "image/jpeg",
      buffer: buffer,
    });

    // Verify preview shown
    await expect(page.locator('img[alt="Preview"]')).toBeVisible();

    // Click remove button
    await page.click('button:has-text("Remove")');

    // Preview should be gone
    await expect(page.locator('img[alt="Preview"]')).not.toBeVisible();
  });

  test("validates photo file size (max 2MB)", async ({ page }) => {
    await page.goto(
      "/onboarding/complete?token=valid-token&email=test@example.com"
    );

    // Create a file larger than 2MB (3MB)
    const largeBuffer = Buffer.alloc(3 * 1024 * 1024);
    await page.setInputFiles('input[type="file"]', {
      name: "large-photo.jpg",
      mimeType: "image/jpeg",
      buffer: largeBuffer,
    });

    // Should show error
    await expect(page.locator("text=smaller than 2MB")).toBeVisible();

    // Preview should NOT be shown
    await expect(page.locator('img[alt="Preview"]')).not.toBeVisible();
  });
});
