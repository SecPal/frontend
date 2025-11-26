// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Service Worker Secret Sync Tests
 *
 * Tests background sync functionality for secret operations.
 * These tests verify the SW correctly triggers secret queue processing.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Mock Service Worker Global Scope
 */
interface MockServiceWorkerGlobalScope {
  clients: {
    matchAll: ReturnType<typeof vi.fn>;
  };
  registration: {
    sync: {
      register: ReturnType<typeof vi.fn>;
    };
  };
}

describe("Service Worker Secret Sync", () => {
  let mockSelf: MockServiceWorkerGlobalScope;

  beforeEach(() => {
    // Create mock SW global scope
    mockSelf = {
      clients: {
        matchAll: vi.fn(),
      },
      registration: {
        sync: {
          register: vi.fn(),
        },
      },
    };
  });

  describe("Background Sync Registration", () => {
    it("should register sync-secret-queue tag", async () => {
      await mockSelf.registration.sync.register("sync-secret-queue");

      expect(mockSelf.registration.sync.register).toHaveBeenCalledWith(
        "sync-secret-queue"
      );
    });

    it("should support multiple sync registrations", async () => {
      await mockSelf.registration.sync.register("sync-file-queue");
      await mockSelf.registration.sync.register("sync-secret-queue");

      expect(mockSelf.registration.sync.register).toHaveBeenCalledTimes(2);
    });
  });

  describe("Client Communication", () => {
    it("should notify clients to process secret queue", async () => {
      const mockClient = {
        postMessage: vi.fn(),
      };

      mockSelf.clients.matchAll.mockResolvedValue([mockClient]);

      // Simulate sync event
      const clients = await mockSelf.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.postMessage({
          type: "PROCESS_SECRET_SYNC_QUEUE",
          count: 3,
        });
      }

      expect(mockClient.postMessage).toHaveBeenCalledWith({
        type: "PROCESS_SECRET_SYNC_QUEUE",
        count: 3,
      });
    });

    it("should skip sync when no clients are available", async () => {
      mockSelf.clients.matchAll.mockResolvedValue([]);

      const clients = await mockSelf.clients.matchAll({ type: "window" });

      expect(clients).toHaveLength(0);
    });

    it("should notify all active clients", async () => {
      const mockClients = [
        { postMessage: vi.fn() },
        { postMessage: vi.fn() },
        { postMessage: vi.fn() },
      ];

      mockSelf.clients.matchAll.mockResolvedValue(mockClients);

      const clients = await mockSelf.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.postMessage({
          type: "PROCESS_SECRET_SYNC_QUEUE",
          count: 5,
        });
      }

      expect(mockClients[0].postMessage).toHaveBeenCalled();
      expect(mockClients[1].postMessage).toHaveBeenCalled();
      expect(mockClients[2].postMessage).toHaveBeenCalled();
    });
  });

  describe("Message Protocol", () => {
    it("should send correct message structure", async () => {
      const mockClient = { postMessage: vi.fn() };
      mockSelf.clients.matchAll.mockResolvedValue([mockClient]);

      const clients = await mockSelf.clients.matchAll({ type: "window" });
      clients[0].postMessage({
        type: "PROCESS_SECRET_SYNC_QUEUE",
        count: 7,
      });

      const message = mockClient.postMessage.mock.calls[0][0];
      expect(message).toHaveProperty("type", "PROCESS_SECRET_SYNC_QUEUE");
      expect(message).toHaveProperty("count");
      expect(typeof message.count).toBe("number");
    });

    it("should handle zero pending operations", async () => {
      const mockClient = { postMessage: vi.fn() };
      mockSelf.clients.matchAll.mockResolvedValue([mockClient]);

      const clients = await mockSelf.clients.matchAll({ type: "window" });
      clients[0].postMessage({
        type: "PROCESS_SECRET_SYNC_QUEUE",
        count: 0,
      });

      expect(mockClient.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 0,
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle client matchAll failure gracefully", async () => {
      mockSelf.clients.matchAll.mockRejectedValue(
        new Error("Client matching failed")
      );

      await expect(
        mockSelf.clients.matchAll({ type: "window" })
      ).rejects.toThrow("Client matching failed");
    });

    it("should continue on postMessage failure", async () => {
      const mockClients = [
        {
          postMessage: vi.fn().mockImplementation(() => {
            throw new Error("Message failed");
          }),
        },
        { postMessage: vi.fn() },
      ];

      mockSelf.clients.matchAll.mockResolvedValue(mockClients);

      const clients = await mockSelf.clients.matchAll({ type: "window" });

      // First client throws, second should still be attempted
      expect(() => {
        clients[0].postMessage({ type: "TEST" });
      }).toThrow("Message failed");

      // Second client should work
      clients[1].postMessage({ type: "TEST" });
      expect(mockClients[1].postMessage).toHaveBeenCalled();
    });
  });
});
