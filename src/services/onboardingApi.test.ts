// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as csrf from "./csrf";
import { uploadOnboardingFile } from "./onboardingApi";

vi.mock("./csrf");

describe("uploadOnboardingFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(csrf.apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: { id: "file-1", filename: "contract.pdf" },
      }),
    } as unknown as Response);
  });

  it("reuses a stable idempotency key when the same selected file is retried", async () => {
    const firstFile = new File(["contract"], "contract.pdf", {
      type: "application/pdf",
    });
    const secondFile = new File(["different"], "contract.pdf", {
      type: "application/pdf",
    });

    await uploadOnboardingFile("submission-1", firstFile, "contract");
    await uploadOnboardingFile("submission-1", firstFile, "contract");
    await uploadOnboardingFile("submission-1", secondFile, "contract");
    await uploadOnboardingFile("submission-1", firstFile, "banking_details");

    const formData = vi.mocked(csrf.apiFetch).mock.calls.map(([, options]) => {
      expect(options?.body).toBeInstanceOf(FormData);
      return options?.body as FormData;
    });
    const firstKey = formData[0]!.get("idempotency_key");
    const retryKey = formData[1]!.get("idempotency_key");
    const secondKey = formData[2]!.get("idempotency_key");
    const differentOperationKey = formData[3]!.get("idempotency_key");

    expect(firstKey).toEqual(expect.any(String));
    expect(String(firstKey)).toMatch(/^[A-Za-z0-9_-]{32,64}$/);
    expect(retryKey).toBe(firstKey);
    expect(secondKey).not.toBe(firstKey);
    expect(differentOperationKey).not.toBe(firstKey);
  });
});
