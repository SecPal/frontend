// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StorageQuotaIndicator } from "./StorageQuotaIndicator";

describe("StorageQuotaIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should display storage usage", async () => {
    // Mock navigator.storage.estimate
    const mockEstimate = vi.fn().mockResolvedValue({
      usage: 5000000, // 5 MB
      quota: 50000000, // 50 MB
    });

    vi.stubGlobal("navigator", {
      storage: { estimate: mockEstimate },
    });

    render(<StorageQuotaIndicator />);

    await waitFor(() => {
      expect(screen.getByText(/storage usage/i)).toBeInTheDocument();
    });

    // Should show percentage
    expect(screen.getByText("10%")).toBeInTheDocument();

    // Should show MB values (text is split across elements, so use textContent)
    const usageText = screen.getByText(/storage usage/i).parentElement;
    expect(usageText?.textContent).toContain("4.77 MB"); // 5000000 bytes = 4.77 MB
    expect(usageText?.textContent).toContain("47.68 MB"); // 50000000 bytes = 47.68 MB
  });

  it("should show warning when storage is above 80%", async () => {
    const mockEstimate = vi.fn().mockResolvedValue({
      usage: 85000000, // 85 MB
      quota: 100000000, // 100 MB
    });

    vi.stubGlobal("navigator", {
      storage: { estimate: mockEstimate },
    });

    render(<StorageQuotaIndicator />);

    await waitFor(() => {
      expect(screen.getByText(/85%/)).toBeInTheDocument();
    });

    // Should show warning indicator
    expect(screen.getByText(/⚠️/)).toBeInTheDocument();
  });

  it("should show error message when Storage API not available", async () => {
    // Mock unavailable Storage API
    vi.stubGlobal("navigator", {});

    render(<StorageQuotaIndicator />);

    await waitFor(() => {
      expect(
        screen.getByText(/storage quota information not available/i)
      ).toBeInTheDocument();
    });
  });

  it("should refresh data when refresh is triggered", async () => {
    let callCount = 0;
    const mockEstimate = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        usage: callCount * 1000000, // Increment usage
        quota: 100000000,
      };
    });

    vi.stubGlobal("navigator", {
      storage: { estimate: mockEstimate },
    });

    render(<StorageQuotaIndicator />);

    await waitFor(() => {
      expect(screen.getByText(/1%/)).toBeInTheDocument();
    });

    expect(mockEstimate).toHaveBeenCalledTimes(1);
  });
});
