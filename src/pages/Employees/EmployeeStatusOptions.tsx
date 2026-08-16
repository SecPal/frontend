// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SelectItem } from "@/ui/select";
import { useEmployeeStatusSelectItems } from "./useEmployeeStatusSelectItems";

export function EmployeeStatusSelectItems() {
  const items = useEmployeeStatusSelectItems();
  return (
    <>
      {items.map((item) => (
        <SelectItem key={item.value} value={item.value} data-value={item.value}>
          {item.label}
        </SelectItem>
      ))}
    </>
  );
}
