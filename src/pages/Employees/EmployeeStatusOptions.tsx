// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/macro";

export function EmployeeStatusOptions() {
  return (
    <>
      <option value="applicant">
        <Trans>Applicant</Trans>
      </option>
      <option value="pre_contract">
        <Trans>Pre-Contract</Trans>
      </option>
      <option value="active">
        <Trans>Active</Trans>
      </option>
      <option value="on_leave">
        <Trans>On Leave</Trans>
      </option>
      <option value="terminated">
        <Trans>Terminated</Trans>
      </option>
    </>
  );
}
