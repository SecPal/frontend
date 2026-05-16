// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const LOOPBACK_IPV4_PATTERN = /^127(?:\.\d{1,3}){3}$/;

function isLoopbackHostname(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();

  return (
    LOOPBACK_HOSTNAMES.has(normalizedHostname) ||
    LOOPBACK_IPV4_PATTERN.test(normalizedHostname)
  );
}

export function isSafeHttpUrl(value: string): boolean {
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
    parsedUrl.protocol === "http:" && isLoopbackHostname(parsedUrl.hostname)
  );
}
