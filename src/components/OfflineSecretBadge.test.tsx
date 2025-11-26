// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OfflineSecretBadge } from "./OfflineSecretBadge";

describe("OfflineSecretBadge", () => {
  it("should render offline-only badge", () => {
    render(<OfflineSecretBadge isOfflineOnly />);
    expect(screen.getByText("Offline only")).toBeInTheDocument();
  });

  it("should render pending changes badge", () => {
    render(<OfflineSecretBadge hasPendingChanges />);
    expect(screen.getByText("Pending sync")).toBeInTheDocument();
  });

  it("should render nothing when no flags set", () => {
    const { container } = render(<OfflineSecretBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("should prioritize offline-only over pending changes", () => {
    render(<OfflineSecretBadge isOfflineOnly hasPendingChanges />);
    expect(screen.getByText("Offline only")).toBeInTheDocument();
    expect(screen.queryByText("Pending sync")).not.toBeInTheDocument();
  });
});
