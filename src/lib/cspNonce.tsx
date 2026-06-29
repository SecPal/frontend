// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { setNonce } from "get-nonce";

export const INPUT_OTP_STYLE_MARKER_ID = "input-otp-style";
const NONCE_ATTR_SELECTOR = [
  "script[nonce]",
  'link[rel="stylesheet"][nonce]',
  'link[rel="modulepreload"][nonce]',
].join(", ");
let appliedRuntimeStyleNonce: string | undefined;
let patchedStyleElementFactory = false;
let patchedStyleElementInsertion = false;

type WebpackNonceGlobal = typeof globalThis & {
  __webpack_nonce__?: string;
};

function normalizeCspNonce(candidate: string | null | undefined) {
  if (!candidate) {
    return undefined;
  }

  const nonce = candidate.trim();
  if (nonce.length === 0 || nonce.includes("<!--#echo")) {
    return undefined;
  }

  return nonce;
}

function readCspNonce(): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }

  const carrier = document.querySelector(NONCE_ATTR_SELECTOR) as
    (Element & { nonce?: string }) | null;

  return normalizeCspNonce(carrier?.nonce || carrier?.getAttribute("nonce"));
}

function applyRuntimeStyleNonce(nonce: string | undefined) {
  if (!nonce || nonce === appliedRuntimeStyleNonce) {
    return nonce;
  }

  setNonce(nonce);
  (globalThis as WebpackNonceGlobal).__webpack_nonce__ = nonce;
  appliedRuntimeStyleNonce = nonce;

  return nonce;
}

function applyNonceToStyleElement(node: Node | null | undefined) {
  if (!(node instanceof HTMLStyleElement)) {
    return;
  }

  const nonce = getCspNonce();
  if (nonce && !node.getAttribute("nonce")) {
    node.setAttribute("nonce", nonce);
  }
}

function patchStyleElementFactory() {
  if (
    patchedStyleElementFactory ||
    typeof document === "undefined" ||
    typeof document.createElement !== "function"
  ) {
    return;
  }

  const originalCreateElement = document.createElement.bind(document);

  document.createElement = function patchedCreateElement(
    tagName: string,
    options?: ElementCreationOptions
  ) {
    const element = originalCreateElement(tagName, options);

    if (tagName.toLowerCase() === "style") {
      const nonce = getCspNonce();
      if (nonce && !(element as HTMLStyleElement).nonce) {
        (element as HTMLStyleElement).nonce = nonce;
        element.setAttribute("nonce", nonce);
      }
    }

    return element;
  };

  patchedStyleElementFactory = true;
}

function patchStyleElementInsertion() {
  if (
    patchedStyleElementInsertion ||
    typeof Node === "undefined" ||
    typeof Node.prototype.appendChild !== "function" ||
    typeof Node.prototype.insertBefore !== "function"
  ) {
    return;
  }

  const originalAppendChild = Node.prototype.appendChild;
  const originalInsertBefore = Node.prototype.insertBefore;

  Node.prototype.appendChild = function patchedAppendChild<T extends Node>(
    node: T
  ) {
    applyNonceToStyleElement(node);
    return originalAppendChild.call(this, node) as T;
  };

  Node.prototype.insertBefore = function patchedInsertBefore<T extends Node>(
    node: T,
    child: Node | null
  ) {
    applyNonceToStyleElement(node);
    return originalInsertBefore.call(this, node, child) as T;
  };

  patchedStyleElementInsertion = true;
}

applyRuntimeStyleNonce(readCspNonce());
patchStyleElementFactory();
patchStyleElementInsertion();

export function getCspNonce(): string | undefined {
  return applyRuntimeStyleNonce(readCspNonce());
}
