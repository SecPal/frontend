// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

export function useEmployeeStatusSelectItems() {
  const { _ } = useLingui();
  return [
    { value: "applicant", label: _(msg`Applicant`) },
    { value: "pre_contract", label: _(msg`Pre-Contract`) },
    { value: "active", label: _(msg`Active`) },
    { value: "on_leave", label: _(msg`On Leave`) },
    { value: "terminated", label: _(msg`Terminated`) },
  ] as const;
}
