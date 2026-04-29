// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./ApiError";
import {
    createOrganizationalScope,
    deleteOrganizationalScope,
    getMyOrganizationalScopes,
    listOrganizationalScopes,
    updateOrganizationalScope,
} from "./organizationalScopeApi";

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

    it("throws ApiError with status code on scope list failure", async () => {
        mockApiFetch.mockResolvedValue({
            ok: false,
            status: 403,
            json: async () => ({ message: "Forbidden" }),
        } as Response);

        await expect(listOrganizationalScopes("unit-1")).rejects.toMatchObject({
            name: "ApiError",
            message: "Forbidden",
            statusCode: 403,
        } satisfies Partial<ApiError>);
    });

    it("throws ApiError with status code on scope create failure", async () => {
        mockApiFetch.mockResolvedValue({
            ok: false,
            status: 422,
            json: async () => ({ message: "Unprocessable Entity" }),
        } as Response);

        await expect(
            createOrganizationalScope("unit-1", {
                user_id: "user-1",
                organizational_unit_id: "unit-1",
                access_level: "read",
            })
        ).rejects.toMatchObject({
            name: "ApiError",
            statusCode: 422,
        } satisfies Partial<ApiError>);
    });

    it("throws ApiError with status code on scope delete failure", async () => {
        mockApiFetch.mockResolvedValue({
            ok: false,
            status: 404,
            json: async () => ({ message: "Not Found" }),
        } as Response);

        await expect(
            deleteOrganizationalScope("unit-1", "scope-1")
        ).rejects.toMatchObject({
            name: "ApiError",
            statusCode: 404,
        } satisfies Partial<ApiError>);
    });

    it("throws ApiError with status code on my-scopes fetch failure", async () => {
        mockApiFetch.mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ message: "Unauthenticated" }),
        } as Response);

        await expect(getMyOrganizationalScopes()).rejects.toMatchObject({
            name: "ApiError",
            statusCode: 401,
        } satisfies Partial<ApiError>);
    });

    it("falls back to built-in message when response body cannot be parsed", async () => {
        mockApiFetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => {
                throw new Error("invalid json");
            },
        } as unknown as Response);

        await expect(
            updateOrganizationalScope("unit-1", "scope-1", { access_level: "read" })
        ).rejects.toMatchObject({
            name: "ApiError",
            message: "Failed to update organizational scope",
            statusCode: 500,
        } satisfies Partial<ApiError>);
    });
});
