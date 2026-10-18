// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import type { AddressReferenceMeta } from "@/types/api";

interface AddressDataAttributionProps {
  id?: string;
  meta?: AddressReferenceMeta;
}

export function AddressDataAttribution({
  id,
  meta,
}: AddressDataAttributionProps) {
  const { _ } = useLingui();
  return (
    <p
      id={id}
      role="note"
      aria-label={_(msg`Address data attribution`)}
      className="text-xs leading-5 text-muted-foreground"
    >
      <Trans>Address data:</Trans>{" "}
      <a
        tabIndex={-1}
        className="underline underline-offset-2 hover:text-foreground"
        href="https://github.com/openpotato/openplzapi.data"
        target="_blank"
        rel="noopener noreferrer"
      >
        OpenPLZ / OpenPotato
      </a>
      {" · "}
      <a
        tabIndex={-1}
        className="underline underline-offset-2 hover:text-foreground"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Trans>© OpenStreetMap contributors</Trans>
      </a>
      {" · "}
      <a
        tabIndex={-1}
        className="underline underline-offset-2 hover:text-foreground"
        href="https://opendatacommons.org/licenses/odbl/1-0/"
        target="_blank"
        rel="noopener noreferrer"
      >
        {meta?.license ?? "ODbL-1.0"}
      </a>
    </p>
  );
}
