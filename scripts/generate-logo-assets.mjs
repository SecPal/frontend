// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: MIT

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const publicDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public"
);
const source = readFileSync(join(publicDirectory, "logo-source.svg"), "utf8");
const checkOnly = process.argv.includes("--check");
const outputs = new Map();
const sourceCanvas = 'width="1024" height="1024" viewBox="0 0 1024 1024"';
const copyrightMarker = ["SPDX", "FileCopyrightText"].join("-");
const licenseMarker = ["SPDX", "License", "Identifier"].join("-");

if (!source.includes('class="source"') || !source.includes(sourceCanvas)) {
  throw new Error("The canonical logo SVG has an unexpected structure");
}

function save(name, content) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const path = join(publicDirectory, name);
  if (checkOnly) {
    if (!readFileSync(path).equals(buffer)) {
      throw new Error(`${name} differs from the canonical SVG`);
    }
    return;
  }
  writeFileSync(path, buffer);
  outputs.set(name, buffer.length);
}

function render(svg, width) {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: false },
  }).render();
}

function variantSvg(mode, square = false) {
  const viewBox = square ? "104 104 816 816" : "104 134 816 757";
  const height = square ? 816 : 757;
  let svg = source
    .replace(
      `${copyrightMarker}: 2026 SecPal Contributors`,
      `${copyrightMarker}: 2025-2026 SecPal Contributors`
    )
    .replace('class="source"', `class="${mode}"`)
    .replace(
      sourceCanvas,
      `width="816" height="${height}" viewBox="${viewBox}"`
    );

  if (mode === "light") {
    svg = svg.replace(/  <use class="panel"[^\n]*\n/g, "");
  } else {
    svg = svg.replace(
      '  <use href="#shield" fill="#202124" mask="url(#openings)"/>',
      '  <use href="#shield" fill="none" stroke="#fff" stroke-width="12"/>'
    );
  }
  return svg;
}

function appIconSvg(scale) {
  const extent = 1024 / scale;
  const origin = 512 - extent / 2;
  const square = String(extent);
  const offset = String(origin);
  return source
    .replace(
      sourceCanvas,
      `width="${square}" height="${square}" viewBox="${offset} ${offset} ${square} ${square}"`
    )
    .replace(
      "</defs>",
      `</defs>\n  <rect x="${offset}" y="${offset}" width="${square}" height="${square}" fill="#52525b"/>`
    );
}

function pathData(id) {
  const match = source.match(new RegExp(`<path id="${id}" d="([^"]+)"`));
  if (!match) {
    throw new Error(`Missing ${id} path in the canonical SVG`);
  }
  return match[1];
}

function maskSvg() {
  const shape = ["shield", "upper-opening", "lower-opening", "blue-sweep"]
    .map(pathData)
    .join(" ");
  const scale = 16 / 816;
  const horizontalOffset = -104 * scale;
  const verticalOffset = (16 - 757 * scale) / 2 - 134 * scale;
  return `<!-- ${copyrightMarker}: 2025-2026 SecPal Contributors -->
<!-- ${licenseMarker}: AGPL-3.0-or-later -->
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
  <path fill="#000" fill-rule="evenodd" transform="matrix(${scale} 0 0 ${scale} ${horizontalOffset} ${verticalOffset})" d="${shape}"/>
</svg>
`;
}

function icoEntry(image) {
  const { width, height, pixels } = image;
  if (width !== height) {
    throw new Error("ICO images must be square");
  }
  const maskStride = Math.ceil(width / 32) * 4;
  const bitmap = Buffer.alloc(40 + width * height * 4 + maskStride * height);
  bitmap.writeUInt32LE(40, 0);
  bitmap.writeInt32LE(width, 4);
  bitmap.writeInt32LE(height * 2, 8);
  bitmap.writeUInt16LE(1, 12);
  bitmap.writeUInt16LE(32, 14);
  bitmap.writeUInt32LE(width * height * 4 + maskStride * height, 20);

  for (let row = 0; row < height; row++) {
    const sourceY = height - 1 - row;
    for (let x = 0; x < width; x++) {
      const sourceOffset = (sourceY * width + x) * 4;
      const targetOffset = 40 + (row * width + x) * 4;
      const alpha = pixels[sourceOffset + 3];
      // Resvg exposes premultiplied pixels; ICO stores straight ARGB values.
      const straight = (channel) =>
        alpha === 0
          ? 0
          : Math.min(
              255,
              Math.round((pixels[sourceOffset + channel] * 255) / alpha)
            );
      bitmap[targetOffset] = straight(2);
      bitmap[targetOffset + 1] = straight(1);
      bitmap[targetOffset + 2] = straight(0);
      bitmap[targetOffset + 3] = alpha;
      if (alpha < 128) {
        const maskOffset =
          40 + width * height * 4 + row * maskStride + (x >> 3);
        bitmap[maskOffset] |= 0x80 >> (x & 7);
      }
    }
  }
  return bitmap;
}

function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = images.map(icoEntry);
  let offset = header.length;
  entries.forEach((entry, index) => {
    const position = 6 + index * 16;
    header[position] = images[index].width;
    header[position + 1] = images[index].height;
    header.writeUInt16LE(1, position + 4);
    header.writeUInt16LE(32, position + 6);
    header.writeUInt32LE(entry.length, position + 8);
    header.writeUInt32LE(offset, position + 12);
    offset += entry.length;
  });
  return Buffer.concat([header, ...entries]);
}

save("logo-source.png", render(source, 1024).asPng());
save("mask-icon.svg", maskSvg());
save(
  "pwa-badge-96x96.png",
  render(
    maskSvg().replace(
      'width="16" height="16" viewBox="0 0 16 16"',
      'width="20" height="20" viewBox="-2 -2 20 20"'
    ),
    96
  ).asPng()
);

for (const mode of ["light", "dark"]) {
  const logoSvg = variantSvg(mode);
  save(`logo-${mode}.svg`, logoSvg);

  for (const size of [16, 32, 48, 64, 128, 256, 512]) {
    const svg = size <= 32 ? variantSvg(mode, true) : logoSvg;
    save(`logo-${mode}-${size}.png`, render(svg, size).asPng());
  }

  const iconSizes = [16, 32, 48];
  const iconImages = iconSizes.map((size) =>
    render(variantSvg(mode, true), size)
  );
  save(`favicon-${mode}.ico`, ico(iconImages));
  if (mode === "light") {
    for (const [index, size] of iconSizes.entries()) {
      if (size <= 32) {
        save(`favicon-${size}x${size}.png`, iconImages[index].asPng());
      }
    }
  }
}

for (const size of [192, 512]) {
  save(`pwa-${size}x${size}.png`, render(appIconSvg(1), size).asPng());
  save(
    `pwa-${size}x${size}-maskable.png`,
    render(appIconSvg(0.75), size).asPng()
  );
}
save("apple-touch-icon.png", render(appIconSvg(1), 180).asPng());

console.log(
  checkOnly
    ? "All logo assets match the canonical SVG."
    : `Generated ${outputs.size} logo assets from logo-source.svg.`
);
