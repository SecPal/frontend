// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { SelectItem } from "@/ui/select";

export function EmployeeStatusSelectItems() {
  const { _ } = useLingui();
  return (
    <>
      <SelectItem value="applicant" data-value="applicant">
        {_(msg`Applicant`)}
      </SelectItem>
      <SelectItem value="pre_contract" data-value="pre_contract">
        {_(msg`Pre-Contract`)}
      </SelectItem>
      <SelectItem value="active" data-value="active">
        {_(msg`Active`)}
      </SelectItem>
      <SelectItem value="on_leave" data-value="on_leave">
        {_(msg`On Leave`)}
      </SelectItem>
      <SelectItem value="terminated" data-value="terminated">
        {_(msg`Terminated`)}
      </SelectItem>
    </>
  );
}
