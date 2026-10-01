// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { describe, expect, it } from "vitest";

const publicPath = (name: string) => join(process.cwd(), "public", name);

function pngSize(name: string): [number, number] {
  const png = readFileSync(publicPath(name));
  expect(png.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  );
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

function alphaAt(pixels: Buffer, width: number, x: number, y: number): number {
  return pixels[(y * width + x) * 4 + 3];
}

describe("SecPal logo assets", () => {
  it("keeps the canonical SVG independent of stylesheets", () => {
    const svg = readFileSync(publicPath("logo-source.svg"), "utf8");
    expect(svg).not.toContain("<style");
    expect(svg).not.toContain("<image");
  });

  it("keeps both mode SVGs self-contained and aligned", () => {
    for (const mode of ["light", "dark"]) {
      const svg = readFileSync(publicPath(`logo-${mode}.svg`), "utf8");
      expect(svg).toContain('<path id="shield"');
      expect(svg).not.toContain("<image");
      expect(svg).not.toContain("<style");
      const rendered = new Resvg(svg).render();
      expect([rendered.width, rendered.height]).toEqual([816, 757]);
      expect(alphaAt(rendered.pixels, rendered.width, 408, 166)).toBe(
        mode === "dark" ? 255 : 0
      );
      expect(alphaAt(rendered.pixels, rendered.width, 408, 366)).toBe(
        mode === "dark" ? 0 : 255
      );
    }
  });

  it("keeps the shield detail visible in the monochrome Safari mask", () => {
    const svg = readFileSync(publicPath("mask-icon.svg"), "utf8");
    const rendered = new Resvg(svg, {
      fitTo: { mode: "width", value: 160 },
    }).render();
    expect([rendered.width, rendered.height]).toEqual([160, 160]);
    expect(alphaAt(rendered.pixels, 160, 80, 38)).toBe(0);
    expect(alphaAt(rendered.pixels, 160, 80, 76)).toBe(255);
    expect(alphaAt(rendered.pixels, 160, 39, 87)).toBe(255);
    expect(alphaAt(rendered.pixels, 160, 110, 100)).toBe(0);
  });

  it("provides square favicon files matching their advertised sizes", () => {
    for (const size of [16, 32]) {
      expect(pngSize(`favicon-${size}x${size}.png`)).toEqual([size, size]);
      expect(pngSize(`logo-dark-${size}.png`)).toEqual([size, size]);
    }

    for (const mode of ["light", "dark"]) {
      const ico = readFileSync(publicPath(`favicon-${mode}.ico`));
      expect(ico.readUInt16LE(4)).toBe(3);
      for (const [index, size] of [16, 32, 48].entries()) {
        expect([ico[6 + index * 16], ico[7 + index * 16]]).toEqual([
          size,
          size,
        ]);
      }
    }
  });

  it("provides a dedicated notification badge", () => {
    expect(pngSize("pwa-badge-96x96.png")).toEqual([96, 96]);
  });

  it("keeps antialiased ICO edge colors independent of alpha", () => {
    const ico = readFileSync(publicPath("favicon-light.ico"));
    const firstImageOffset = ico.readUInt32LE(18);
    const topEdgePixelOffset = firstImageOffset + 40 + (15 * 16 + 6) * 4;
    const alpha = ico[topEdgePixelOffset + 3];
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(255);
    expect(ico[topEdgePixelOffset + 2]).toBeGreaterThan(30);
  });

  it("keeps every exported image in sync with the vector source", () => {
    expect(() =>
      execFileSync(
        process.execPath,
        [join(process.cwd(), "scripts", "generate-logo-assets.mjs"), "--check"],
        { stdio: "pipe" }
      )
    ).not.toThrow();
  });
});
