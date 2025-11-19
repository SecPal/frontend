// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { EncryptionProgress } from "./EncryptionProgress";

describe("EncryptionProgress Component", () => {
  beforeEach(() => {
    // Setup i18n
    i18n.load("en", {});
    i18n.activate("en");
  });

  const renderWithI18n = (component: React.ReactElement) => {
    return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
  };

  it("should not render when not encrypting and no progress", () => {
    const { container } = renderWithI18n(
      <EncryptionProgress progress={new Map()} isEncrypting={false} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("should render when encrypting", () => {
    const progress = new Map([["test.pdf", 50]]);

    renderWithI18n(
      <EncryptionProgress progress={progress} isEncrypting={true} />
    );

    expect(screen.getByText(/Encrypting files/i)).toBeInTheDocument();
    expect(screen.getByText(/test\.pdf/)).toBeInTheDocument();
  });

  it("should show progress for multiple files", () => {
    const progress = new Map([
      ["file1.pdf", 25],
      ["file2.jpg", 75],
      ["file3.doc", 100],
    ]);

    renderWithI18n(
      <EncryptionProgress progress={progress} isEncrypting={true} />
    );

    expect(screen.getByText(/file1\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/file2\.jpg/)).toBeInTheDocument();
    expect(screen.getByText(/file3\.doc/)).toBeInTheDocument();
  });

  it("should display correct progress percentages", () => {
    const progress = new Map([
      ["test.pdf", 0],
      ["document.doc", 50],
      ["image.jpg", 100],
    ]);

    renderWithI18n(
      <EncryptionProgress progress={progress} isEncrypting={true} />
    );

    // Check for progress bars
    const progressBars = screen.getAllByRole("progressbar");
    expect(progressBars).toHaveLength(3);

    // Verify aria-valuenow attributes
    expect(progressBars[0]).toHaveAttribute("aria-valuenow", "0");
    expect(progressBars[1]).toHaveAttribute("aria-valuenow", "50");
    expect(progressBars[2]).toHaveAttribute("aria-valuenow", "100");
  });

  it("should have proper ARIA labels", () => {
    const progress = new Map([["test.pdf", 50]]);

    renderWithI18n(
      <EncryptionProgress progress={progress} isEncrypting={true} />
    );

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-label", "Encryption progress");
    expect(progressBar).toHaveAttribute("aria-valuemin", "0");
    expect(progressBar).toHaveAttribute("aria-valuemax", "100");
  });

  it("should handle empty progress map while encrypting", () => {
    renderWithI18n(
      <EncryptionProgress progress={new Map()} isEncrypting={true} />
    );

    // Should still render the container
    expect(screen.getByText(/Encrypting files/i)).toBeInTheDocument();
  });

  it("should show progress even when not currently encrypting if there is progress data", () => {
    const progress = new Map([["test.pdf", 100]]);

    renderWithI18n(
      <EncryptionProgress progress={progress} isEncrypting={false} />
    );

    // Should render because progress.size > 0
    expect(screen.getByText(/test\.pdf/)).toBeInTheDocument();
  });

  it("should render progress bars with correct widths", () => {
    const progress = new Map([
      ["file1.pdf", 30],
      ["file2.jpg", 70],
    ]);

    renderWithI18n(
      <EncryptionProgress progress={progress} isEncrypting={true} />
    );

    const progressBars = screen.getAllByRole("progressbar");

    // Check inline styles for width
    expect(progressBars[0]).toHaveStyle({ width: "30%" });
    expect(progressBars[1]).toHaveStyle({ width: "70%" });
  });
});
