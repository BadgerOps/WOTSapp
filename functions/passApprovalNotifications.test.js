/**
 * Unit tests for passApprovalNotifications Cloud Function
 * These tests verify the notification logic for pass approval requests
 *
 * To run: npx vitest functions/passApprovalNotifications.test.js
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Import the handler directly - no need to mock the trigger setup
const { handlePassRequestCreated } = require("./passApprovalNotifications");

describe("handlePassRequestCreated", () => {
  let mockDb;
  let mockMessaging;
  let mockGetConfiguredTimezone;
  let mockBatch;
  let mockUsersSnapshot;

  // Helper to create mock event
  function createMockEvent(data, requestId = "test-request-1") {
    return {
      params: { requestId },
      data: {
        data: () => data,
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock batch
    mockBatch = {
      update: vi.fn(),
      commit: vi.fn(() => Promise.resolve()),
    };

    // Setup default users snapshot with leadership
    mockUsersSnapshot = {
      forEach: vi.fn((callback) => {
        callback({
          id: "leadership-1",
          data: () => ({
            role: "candidate_leadership",
            fcmTokens: ["token-1", "token-2"],
          }),
          ref: { id: "leadership-1" },
        });
        callback({
          id: "admin-1",
          data: () => ({
            role: "admin",
            fcmTokens: ["token-3"],
          }),
          ref: { id: "admin-1" },
        });
      }),
    };

    // Setup mock Firestore
    mockDb = {
      collection: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve(mockUsersSnapshot)),
        })),
      })),
      batch: vi.fn(() => mockBatch),
    };

    // Setup mock messaging
    mockMessaging = {
      sendEachForMulticast: vi.fn(() =>
        Promise.resolve({
          successCount: 3,
          failureCount: 0,
          responses: [],
        })
      ),
    };

    // Setup mock timezone
    mockGetConfiguredTimezone = vi.fn(() =>
      Promise.resolve("America/New_York")
    );
  });

  it("should not send notification for non-pending requests", async () => {
    const mockEvent = createMockEvent({
      status: "approved", // Not pending
      requesterId: "user-1",
      requesterName: "Test User",
    });

    const result = await handlePassRequestCreated(mockEvent, {
      db: mockDb,
      messaging: mockMessaging,
      getConfiguredTimezone: mockGetConfiguredTimezone,
    });

    expect(result).toBeNull();
    expect(mockDb.collection).not.toHaveBeenCalled();
    expect(mockMessaging.sendEachForMulticast).not.toHaveBeenCalled();
  });

  it("should return null when no FCM tokens found", async () => {
    // Override to return users with no tokens
    mockUsersSnapshot.forEach = vi.fn(() => {
      // No callbacks = no users with tokens
    });

    const mockEvent = createMockEvent({
      status: "pending",
      requesterId: "user-1",
      requesterName: "Test User",
    });

    const result = await handlePassRequestCreated(mockEvent, {
      db: mockDb,
      messaging: mockMessaging,
      getConfiguredTimezone: mockGetConfiguredTimezone,
    });

    expect(result).toBeNull();
    expect(mockMessaging.sendEachForMulticast).not.toHaveBeenCalled();
  });

  it("should exclude requester from notifications", async () => {
    // Include the requester in the snapshot
    mockUsersSnapshot.forEach = vi.fn((callback) => {
      // This is the requester - should be skipped
      callback({
        id: "user-1",
        data: () => ({
          role: "candidate_leadership",
          fcmTokens: ["requester-token"],
        }),
        ref: { id: "user-1" },
      });
      // This is another leadership member
      callback({
        id: "leadership-1",
        data: () => ({
          role: "candidate_leadership",
          fcmTokens: ["other-token"],
        }),
        ref: { id: "leadership-1" },
      });
    });

    const mockEvent = createMockEvent({
      status: "pending",
      requesterId: "user-1", // Same as first user
      requesterName: "Test User",
    });

    const result = await handlePassRequestCreated(mockEvent, {
      db: mockDb,
      messaging: mockMessaging,
      getConfiguredTimezone: mockGetConfiguredTimezone,
    });

    expect(result).not.toBeNull();
    // Should only send to "other-token", not "requester-token"
    expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ["other-token"],
      })
    );
  });

  it("should send notification for pending requests", async () => {
    const mockEvent = createMockEvent({
      status: "pending",
      requesterId: "user-1",
      requesterName: "SGT Smith",
      destination: "BX",
      companions: [{ id: "user-2", name: "PFC Jones" }],
    });

    const result = await handlePassRequestCreated(mockEvent, {
      db: mockDb,
      messaging: mockMessaging,
      getConfiguredTimezone: mockGetConfiguredTimezone,
    });

    expect(result).not.toBeNull();
    expect(result.successCount).toBe(3);
    expect(mockMessaging.sendEachForMulticast).toHaveBeenCalled();
  });

  it("should include companion count in notification title", async () => {
    const mockEvent = createMockEvent({
      status: "pending",
      requesterId: "user-1",
      requesterName: "SGT Smith",
      companions: [
        { id: "user-2", name: "PFC Jones" },
        { id: "user-3", name: "PFC Brown" },
      ],
    });

    await handlePassRequestCreated(mockEvent, {
      db: mockDb,
      messaging: mockMessaging,
      getConfiguredTimezone: mockGetConfiguredTimezone,
    });

    expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        notification: expect.objectContaining({
          title: expect.stringContaining("(+2 companions)"),
        }),
      })
    );
  });

  it("should handle requests without companions", async () => {
    const mockEvent = createMockEvent({
      status: "pending",
      requesterId: "user-1",
      requesterName: "Test User",
      companions: [],
    });

    const result = await handlePassRequestCreated(mockEvent, {
      db: mockDb,
      messaging: mockMessaging,
      getConfiguredTimezone: mockGetConfiguredTimezone,
    });

    expect(result).not.toBeNull();
    expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        notification: expect.objectContaining({
          title: expect.not.stringContaining("companion"),
        }),
      })
    );
  });

  it("should include destination in notification body", async () => {
    const mockEvent = createMockEvent({
      status: "pending",
      requesterId: "user-1",
      requesterName: "Test User",
      destination: "PX",
    });

    await handlePassRequestCreated(mockEvent, {
      db: mockDb,
      messaging: mockMessaging,
      getConfiguredTimezone: mockGetConfiguredTimezone,
    });

    expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        notification: expect.objectContaining({
          body: expect.stringContaining("Destination: PX"),
        }),
      })
    );
  });

  it("should handle requests with all optional fields", async () => {
    const mockEvent = createMockEvent({
      status: "pending",
      requesterId: "user-1",
      requesterName: "Test User",
      destination: "PX",
      expectedReturn: "2026-01-24T18:00:00Z",
      companions: [{ id: "user-2", name: "PFC Jones" }],
      notes: "Test notes",
    });

    const result = await handlePassRequestCreated(mockEvent, {
      db: mockDb,
      messaging: mockMessaging,
      getConfiguredTimezone: mockGetConfiguredTimezone,
    });

    expect(result).not.toBeNull();

    const callArg = mockMessaging.sendEachForMulticast.mock.calls[0][0];
    expect(callArg.notification.body).toContain("Destination: PX");
    expect(callArg.notification.body).toContain("Expected return:");
    expect(callArg.notification.body).toContain("With: PFC Jones");
    expect(callArg.notification.body).toContain("Notes: Test notes");
  });

  it("should include webpush actions for approve/reject", async () => {
    const mockEvent = createMockEvent({
      status: "pending",
      requesterId: "user-1",
      requesterName: "Test User",
    });

    await handlePassRequestCreated(mockEvent, {
      db: mockDb,
      messaging: mockMessaging,
      getConfiguredTimezone: mockGetConfiguredTimezone,
    });

    expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        webpush: expect.objectContaining({
          notification: expect.objectContaining({
            actions: expect.arrayContaining([
              expect.objectContaining({ action: "approve" }),
              expect.objectContaining({ action: "reject" }),
            ]),
          }),
        }),
      })
    );
  });

  it("should collect tokens from multiple leadership users", async () => {
    mockUsersSnapshot.forEach = vi.fn((callback) => {
      callback({
        id: "leadership-1",
        data: () => ({
          role: "candidate_leadership",
          fcmTokens: ["token-1", "token-2"],
        }),
        ref: { id: "leadership-1" },
      });
      callback({
        id: "leadership-2",
        data: () => ({
          role: "candidate_leadership",
          fcmTokens: ["token-3"],
        }),
        ref: { id: "leadership-2" },
      });
      callback({
        id: "admin-1",
        data: () => ({
          role: "admin",
          fcmTokens: ["token-4", "token-5"],
        }),
        ref: { id: "admin-1" },
      });
    });

    const mockEvent = createMockEvent({
      status: "pending",
      requesterId: "user-1",
      requesterName: "Test User",
    });

    await handlePassRequestCreated(mockEvent, {
      db: mockDb,
      messaging: mockMessaging,
      getConfiguredTimezone: mockGetConfiguredTimezone,
    });

    expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ["token-1", "token-2", "token-3", "token-4", "token-5"],
      })
    );
  });

  it("should handle messaging errors gracefully", async () => {
    mockMessaging.sendEachForMulticast = vi.fn(() =>
      Promise.reject(new Error("Messaging error"))
    );

    const mockEvent = createMockEvent({
      status: "pending",
      requesterId: "user-1",
      requesterName: "Test User",
    });

    const result = await handlePassRequestCreated(mockEvent, {
      db: mockDb,
      messaging: mockMessaging,
      getConfiguredTimezone: mockGetConfiguredTimezone,
    });

    expect(result).toBeNull();
  });

  it("should remove invalid tokens after send failure", async () => {
    mockMessaging.sendEachForMulticast = vi.fn(() =>
      Promise.resolve({
        successCount: 2,
        failureCount: 1,
        responses: [
          { success: true },
          { success: true },
          {
            success: false,
            error: { code: "messaging/invalid-registration-token" },
          },
        ],
      })
    );

    const mockEvent = createMockEvent({
      status: "pending",
      requesterId: "user-1",
      requesterName: "Test User",
    });

    await handlePassRequestCreated(mockEvent, {
      db: mockDb,
      messaging: mockMessaging,
      getConfiguredTimezone: mockGetConfiguredTimezone,
    });

    expect(mockBatch.update).toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
  });
});
