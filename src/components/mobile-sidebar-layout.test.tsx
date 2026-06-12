// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as deMessages } from "../locales/de/messages.mjs";
import { SidebarLayout } from "./sidebar-layout";
import { StackedLayout } from "./stacked-layout";

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  act(() => {
    i18n.load("de", deMessages);
    i18n.activate("de");
  });
});

afterEach(() => {
  act(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });
});

describe("mobile sidebar layouts", () => {
  it.each([
    ["SidebarLayout", SidebarLayout],
    ["StackedLayout", StackedLayout],
  ])(
    "localizes mobile navigation accessibility copy in %s",
    async (_, Layout) => {
      const user = userEvent.setup();

      render(
        <I18nProvider i18n={i18n}>
          <Layout navbar={<div>Navbar</div>} sidebar={<div>Sidebar</div>}>
            <div>Content</div>
          </Layout>
        </I18nProvider>
      );

      await user.click(screen.getByRole("button", { name: "Open navigation" }));

      expect(
        await screen.findByRole("dialog", { name: "Navigationsmenü" })
      ).toBeInTheDocument();
      expect(
        screen.getByText("Hauptnavigation der Anwendung")
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Navigation schließen" })
      ).toBeInTheDocument();
    }
  );
});
