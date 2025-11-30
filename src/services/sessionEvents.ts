// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Check if the browser is online
 * @returns true if online or if we can't determine (SSR)
 */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/**
 * Session event types for pub/sub pattern
 *
 * Using a simple event emitter to decouple session handling from components.
 * This allows the CSRF module to notify about session expiry without
 * importing React context (avoiding circular dependencies).
 */

export type SessionEventType = "session:expired";

type SessionEventCallback = () => void;

/**
 * Simple event emitter for session-related events
 *
 * Implements pub/sub pattern to allow loose coupling between:
 * - CSRF module (publisher: detects 401)
 * - AuthContext (subscriber: handles logout)
 */
class SessionEventEmitter {
  private listeners: Map<SessionEventType, Set<SessionEventCallback>> =
    new Map();

  /**
   * Subscribe to a session event
   * @param event Event type to listen for
   * @param callback Function to call when event fires
   * @returns Unsubscribe function
   */
  on(event: SessionEventType, callback: SessionEventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emit a session event
   * @param event Event type to emit
   */
  emit(event: SessionEventType): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          console.error(`Error in session event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Reset all listeners (useful for testing)
   */
  reset(): void {
    this.listeners.clear();
  }
}

/**
 * Global session event emitter instance
 *
 * Usage:
 * - Subscribe: `const unsub = sessionEvents.on('session:expired', handleLogout);`
 * - Emit: `sessionEvents.emit('session:expired');`
 */
export const sessionEvents = new SessionEventEmitter();
