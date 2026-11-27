// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AUTH_LOGOUT_BARRIER_KEY } from "./offlineVaultKeys";
import { awaitAbortable, throwIfAborted } from "./abortablePromise";
import {
  AUTH_VAULT_LIFECYCLE_TIMEOUT_MS,
  runWithOfflineVaultLifecycleLock,
} from "./offlineVaultLifecycleLock";
import { createSecureRandomToken } from "./secureRandom";

type LifecycleEvent = "restore" | "persist" | "unlock" | "lock" | "invalidate";
type CleanupState = "pending" | "committed" | "recovery-blocked" | "retired";

export interface AuthLifecycleOwner {
  readonly event: LifecycleEvent;
  readonly signal: AbortSignal;
}

type PersistenceAdmission = "admitted" | "superseded" | "recovery-blocked";
type LogoutCleanup =
  | { status: "committed" | "superseded" }
  | {
      status: "timed-out" | "cancelled" | "rolled-back" | "recovery-blocked";
      error: unknown;
    };

const CLEANUP_KEY_PREFIX = "auth_logout_cleanup:";
const LOGOUT_BARRIER_KEYS = {
  vault: AUTH_LOGOUT_BARRIER_KEY,
  sensitive: "auth_sensitive_logout_barrier",
} as const;

export interface LogoutWork {
  mode: "vault" | "sensitive";
  prepare(
    signal: AbortSignal,
    mode: LogoutWork["mode"],
    isCurrent: () => boolean
  ): Promise<(signal: AbortSignal) => Promise<void>>;
  trailing?: (isCurrent: () => boolean) => Promise<void>;
  afterTrailing?: () => void;
}

interface ActiveLogout {
  barrier: string;
  controller: AbortController;
  completion: Promise<LogoutCleanup>;
  work: LogoutWork;
}

function newGeneration(event: LifecycleEvent) {
  const controller = new AbortController();
  return { controller, owner: { event, signal: controller.signal } };
}

class AuthLifecycle {
  private generation = newGeneration("restore");
  private readonly cleanupListeners = new Set<() => void>();
  private activeLogout: ActiveLogout | null = null;
  private publicationFailed = false;

  current(): AuthLifecycleOwner {
    return this.generation.owner;
  }

  begin(event: LifecycleEvent): AuthLifecycleOwner {
    const previous = this.generation;
    this.generation = newGeneration(event);
    previous.controller.abort();
    return this.current();
  }

  owns(owner: AuthLifecycleOwner): boolean {
    return this.current() === owner && !owner.signal.aborted;
  }

  cancel(owner: AuthLifecycleOwner): void {
    if (this.owns(owner)) {
      this.begin("invalidate");
    }
  }

  private barrierFor(mode: LogoutWork["mode"]): string | null {
    const barrier = localStorage.getItem(LOGOUT_BARRIER_KEYS[mode]);
    return barrier !== null && this.cleanupState(barrier) !== "retired"
      ? barrier
      : null;
  }

  barrier(): string | null {
    return this.barrierFor("sensitive") ?? this.barrierFor("vault");
  }

  hasBarrier(): boolean {
    return this.publicationFailed || this.barrier() !== null;
  }

  observeAuthenticatedGeneration(): () => boolean {
    const owner = this.current();
    const vault = localStorage.getItem(LOGOUT_BARRIER_KEYS.vault);
    const sensitive = localStorage.getItem(LOGOUT_BARRIER_KEYS.sensitive);
    return () =>
      this.owns(owner) &&
      !this.hasBarrier() &&
      localStorage.getItem(LOGOUT_BARRIER_KEYS.vault) === vault &&
      localStorage.getItem(LOGOUT_BARRIER_KEYS.sensitive) === sensitive;
  }

  private beginLogout(barrier: string, mode: LogoutWork["mode"]): void {
    this.begin("invalidate");
    const key = LOGOUT_BARRIER_KEYS[mode];
    const previous = localStorage.getItem(key);
    localStorage.setItem(key, barrier);
    this.recordCleanup(barrier, "pending");
    if (previous !== null && previous !== barrier) {
      localStorage.removeItem(CLEANUP_KEY_PREFIX + previous);
    }
  }

  private recordCleanup(barrier: string, state: CleanupState): void {
    if (this.barrier() === barrier) {
      localStorage.setItem(CLEANUP_KEY_PREFIX + barrier, state);
      if (state === "committed") {
        this.publicationFailed = false;
      }
      this.notifyCleanupListeners();
    }
  }

  retireBarrier(barrier: string | null): void {
    if (barrier !== null && this.cleanupState(barrier) === "committed") {
      // Retire this token only. Another tab may have published a new token.
      this.recordCleanup(barrier, "retired");
    }
  }

  isBarrierStorageEvent(event: StorageEvent): boolean {
    if (
      event.key === LOGOUT_BARRIER_KEYS.vault ||
      event.key === LOGOUT_BARRIER_KEYS.sensitive
    ) {
      return (
        event.newValue === localStorage.getItem(event.key) &&
        (event.newValue === null ||
          this.cleanupState(event.newValue) !== "retired")
      );
    }
    return (
      event.newValue === "retired" &&
      Object.values(LOGOUT_BARRIER_KEYS).some((key) => {
        const latest = localStorage.getItem(key);
        return (
          latest !== null &&
          event.key === CLEANUP_KEY_PREFIX + latest &&
          this.cleanupState(latest) === "retired"
        );
      })
    );
  }

  private notifyCleanupListeners(): void {
    for (const notify of this.cleanupListeners) {
      notify();
    }
  }

  private cleanupState(barrier: string): CleanupState {
    const state = localStorage.getItem(CLEANUP_KEY_PREFIX + barrier);
    return state === "committed" || state === "pending" || state === "retired"
      ? state
      : "recovery-blocked";
  }

  async admitPersistence(
    owner: AuthLifecycleOwner,
    barrier: string | null
  ): Promise<PersistenceAdmission> {
    const observe = (): PersistenceAdmission | "pending" => {
      if (!this.owns(owner) || this.barrier() !== barrier) {
        return "superseded";
      }
      if (this.publicationFailed) {
        return "recovery-blocked";
      }
      const cleanup =
        barrier === null ? "committed" : this.cleanupState(barrier);
      if (cleanup === "retired") {
        return "superseded";
      }
      return cleanup === "committed" ? "admitted" : cleanup;
    };
    const initial = observe();
    if (initial !== "pending") {
      return initial;
    }

    return new Promise((resolve) => {
      const update = () => {
        const result = observe();
        if (result !== "pending") {
          finish(result);
        }
      };
      const storageChanged = (event: StorageEvent) => {
        if (
          event.storageArea === localStorage &&
          (event.key === CLEANUP_KEY_PREFIX + barrier ||
            this.isBarrierStorageEvent(event))
        ) {
          update();
        }
      };
      const finish = (result: PersistenceAdmission) => {
        globalThis.clearTimeout(timeout);
        owner.signal.removeEventListener("abort", update);
        globalThis.removeEventListener("storage", storageChanged);
        this.cleanupListeners.delete(update);
        resolve(result);
      };
      const timeout = globalThis.setTimeout(
        () => finish("recovery-blocked"),
        AUTH_VAULT_LIFECYCLE_TIMEOUT_MS
      );
      owner.signal.addEventListener("abort", update, { once: true });
      globalThis.addEventListener("storage", storageChanged);
      this.cleanupListeners.add(update);
      update();
    });
  }

  logout(work: LogoutWork): Promise<LogoutCleanup> {
    const active = this.activeLogout;
    if (
      active?.barrier === this.barrier() &&
      (active.work.mode === "sensitive" || work.mode === "vault")
    ) {
      active.work.afterTrailing ??= work.afterTrailing;
      return active.completion;
    }

    const mode =
      work.mode === "sensitive" || this.barrierFor("sensitive") !== null
        ? "sensitive"
        : "vault";
    const barrier = createSecureRandomToken();
    try {
      this.beginLogout(barrier, mode);
    } catch (error) {
      this.publicationFailed = true;
      active?.controller.abort();
      return Promise.resolve({ status: "recovery-blocked", error });
    }
    active?.controller.abort();
    const controller = new AbortController();
    const operation: LogoutWork = { ...work, mode };
    const completion = this.performLogout(
      barrier,
      controller,
      operation
    ).finally(() => {
      if (this.activeLogout?.barrier === barrier) {
        this.activeLogout = null;
      }
    });
    this.activeLogout = { barrier, controller, completion, work: operation };
    return completion;
  }

  private async performLogout(
    barrier: string,
    controller: AbortController,
    work: LogoutWork
  ): Promise<LogoutCleanup> {
    const signal = controller.signal;
    const isCurrent = () => this.barrier() === barrier;
    const timeout = new DOMException(
      "Logout cleanup timed out.",
      "TimeoutError"
    );
    const deadline = globalThis.setTimeout(
      () => controller.abort(timeout),
      AUTH_VAULT_LIFECYCLE_TIMEOUT_MS
    );
    try {
      const clear = await awaitAbortable(
        work.prepare(signal, work.mode, isCurrent),
        signal
      );
      const committed = await runWithOfflineVaultLifecycleLock(
        async (lockSignal) => {
          if (!isCurrent()) {
            return false;
          }
          const coveredVaultBarrier =
            work.mode === "sensitive" ? this.barrierFor("vault") : null;
          await clear(lockSignal);
          throwIfAborted(lockSignal);
          if (!isCurrent()) {
            return false;
          }
          if (
            coveredVaultBarrier !== null &&
            this.barrierFor("vault") === coveredVaultBarrier
          ) {
            localStorage.setItem(
              CLEANUP_KEY_PREFIX + coveredVaultBarrier,
              "retired"
            );
          }
          this.recordCleanup(barrier, "committed");
          return true;
        },
        signal
      );
      if (!committed) {
        return { status: "superseded" };
      }
    } catch (error) {
      if (!isCurrent()) {
        return { status: "superseded" };
      }
      this.recordCleanup(barrier, "recovery-blocked");
      return {
        status:
          signal.reason === timeout
            ? "timed-out"
            : signal.aborted
              ? "cancelled"
              : "rolled-back",
        error,
      };
    } finally {
      globalThis.clearTimeout(deadline);
    }

    if (work.trailing && isCurrent()) {
      const trailingController = new AbortController();
      const trailingTimeout = globalThis.setTimeout(
        () => trailingController.abort(),
        AUTH_VAULT_LIFECYCLE_TIMEOUT_MS
      );
      try {
        await awaitAbortable(
          work.trailing(
            () => !trailingController.signal.aborted && isCurrent()
          ),
          trailingController.signal
        );
      } catch {
        // Best-effort work has no authority over a committed cleanup.
      } finally {
        globalThis.clearTimeout(trailingTimeout);
      }
    }
    if (isCurrent()) {
      work.afterTrailing?.();
    }
    return { status: "committed" };
  }
}

export const authLifecycle = new AuthLifecycle();
