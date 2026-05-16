// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

const LOOPBACK_HOSTNAMES = new Set(["localhost", "::1", "[::1]"]);

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
