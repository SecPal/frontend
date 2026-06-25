// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getCspNonce, INPUT_OTP_STYLE_MARKER_ID } from "./cspNonce";

export function RuntimeStyleCspSupport() {
  getCspNonce();

  return (
    <span
      hidden
      aria-hidden="true"
      id={INPUT_OTP_STYLE_MARKER_ID}
      data-secpal-runtime-style-marker=""
    />
  );
}
