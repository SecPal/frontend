// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import type { AddressReferenceMeta } from "@/types/api";

interface AddressDataAttributionProps {
  id?: string;
  meta?: AddressReferenceMeta;
  sourceUrl?: string | null;
}

export function AddressDataAttribution({
  id,
  meta,
  sourceUrl,
}: AddressDataAttributionProps) {
  const { _ } = useLingui();
  return (
    <p
      id={id}
      role="note"
      aria-label={_(msg`Address data attribution`)}
      className="col-span-full text-sm leading-6 text-muted-foreground"
    >
      <Trans>Address data:</Trans>{" "}
      <a
        className="underline underline-offset-4"
        href="https://github.com/openpotato/openplzapi.data"
        target="_blank"
        rel="noopener noreferrer"
      >
        OpenPLZ / OpenPotato
      </a>
      {" · "}
      <a
        className="underline underline-offset-4"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
      >
        © OpenStreetMap contributors
      </a>
      {" · "}
      <a
        className="underline underline-offset-4"
        href="https://opendatacommons.org/licenses/odbl/1-0/"
        target="_blank"
        rel="noopener noreferrer"
      >
        {meta?.license ?? "ODbL-1.0"}
      </a>
      {sourceUrl ? (
        <>
          {" · "}
          <a
            className="underline underline-offset-4"
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Trans>Source and alterations</Trans>
          </a>
        </>
      ) : null}
      {meta ? (
        <>
          {" "}
          · <span>{meta.attribution ?? meta.source}</span>
        </>
      ) : null}
    </p>
  );
}
