// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.join(repoRoot, "src");
const strictCsp =
  "default-src 'self'; base-uri 'self'; connect-src 'self' https:; font-src 'self' data:; form-action 'self'; frame-src 'none'; img-src 'self' data: blob:; manifest-src 'self'; media-src 'self'; object-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self'; style-src-elem 'self'; style-src-attr 'none'; worker-src 'self'";

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function sourceFiles(directory = sourceRoot): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(entryPath);
    }

    return /\.[jt]sx?$/u.test(entry.name) ? [entryPath] : [];
  });
}

function sourceFileFor(filePath: string): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    readFileSync(filePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

function nodeLocation(sourceFile: ts.SourceFile, node: ts.Node): string {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  return `${path.relative(repoRoot, sourceFile.fileName)}:${line + 1}`;
}

describe("shadcn/Base UI and strict CSP architecture", () => {
  it("uses Base UI without Radix, cmdk, Motion, or a second icon system", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const allDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    expect(packageJson.dependencies["@base-ui/react"]).toMatch(/^\^1\./u);
    expect(
      Object.keys(allDependencies).filter((name) =>
        name.startsWith("@radix-ui/")
      )
    ).toEqual([]);
    expect(allDependencies).not.toHaveProperty("cmdk");
    expect(allDependencies).not.toHaveProperty("motion");
    expect(
      Object.keys(allDependencies).filter((name) =>
        /^(?:@heroicons\/|react-icons$|@fortawesome\/|@tabler\/icons)/u.test(
          name
        )
      )
    ).toEqual([]);
  });

  it("pins the official shadcn Base UI style and Lucide contract", () => {
    const components = JSON.parse(readRepoFile("components.json")) as {
      style: string;
      iconLibrary: string;
      tsx: boolean;
      rsc: boolean;
    };

    expect(components.style).toMatch(/^base-/u);
    expect(components.iconLibrary).toBe("lucide");
    expect(components.tsx).toBe(true);
    expect(components.rsc).toBe(false);
  });

  it("installs the static strict CSP before every active resource", () => {
    const document = new DOMParser().parseFromString(
      readRepoFile("index.html"),
      "text/html"
    );
    const csp = document.querySelector(
      'meta[http-equiv="Content-Security-Policy"]'
    );

    expect(csp?.getAttribute("content")).toBe(strictCsp);

    const headElements = Array.from(document.head.children);
    const cspIndex = headElements.indexOf(csp as Element);
    const firstActiveResourceIndex = headElements.findIndex((element) =>
      element.matches("script, style, link[rel]")
    );

    expect(cspIndex).toBeGreaterThanOrEqual(0);
    expect(cspIndex).toBeLessThan(firstActiveResourceIndex);
    expect(readRepoFile("index.html")).not.toMatch(
      /unsafe-inline|unsafe-eval|unsafe-hashes|wasm-unsafe-eval|nonce-|sha(?:256|384|512)-/u
    );
  });

  it("configures Base UI globally without nonces or style elements", () => {
    const main = readRepoFile("src/main.tsx");
    const viteConfig = readRepoFile("vite.config.ts");

    expect(main).toContain(
      'import { CSPProvider } from "@base-ui/react/csp-provider"'
    );
    expect(main).toContain("<CSPProvider disableStyleElements>");
    expect(viteConfig).not.toMatch(/cspNonce|csp-nonce|#echo|csp_nonce/u);
  });

  it("contains no Radix imports or application-owned inline styling APIs", () => {
    const violations: string[] = [];

    for (const filePath of sourceFiles()) {
      const sourceFile = sourceFileFor(filePath);

      function visit(node: ts.Node): void {
        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier) &&
          node.moduleSpecifier.text.startsWith("@radix-ui/")
        ) {
          violations.push(
            `${nodeLocation(sourceFile, node)} imports ${node.moduleSpecifier.text}`
          );
        }

        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier) &&
          node.moduleSpecifier.text === "react-dom" &&
          node.importClause?.namedBindings &&
          ts.isNamedImports(node.importClause.namedBindings) &&
          node.importClause.namedBindings.elements.some(
            (element) => element.name.text === "createPortal"
          )
        ) {
          violations.push(
            `${nodeLocation(sourceFile, node)} implements an application portal`
          );
        }

        if (
          ts.isJsxAttribute(node) &&
          node.name.getText(sourceFile) === "style"
        ) {
          violations.push(`${nodeLocation(sourceFile, node)} uses JSX style`);
        }

        if (
          ts.isPropertyAccessExpression(node) &&
          node.name.text === "style" &&
          !ts.isPropertyAccessExpression(node.parent)
        ) {
          violations.push(
            `${nodeLocation(sourceFile, node)} uses CSSStyleDeclaration`
          );
        }

        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "setAttribute" &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0]) &&
          node.arguments[0].text.toLowerCase() === "style"
        ) {
          violations.push(
            `${nodeLocation(sourceFile, node)} sets a style attribute`
          );
        }

        if (
          ts.isPropertyAccessExpression(node) &&
          node.name.text === "cssText"
        ) {
          violations.push(`${nodeLocation(sourceFile, node)} uses cssText`);
        }

        ts.forEachChild(node, visit);
      }

      visit(sourceFile);
    }

    expect(violations).toEqual([]);
  });

  it("contains no application-owned executable or dynamic tag injection", () => {
    const violations: string[] = [];

    for (const filePath of sourceFiles()) {
      const sourceFile = sourceFileFor(filePath);

      function visit(node: ts.Node): void {
        if (ts.isIdentifier(node) && node.text === "dangerouslySetInnerHTML") {
          violations.push(
            `${nodeLocation(sourceFile, node)} uses dangerouslySetInnerHTML`
          );
        }

        if (
          ts.isNewExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "Function"
        ) {
          violations.push(`${nodeLocation(sourceFile, node)} uses Function`);
        }

        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "eval"
        ) {
          violations.push(`${nodeLocation(sourceFile, node)} uses eval`);
        }

        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "createElement" &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0]) &&
          /^(?:script|style)$/u.test(node.arguments[0].text.toLowerCase())
        ) {
          violations.push(
            `${nodeLocation(sourceFile, node)} creates ${node.arguments[0].text}`
          );
        }

        ts.forEachChild(node, visit);
      }

      visit(sourceFile);
    }

    expect(violations).toEqual([]);
  });
});
