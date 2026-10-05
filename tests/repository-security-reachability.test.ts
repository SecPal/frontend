// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFileSync } from "node:child_process";
import { once } from "node:events";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const require = createRequire(path.join(repoRoot, "package.json"));

function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function staticCopySources(): string[] {
  const file = ts.createSourceFile(
    "vite.config.ts",
    source("vite.config.ts"),
    ts.ScriptTarget.Latest,
    true
  );
  const paths: string[] = [];
  let calls = 0;
  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "viteStaticCopy"
    ) {
      calls++;
      const options = node.arguments[0];
      expect(options && ts.isObjectLiteralExpression(options)).toBe(true);
      const targets = (options as ts.ObjectLiteralExpression).properties.find(
        (property) => property.name?.getText(file) === "targets"
      );
      expect(
        targets &&
          ts.isPropertyAssignment(targets) &&
          ts.isArrayLiteralExpression(targets.initializer)
      ).toBe(true);
      for (const target of (
        (targets as ts.PropertyAssignment)
          .initializer as ts.ArrayLiteralExpression
      ).elements) {
        expect(ts.isObjectLiteralExpression(target)).toBe(true);
        const src = (target as ts.ObjectLiteralExpression).properties.find(
          (property) => property.name?.getText(file) === "src"
        );
        expect(
          src &&
            ts.isPropertyAssignment(src) &&
            ts.isStringLiteral(src.initializer)
        ).toBe(true);
        paths.push(
          ((src as ts.PropertyAssignment).initializer as ts.StringLiteral).text
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  expect(calls).toBe(1);
  return paths;
}

describe("reviewed frontend braces reachability boundaries", () => {
  it("keeps braces out of the production dependency and browser import closures", () => {
    const lock = JSON.parse(source("package-lock.json")) as {
      packages: Record<string, { dev?: boolean }>;
    };
    const braces = Object.entries(lock.packages).filter(([name]) =>
      name.endsWith("node_modules/braces")
    );
    for (const [, dependency] of braces) expect(dependency.dev).toBe(true);
    const production = JSON.parse(
      execFileSync("npm", ["ls", "--omit=dev", "--all", "--json"], {
        cwd: repoRoot,
        encoding: "utf8",
      })
    ) as { dependencies?: Record<string, unknown> };
    function checkDependencies(
      dependencies: Record<string, unknown> = {}
    ): void {
      expect(dependencies).not.toHaveProperty("braces");
      for (const dependency of Object.values(dependencies)) {
        checkDependencies(
          (dependency as { dependencies?: Record<string, unknown> })
            .dependencies
        );
      }
    }
    checkDependencies(production.dependencies);
    const files = execFileSync(
      "git",
      ["ls-files", "--", "src/**/*.ts", "src/**/*.tsx"],
      { cwd: repoRoot, encoding: "utf8" }
    )
      .trim()
      .split("\n")
      .filter(
        (name) => !name.endsWith(".test.ts") && !name.endsWith(".test.tsx")
      );
    for (const filename of files) {
      const file = ts.createSourceFile(
        filename,
        source(filename),
        ts.ScriptTarget.Latest,
        true
      );
      function visit(node: ts.Node): void {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
          if (
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
          ) {
            expect(node.moduleSpecifier.text, filename).not.toMatch(
              /^(?:braces|micromatch|chokidar|vite-plugin-static-copy|@lingui\/cli)(?:\/|$)/u
            );
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(file);
    }
  });

  it("keeps Lingui and static-copy pattern inputs repository-owned literals", () => {
    const config = require("./lingui.config.cjs") as {
      catalogs: unknown;
      locales: string[];
    };
    expect(config.locales).toEqual(["en", "de"]);
    expect(config.catalogs).toEqual([
      {
        path: "src/locales/{locale}/messages",
        include: ["src"],
        exclude: ["**/*.d.ts"],
      },
    ]);
    expect(staticCopySources()).toEqual([
      "config/assetlinks.json",
      "config/assetlinks.json",
      "THIRD-PARTY-NOTICES.md",
      "LICENSES/MIT.txt",
    ]);
  });

  it("does not promote filenames into vulnerable brace patterns in either dev-tool use", async () => {
    const braces = require("braces") as {
      expand: (pattern: string) => string[];
    };
    const expand = vi.spyOn(braces, "expand");
    const micromatch = require("micromatch") as {
      any: (input: string, patterns: string[]) => boolean;
      capture: (pattern: string, input: string) => unknown;
    };
    const fixture = mkdtempSync(
      path.join(tmpdir(), "frontend-braces-reachability-")
    );
    const staticCopyRequire = createRequire(
      require.resolve("vite-plugin-static-copy")
    );
    const chokidar = staticCopyRequire("chokidar") as {
      watch: (
        paths: string[],
        options: { cwd: string }
      ) => import("node:events").EventEmitter & { close: () => Promise<void> };
    };
    const maliciousFilename = "{".repeat(48) + "filename" + "}".repeat(48);
    mkdirSync(path.join(fixture, "config"));
    mkdirSync(path.join(fixture, "LICENSES"));
    for (const target of new Set(staticCopySources()))
      writeFileSync(path.join(fixture, target), "fixture");
    writeFileSync(
      path.join(fixture, "config", maliciousFilename),
      "filename is data"
    );
    const watcher = chokidar.watch(staticCopySources(), { cwd: fixture });
    try {
      await once(watcher, "ready");
      expect(micromatch.any(`src/${maliciousFilename}.ts`, ["**/*.d.ts"])).toBe(
        false
      );
      expect(
        micromatch.capture(
          "src/locales/*/messages.po",
          `src/locales/${maliciousFilename}/messages.po`
        )
      ).toEqual([maliciousFilename]);
      expect(expand).not.toHaveBeenCalled();
    } finally {
      await watcher.close();
      expand.mockRestore();
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
