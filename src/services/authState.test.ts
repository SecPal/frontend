// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { sanitizeAuthUser } from "./authState";

describe("authState", () => {
  it("keeps employee data in ephemeral auth state by default", () => {
    const sanitizedUser = sanitizeAuthUser({
      id: 1,
      name: "Test User",
      email: "test@secpal.app",
      employee: {
        management_level: 7,
      },
    });

    expect(sanitizedUser).toEqual({
      id: 1,
      name: "Test User",
      email: "test@secpal.app",
      employee: {
        management_level: 7,
      },
    });
  });

  it("drops employee data when building persisted auth state", () => {
    const sanitizedUser = sanitizeAuthUser(
      {
        id: 1,
        name: "Test User",
        email: "test@secpal.app",
        employee: {
          management_level: 7,
          personnel_number: "EMP-12345",
        },
      },
      {
        includeEmployee: false,
      }
    );

    expect(sanitizedUser).toEqual({
      id: 1,
      name: "Test User",
      email: "test@secpal.app",
    });
    expect(sanitizedUser).not.toHaveProperty("employee");
  });
});
