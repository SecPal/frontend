// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installSystemColorSchemeSync,
  syncSystemColorScheme,
} from "./lib/systemColorScheme";

function createMatchMediaStub(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: (
      _event: string,
      listener: EventListenerOrEventListenerObject
    ) => {
      if (typeof listener === "function") {
        listeners.add(listener as (event: MediaQueryListEvent) => void);
      }
    },
    removeEventListener: (
      _event: string,
      listener: EventListenerOrEventListenerObject
    ) => {
      if (typeof listener === "function") {
        listeners.delete(listener as (event: MediaQueryListEvent) => void);
      }
    },
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  return {
    matchMedia: vi.fn<(query: string) => MediaQueryList>(() => mediaQueryList),
    listenerCount() {
      return listeners.size;
    },
    emit(nextMatches: boolean) {
      matches = nextMatches;
      const event = { matches: nextMatches } as MediaQueryListEvent;
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

describe("system color scheme sync", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
  });

  it("applies the dark class and color-scheme when the system prefers dark mode", () => {
    const matchMediaStub = createMatchMediaStub(true);
    const cleanup = installSystemColorSchemeSync({
      document: window.document,
      matchMedia: matchMediaStub.matchMedia,
    });

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");

    cleanup();
  });

  it("updates the root class when the system color scheme changes", () => {
    const matchMediaStub = createMatchMediaStub(false);
    const cleanup = installSystemColorSchemeSync({
      document: window.document,
      matchMedia: matchMediaStub.matchMedia,
    });

    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");

    matchMediaStub.emit(true);
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");

    matchMediaStub.emit(false);
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");

    cleanup();
  });

  it("can apply the current system preference without registering a long-lived listener", () => {
    const matchMediaStub = createMatchMediaStub(true);

    syncSystemColorScheme({
      document: window.document,
      matchMedia: matchMediaStub.matchMedia,
    });

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(matchMediaStub.listenerCount()).toBe(0);
  });
});
