// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { useMemo } from "react";
import { getUserCapabilities } from "../lib/capabilities";
import { useAuth } from "./useAuth";

export function useUserCapabilities() {
  const { user } = useAuth();

  return useMemo(() => getUserCapabilities(user), [user]);
}
