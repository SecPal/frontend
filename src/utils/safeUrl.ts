// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

const LOOPBACK_HOSTNAMES = new Set(["localhost", "::1", "[::1]"]);
const PERCENT_ENCODED_RE = /%[0-9a-f]{2}/i;
// Local-part uses RFC 5321 atext: excludes specials and characters that carry
// meaning in mailto URIs (?  & # %) to prevent header injection or
// percent-encoding bypass.
const MAILTO_TARGET_RE =
  /^[A-Za-z0-9!$'*+/=^_`{|}~-]+(?:\.[A-Za-z0-9!$'*+/=^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;
const TEL_TARGET_RE = /^\+?[0-9][0-9 .-]*(?:;ext=[0-9]+)?$/;

interface SafeHttpUrlOptions {
  currentHostname?: string;
  allowDevLoopback?: boolean;
}

function isIpv4LoopbackHostname(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return false;
  }

  const octets = parts.map((part) => Number(part));
  return (
    parts.every((part) => /^\d+$/.test(part)) &&
    octets.every(
      (octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255
    ) &&
    octets[0] === 127
  );
}

function isLoopbackHostname(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();

  return (
    LOOPBACK_HOSTNAMES.has(normalizedHostname) ||
    isIpv4LoopbackHostname(normalizedHostname)
  );
}

function isLoopbackHttpAllowed(options: SafeHttpUrlOptions): boolean {
  if (options.allowDevLoopback ?? import.meta.env.DEV) {
    return true;
  }

  const currentHostname =
    options.currentHostname ?? globalThis.location?.hostname ?? "";

  return isLoopbackHostname(currentHostname);
}

export function isSafeHttpUrl(
  value: string,
  options: SafeHttpUrlOptions = {}
): boolean {
  const trimmedValue = value.trim();
  if (trimmedValue === "") {
    return false;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedValue);
  } catch {
    return false;
  }

  if (parsedUrl.protocol === "https:") {
    return true;
  }

  return (
    parsedUrl.protocol === "http:" &&
    isLoopbackHostname(parsedUrl.hostname) &&
    isLoopbackHttpAllowed(options)
  );
}

export function isSafeMailtoTarget(value: string): boolean {
  if (
    value === "" ||
    value !== value.trim() ||
    PERCENT_ENCODED_RE.test(value)
  ) {
    return false;
  }

  return MAILTO_TARGET_RE.test(value);
}

export function isSafeTelTarget(value: string): boolean {
  if (
    value === "" ||
    value !== value.trim() ||
    PERCENT_ENCODED_RE.test(value)
  ) {
    return false;
  }

  return TEL_TARGET_RE.test(value);
}
