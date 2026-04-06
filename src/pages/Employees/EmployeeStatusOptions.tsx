// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";

export function EmployeeStatusOptions() {
  const { _ } = useLingui();
  return (
    <>
      <option value="applicant">{_(msg`Applicant`)}</option>
      <option value="pre_contract">{_(msg`Pre-Contract`)}</option>
      <option value="active">{_(msg`Active`)}</option>
      <option value="on_leave">{_(msg`On Leave`)}</option>
      <option value="terminated">{_(msg`Terminated`)}</option>
    </>
  );
}
