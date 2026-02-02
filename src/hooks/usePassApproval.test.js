import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// Mock all dependencies before importing the module
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => vi.fn()),
  doc: vi.fn(() => ({})),
  addDoc: vi.fn(() => Promise.resolve({ id: "test-request-id" })),
  updateDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => "timestamp"),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
  getDoc: vi.fn(() =>
    Promise.resolve({
      exists: () => true,
      data: () => ({
        status: "pending",
        requesterId: "test-user-id",
        requesterName: "Test User",
        requesterEmail: "user11@example.com",
        destination: "PX",
        expectedReturn: "2026-01-24T18:00:00Z",
        companions: [],
      }),
    })
  ),
  getDocs: vi.fn(() =>
    Promise.resolve({
      empty: true,
      docs: [],
    })
  ),
}));

vi.mock("../config/firebase", () => ({
  db: {},
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      uid: "test-user-id",
      displayName: "Test User",
      email: "user11@example.com",
    },
  }),
}));

// Import after mocks
import { PASS_REQUEST_STATUS } from "./usePassApproval";

describe("PASS_REQUEST_STATUS", () => {
  it("should have all required status types", () => {
    expect(PASS_REQUEST_STATUS).toHaveProperty("pending");
    expect(PASS_REQUEST_STATUS).toHaveProperty("approved");
    expect(PASS_REQUEST_STATUS).toHaveProperty("rejected");
    expect(PASS_REQUEST_STATUS).toHaveProperty("expired");
  });

  it("should have labels for each status", () => {
    expect(PASS_REQUEST_STATUS.pending.label).toBe("Pending");
    expect(PASS_REQUEST_STATUS.approved.label).toBe("Approved");
    expect(PASS_REQUEST_STATUS.rejected.label).toBe("Rejected");
    expect(PASS_REQUEST_STATUS.expired.label).toBe("Expired");
  });

  it("should have colors for each status", () => {
    expect(PASS_REQUEST_STATUS.pending.color).toBe("yellow");
    expect(PASS_REQUEST_STATUS.approved.color).toBe("green");
    expect(PASS_REQUEST_STATUS.rejected.color).toBe("red");
    expect(PASS_REQUEST_STATUS.expired.color).toBe("gray");
  });
});

describe("usePendingPassRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with loading state", async () => {
    const { onSnapshot } = await import("firebase/firestore");

    // Mock onSnapshot to simulate loading
    onSnapshot.mockImplementation(() => vi.fn());

    const { usePendingPassRequests } = await import("./usePassApproval");
    const { result } = renderHook(() => usePendingPassRequests());

    expect(result.current.loading).toBe(true);
    expect(result.current.requests).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("should set requests when snapshot returns data", async () => {
    const { onSnapshot } = await import("firebase/firestore");

    const mockDocs = [
      {
        id: "request-1",
        data: () => ({
          requesterId: "user-1",
          requesterName: "User One",
          destination: "PX",
          status: "pending",
        }),
      },
      {
        id: "request-2",
        data: () => ({
          requesterId: "user-2",
          requesterName: "User Two",
          destination: "DFAC",
          status: "pending",
        }),
      },
    ];

    onSnapshot.mockImplementation((q, success, error) => {
      success({ docs: mockDocs });
      return vi.fn();
    });

    const { usePendingPassRequests } = await import("./usePassApproval");
    const { result } = renderHook(() => usePendingPassRequests());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.requests).toHaveLength(2);
      expect(result.current.requests[0].id).toBe("request-1");
      expect(result.current.requests[1].id).toBe("request-2");
    });
  });

  it("should handle snapshot errors", async () => {
    const { onSnapshot } = await import("firebase/firestore");

    onSnapshot.mockImplementation((q, success, errorCallback) => {
      errorCallback(new Error("Test error"));
      return vi.fn();
    });

    const { usePendingPassRequests } = await import("./usePassApproval");
    const { result } = renderHook(() => usePendingPassRequests());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe("Test error");
    });
  });
});

describe("usePassRequestActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a pass request successfully", async () => {
    const { addDoc } = await import("firebase/firestore");

    addDoc.mockResolvedValue({ id: "new-request-id" });

    const { usePassRequestActions } = await import("./usePassApproval");
    const { result } = renderHook(() => usePassRequestActions());

    await act(async () => {
      const response = await result.current.createPassRequest({
        destination: "BX",
        expectedReturn: "2026-01-24T20:00:00Z",
        contactNumber: "555-0100",
        notes: "Test notes",
        companions: [],
      });
      expect(response.success).toBe(true);
      expect(response.requestId).toBe("new-request-id");
    });

    expect(addDoc).toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle create request errors", async () => {
    const { addDoc } = await import("firebase/firestore");

    addDoc.mockRejectedValue(new Error("Create failed"));

    const { usePassRequestActions } = await import("./usePassApproval");
    const { result } = renderHook(() => usePassRequestActions());

    await act(async () => {
      try {
        await result.current.createPassRequest({
          destination: "BX",
        });
      } catch (err) {
        expect(err.message).toBe("Create failed");
      }
    });

    expect(result.current.error).toBe("Create failed");
  });
});

describe("usePassApprovalActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should approve a request successfully", async () => {
    const { getDoc, writeBatch } = await import("firebase/firestore");

    const mockBatch = {
      set: vi.fn(),
      update: vi.fn(),
      commit: vi.fn(() => Promise.resolve()),
    };
    writeBatch.mockReturnValue(mockBatch);

    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        status: "pending",
        requesterId: "user-1",
        requesterName: "Test User",
        requesterEmail: "user11@example.com",
        destination: "PX",
        companions: [],
      }),
    }).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        firstName: "Test",
        lastName: "Approver",
      }),
    });

    const { usePassApprovalActions } = await import("./usePassApproval");
    const { result } = renderHook(() => usePassApprovalActions());

    await act(async () => {
      const response = await result.current.approveRequest("request-1");
      expect(response.success).toBe(true);
    });

    expect(mockBatch.update).toHaveBeenCalled();
    expect(mockBatch.set).toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  it("should reject a request successfully", async () => {
    const { getDoc, updateDoc } = await import("firebase/firestore");

    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        status: "pending",
        requesterId: "user-1",
      }),
    });

    updateDoc.mockResolvedValue();

    const { usePassApprovalActions } = await import("./usePassApproval");
    const { result } = renderHook(() => usePassApprovalActions());

    await act(async () => {
      const response = await result.current.rejectRequest(
        "request-1",
        "Formation at 1600"
      );
      expect(response.success).toBe(true);
    });

    expect(updateDoc).toHaveBeenCalled();
  });

  it("should throw error when request not found", async () => {
    const { getDoc } = await import("firebase/firestore");

    getDoc.mockResolvedValue({
      exists: () => false,
    });

    const { usePassApprovalActions } = await import("./usePassApproval");
    const { result } = renderHook(() => usePassApprovalActions());

    await act(async () => {
      try {
        await result.current.approveRequest("non-existent");
      } catch (err) {
        expect(err.message).toBe("Request not found");
      }
    });
  });

  it("should throw error when request is not pending", async () => {
    const { getDoc } = await import("firebase/firestore");

    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        status: "approved", // Already approved
        requesterId: "user-1",
      }),
    });

    const { usePassApprovalActions } = await import("./usePassApproval");
    const { result } = renderHook(() => usePassApprovalActions());

    await act(async () => {
      try {
        await result.current.approveRequest("request-1");
      } catch (err) {
        expect(err.message).toBe("Request is no longer pending");
      }
    });
  });
});

describe("usePendingPassRequestCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return correct count", async () => {
    const { onSnapshot } = await import("firebase/firestore");

    onSnapshot.mockImplementation((q, success) => {
      success({ size: 5 });
      return vi.fn();
    });

    const { usePendingPassRequestCount } = await import("./usePassApproval");
    const { result } = renderHook(() => usePendingPassRequestCount());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.count).toBe(5);
    });
  });
});

describe("usePassAdminActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a pass request for another user with auto-approve", async () => {
    const { getDoc, writeBatch } = await import("firebase/firestore");

    const mockBatch = {
      set: vi.fn(),
      update: vi.fn(),
      commit: vi.fn(() => Promise.resolve()),
    };
    writeBatch.mockReturnValue(mockBatch);

    // Mock getDoc for personnel lookup
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        firstName: "Admin",
        lastName: "User",
      }),
    });

    const { usePassAdminActions } = await import("./usePassApproval");
    const { result } = renderHook(() => usePassAdminActions());

    await act(async () => {
      const response = await result.current.createPassRequestForUser({
        targetUserId: "target-user-id",
        targetUserName: "Target User",
        targetUserEmail: "target@example.com",
        destination: "BX",
        expectedReturn: "2026-01-24T20:00:00Z",
        contactNumber: "555-0100",
        notes: "Created by admin",
        companions: [],
        autoApprove: true,
      });
      expect(response.success).toBe(true);
      expect(response.autoApproved).toBe(true);
    });

    // Should use batch for auto-approve (creates multiple docs)
    expect(mockBatch.set).toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should create a pass request for another user without auto-approve", async () => {
    const { getDoc, addDoc } = await import("firebase/firestore");

    // Mock getDoc for personnel lookup
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        firstName: "Admin",
        lastName: "User",
      }),
    });

    addDoc.mockResolvedValue({ id: "new-request-id" });

    const { usePassAdminActions } = await import("./usePassApproval");
    const { result } = renderHook(() => usePassAdminActions());

    await act(async () => {
      const response = await result.current.createPassRequestForUser({
        targetUserId: "target-user-id",
        targetUserName: "Target User",
        targetUserEmail: "target@example.com",
        destination: "BX",
        autoApprove: false,
      });
      expect(response.success).toBe(true);
      expect(response.autoApproved).toBe(false);
      expect(response.requestId).toBe("new-request-id");
    });

    expect(addDoc).toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("should handle errors when creating pass request for user", async () => {
    const { getDoc, writeBatch } = await import("firebase/firestore");

    const mockBatch = {
      set: vi.fn(),
      update: vi.fn(),
      commit: vi.fn(() => Promise.reject(new Error("Permission denied"))),
    };
    writeBatch.mockReturnValue(mockBatch);

    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        firstName: "Admin",
        lastName: "User",
      }),
    });

    const { usePassAdminActions } = await import("./usePassApproval");
    const { result } = renderHook(() => usePassAdminActions());

    await act(async () => {
      try {
        await result.current.createPassRequestForUser({
          targetUserId: "target-user-id",
          targetUserName: "Target User",
          targetUserEmail: "target@example.com",
          destination: "BX",
          autoApprove: true,
        });
      } catch (err) {
        expect(err.message).toBe("Permission denied");
      }
    });

    expect(result.current.error).toBe("Permission denied");
  });
});
