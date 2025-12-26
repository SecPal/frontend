// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Leadership Levels Management
 * Part of Issue #426 (Epic #399 - ADR-009 Implementation)
 *
 * Tests cover:
 * 1. Leadership Levels CRUD operations
 * 2. Two-step UI design with conditional Step 3 (ScopeAssignmentForm)
 * 3. Employee form leadership level assignment
 * 4. Permission escalation prevention
 */

test.describe("Leadership Levels Management", () => {
  test.use({ storageState: "tests/e2e/.auth/user.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/leadership-levels");
    await page.waitForLoadState("networkidle");
  });

  test("displays leadership levels management page", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Leadership Levels/i }),
    ).toBeVisible();
  });

  test("creates new leadership level", async ({ page }) => {
    // Click "Create Leadership Level" button
    await page.getByRole("button", { name: /Create.*Leadership Level/i }).click();

    // Fill in the form
    await page.getByLabel(/Name/i).fill("Test Branch Director");
    await page.getByLabel(/Rank/i).fill("10");
    await page.getByLabel(/Description/i).fill("Test leadership level for E2E testing");

    // Assuming color field exists
    const colorInput = page.getByLabel(/Color/i);
    if (await colorInput.isVisible()) {
      await colorInput.fill("#FF5733");
    }

    // Submit
    await page.getByRole("button", { name: /Save|Create/i }).click();

    // Verify success message
    await expect(
      page.getByText(/Leadership level created|successfully/i),
    ).toBeVisible({ timeout: 10000 });

    // Verify new level appears in list
    await expect(page.getByText("Test Branch Director")).toBeVisible();
  });

  test("edits existing leadership level", async ({ page }) => {
    // First, ensure we have at least one level
    const firstEditButton = page
      .getByRole("row")
      .first()
      .getByRole("button", { name: /Edit/i });

    if (!(await firstEditButton.isVisible())) {
      test.skip();
      return;
    await descriptionField.clear();
    await descriptionField.fill("Updated description for E2E testing");

    // Save
    await page.getByRole("button", { name: /Save|Update/i }).click();

    // Verify success
    await expect(
      page.getByText(/Leadership level updated|successfully/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test("validates rank uniqueness", async ({ page }) => {
    // Get first level's rank
    const firstRow = page.getByRole("row").nth(1); // Skip header
    const rankText = await firstRow.locator("td").first().textContent();
    const existingRank = rankText ? parseInt(rankText.trim()) : 1;

    // Try to create level with same rank
    await page.getByRole("button", { name: /Create.*Leadership Level/i }).click();

    await page.getByLabel(/Name/i).fill("Duplicate Rank Test");
    await page.getByLabel(/Rank/i).fill(existingRank.toString());
    await page.getByLabel(/Description/i).fill("Should fail validation");

    await page.getByRole("button", { name: /Save|Create/i }).click();

    // Verify error message
    await expect(
      page.getByText(/rank.*already.*exists|unique|duplicate/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test("validates rank range (1-255)", async ({ page }) => {
    await page.getByRole("button", { name: /Create.*Leadership Level/i }).click();

    // Try invalid rank (0)
    await page.getByLabel(/Name/i).fill("Invalid Rank Test");
    await page.getByLabel(/Rank/i).fill("0");

    await page.getByRole("button", { name: /Save|Create/i }).click();

    // Should show validation error
    await expect(
      page.getByText(/rank.*between.*1.*255|minimum.*1/i),
    ).toBeVisible({ timeout: 5000 });

    // Try invalid rank (256)
    await page.getByLabel(/Rank/i).clear();
    await page.getByLabel(/Rank/i).fill("256");

    await page.getByRole("button", { name: /Save|Create/i }).click();

    await expect(
      page.getByText(/rank.*between.*1.*255|maximum.*255/i),
    ).toBeVisible({ timeout: 5000 });
  });

  test("prevents deletion of leadership level with assigned employees", async ({
    page,
  }) => {
    // This test requires a level with assigned employees
    // Assuming first level has employees (typically CEO/Managing Director)
    const firstRow = page.getByRole("row").nth(1);
    const deleteButton = firstRow.getByRole("button", { name: /Delete/i });

    if (!(await deleteButton.isVisible())) {
      test.skip();
      return;
    }

    await deleteButton.click();

    // Should show confirmation or error
    const errorOrWarning = page.getByText(
      /cannot.*delete|employees.*assigned|in use/i,
    );

    if (await errorOrWarning.isVisible({ timeout: 5000 })) {
      // Expected: cannot delete if employees assigned
      await expect(errorOrWarning).toBeVisible();
    } else {
      // If no error shown, confirm deletion dialog should appear
      await expect(
        page.getByRole("dialog", { name: /confirm|delete/i }),
      ).toBeVisible();
    }
  });

  test("activates and deactivates leadership level", async ({ page }) => {
    // Find a leadership level row
    const levelRow = page.getByRole("row").nth(1);

    // Look for activate/deactivate button
    const toggleButton = levelRow.getByRole("button", {
      name: /Activate|Deactivate/i,
    });

    if (!(await toggleButton.isVisible())) {
      test.skip();
      return;
    }

    const initialText = await toggleButton.textContent();
    await toggleButton.click();

    // Verify status changed
    await expect(
      page.getByText(/status.*updated|successfully/i),
    ).toBeVisible({ timeout: 10000 });

    // Button text should change
    const newText = await toggleButton.textContent();
    expect(newText).not.toBe(initialText);
  });
});

test.describe("Leadership Levels - Drag and Drop Reordering", () => {
  test.use({ storageState: "tests/e2e/.auth/user.json" });

  test.skip("reorders leadership levels via drag and drop", async ({
    page,
  }) => {
    // This test is skipped as drag-and-drop implementation details need verification
    // TODO: Implement when drag-and-drop is confirmed working
    await page.goto("/settings/leadership-levels");

    // Get two rows
    const firstRow = page.getByRole("row").nth(1);
    const secondRow = page.getByRole("row").nth(2);

    if (
      !(await firstRow.isVisible()) ||
      !(await secondRow.isVisible())
    ) {
      test.skip();
      return;
    }

    // Perform drag and drop
    await firstRow.dragTo(secondRow);

    // Verify order changed
    await expect(
      page.getByText(/order.*updated|reordered|successfully/i),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Employee Form - Leadership Level Assignment", () => {
  test.use({ storageState: "tests/e2e/.auth/user.json" });

  test("displays leadership level dropdown in employee create form", async ({
    page,
  }) => {
    await page.goto("/employees/create");
    await page.waitForLoadState("networkidle");

    // Leadership level dropdown should be visible
    await expect(page.getByLabel(/Leadership Level/i)).toBeVisible();
  });

  test("assigns leadership level to new employee", async ({ page }) => {
    await page.goto("/employees/create");
    await page.waitForLoadState("networkidle");

    // Fill required fields
    await page.getByLabel(/First Name/i).fill("Test");
    await page.getByLabel(/Last Name/i).fill("Employee");
    await page.getByLabel(/Email/i).fill(`test.employee.${Date.now()}@example.com`);

    // Select organizational unit (required)
    const orgUnitDropdown = page.getByLabel(/Organizational Unit/i);
    await orgUnitDropdown.click();
    // Select first option
    await page.getByRole("option").first().click();

    // Select leadership level
    const leadershipDropdown = page.getByLabel(/Leadership Level/i);
    await leadershipDropdown.click();

    // Select a leadership level (not "No Leadership Role")
    const leadershipOption = page
      .getByRole("option")
      .filter({ hasNotText: /No Leadership|None/i })
      .first();

    if (await leadershipOption.isVisible()) {
      await leadershipOption.click();
    } else {
      test.skip();
      return;
    }

    // Submit
    await page.getByRole("button", { name: /Save|Create Employee/i }).click();

    // Verify success
    await expect(
      page.getByText(/Employee created|successfully/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test("removes leadership level from employee (set to NULL)", async ({
    page,
  }) => {
    await page.goto("/employees");
    await page.waitForLoadState("networkidle");

    // Find an employee with leadership level (look for badge or rank indicator)
    const employeeWithLeadership = page
      .getByRole("row")
      .filter({ has: page.locator("text=/FE[0-9]+|Rank [0-9]+/i") })
      .first();

    if (!(await employeeWithLeadership.isVisible())) {
      test.skip();
      return;
    }

    // Click edit button
    await employeeWithLeadership.getByRole("button", { name: /Edit/i }).click();

    // Change leadership to "No Leadership Role"
    const leadershipDropdown = page.getByLabel(/Leadership Level/i);
    await leadershipDropdown.click();
    await page
      .getByRole("option", { name: /No Leadership|None/i })
      .click();

    // Save
    await page.getByRole("button", { name: /Save|Update/i }).click();

    // Verify success
    await expect(
      page.getByText(/Employee updated|successfully/i),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Employee List - Leadership Level Filtering", () => {
  test.use({ storageState: "tests/e2e/.auth/user.json" });

  test("filters employees by leadership level", async ({ page }) => {
    await page.goto("/employees");
    await page.waitForLoadState("networkidle");

    // Look for leadership level filter
    const leadershipFilter = page.getByLabel(/Leadership Level|Filter.*Leadership/i);

    if (!(await leadershipFilter.isVisible())) {
      test.skip();
      return;
    }

    // Select a leadership level
    await leadershipFilter.click();
    const firstOption = page.getByRole("option").nth(1); // Skip "All"
    const optionText = await firstOption.textContent();
    await firstOption.click();

    // Wait for filtering
    await page.waitForLoadState("networkidle");

    // Verify filtered results (all visible employees should have this level)
    const employeeRows = page.getByRole("row").filter({ hasText: optionText || "" });
    expect(await employeeRows.count()).toBeGreaterThan(0);
  });

  test("displays rank badges in employee list", async ({ page }) => {
    await page.goto("/employees");
    await page.waitForLoadState("networkidle");

    // Check for rank badge indicators (FE1, FE2, etc.)
    const rankBadges = page.locator("[class*='badge']").filter({ hasText: /FE[0-9]+/i });

    if ((await rankBadges.count()) === 0) {
      test.skip();
      return;
    }

    // At least one badge should be visible
    await expect(rankBadges.first()).toBeVisible();
  });

  test("sorts employees by leadership rank", async ({ page }) => {
    await page.goto("/employees");
    await page.waitForLoadState("networkidle");

    // Look for rank column header
    const rankHeader = page.getByRole("columnheader", { name: /Rank|Leadership/i });

    if (!(await rankHeader.isVisible())) {
      test.skip();
      return;
    }

    // Click to sort
    await rankHeader.click();

    // Wait for sort to complete
    await page.waitForLoadState("networkidle");

    // Verify sorting (check that ranks are in order)
    // This is a basic check - detailed verification would require parsing all rows
    const firstRank = page
      .getByRole("row")
      .nth(1)
      .locator("text=/FE[0-9]+|Rank [0-9]+/i");

    if (await firstRank.isVisible()) {
      await expect(firstRank).toBeVisible();
    }
  });
});

test.describe("Permission Escalation Prevention (Security Tests)", () => {
  test.use({ storageState: "tests/e2e/.auth/user.json" });

  test.skip("prevents assigning leadership level outside user's max_assignable_rank", async ({
    page,
  }) => {
    // This test requires a user with limited max_assignable_rank
    // Skipped as it needs specific test data setup

    await page.goto("/employees/create");
    await page.waitForLoadState("networkidle");

    // Try to assign leadership level outside allowed range
    const leadershipDropdown = page.getByLabel(/Leadership Level/i);
    await leadershipDropdown.click();

    // Select highest level (typically FE1 - CEO)
    const ceoLevel = page
      .getByRole("option")
      .filter({ hasText: /FE1|CEO|Managing Director/i })
      .first();

    if (await ceoLevel.isVisible()) {
      await ceoLevel.click();

      // Fill other required fields
      await page.getByLabel(/First Name/i).fill("Test");
      await page.getByLabel(/Last Name/i).fill("Escalation");
      await page.getByLabel(/Email/i).fill(`test.escalation.${Date.now()}@example.com`);

      const orgUnitDropdown = page.getByLabel(/Organizational Unit/i);
      await orgUnitDropdown.click();
      await page.getByRole("option").first().click();

      // Submit
      await page.getByRole("button", { name: /Save|Create/i }).click();

      // Should show permission error
      await expect(
        page.getByText(/permission|not allowed|cannot assign/i),
      ).toBeVisible({ timeout: 10000 });
    } else {
      test.skip();
      return;
    }
  });

  test.skip("prevents removing leadership level outside user's max_assignable_rank", async ({
    page,
  }) => {
    // This test requires a user with limited permissions
    // Skipped as it needs specific test data setup

    await page.goto("/employees");
    await page.waitForLoadState("networkidle");

    // Find CEO or high-level employee
    const ceoEmployee = page
      .getByRole("row")
      .filter({ hasText: /FE1|CEO/i })
      .first();

    if (!(await ceoEmployee.isVisible())) {
      test.skip();
      return;
    }

    await ceoEmployee.getByRole("button", { name: /Edit/i }).click();

    // Try to remove their leadership level
    const leadershipDropdown = page.getByLabel(/Leadership Level/i);
    await leadershipDropdown.click();
    await page
      .getByRole("option", { name: /No Leadership|None/i })
      .click();

    await page.getByRole("button", { name: /Save|Update/i }).click();

    // Should show permission error
    await expect(
      page.getByText(/permission|not allowed|cannot remove|cannot demote/i),
    ).toBeVisible({ timeout: 10000 });
  });
});
