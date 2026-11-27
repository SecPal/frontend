// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Dexie, { type Table, type Transaction } from "dexie";
import { awaitAbortable, throwIfAborted } from "./abortablePromise";
import { db } from "./db";

/** Abort an active transaction before the lifecycle lock can be released. */
export async function runAuthStateTransaction<T>(
  tables: Table[],
  change: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  throwIfAborted(signal);
  let active: Transaction | null = null;
  const abort = () => active?.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const transaction = db.transaction("rw", tables, async () => {
      active = Dexie.currentTransaction;
      throwIfAborted(signal);
      const result = await change();
      throwIfAborted(signal);
      return result;
    });
    return await awaitAbortable(transaction, signal);
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}
