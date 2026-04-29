// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./ApiError";
import { updateOrganizationalScope } from "./organizationalScopeApi";

vi.mock("./csrf", () => ({
    apiFetch: vi.fn(),
}));

import { apiFetch } from "./csrf";

const mockApiFetch = vi.mocked(apiFetch);

describe("organizationalScopeApi", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("forwards authorization messages from organizational scope updates", async () => {
        mockApiFetch.mockResolvedValue({
            ok: false,
            status: 403,
            json: async () => ({
                message:
                    "You cannot remove your own last scope-management access for this organizational unit.",
            }),
        } as Response);

        await expect(
            updateOrganizationalScope("unit-1", "scope-1", {
                access_level: "manage",
            })
        ).rejects.toMatchObject({
            name: "ApiError",
            message:
                "You cannot remove your own last scope-management access for this organizational unit.",
            statusCode: 403,
        } satisfies Partial<ApiError>);
    });
});
