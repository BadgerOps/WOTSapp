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
  getDoc: vi.fn(() =>
    Promise.resolve({
      exists: () => true,
      data: () => ({
        status: "pending",
        requesterId: "test-user-id",
        requesterName: "Test User",
        requesterEmail: "user@example.com",
        location: "shoppette",
        destination: "Shoppette",
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
      email: "user@example.com",
    },
  }),
}));

// Import after mocks
import {
  LIBERTY_REQUEST_STATUS,
  LIBERTY_LOCATIONS,
  getNextWeekendDates,
  isBeforeDeadline,
  getDeadlineDate,
  getDeadlineDayName,
} from "./useLibertyRequests";

describe("LIBERTY_REQUEST_STATUS", () => {
  it("should have all required status types", () => {
    expect(LIBERTY_REQUEST_STATUS).toHaveProperty("pending");
    expect(LIBERTY_REQUEST_STATUS).toHaveProperty("approved");
    expect(LIBERTY_REQUEST_STATUS).toHaveProperty("rejected");
    expect(LIBERTY_REQUEST_STATUS).toHaveProperty("cancelled");
  });

  it("should have labels for each status", () => {
    expect(LIBERTY_REQUEST_STATUS.pending.label).toBe("Pending");
    expect(LIBERTY_REQUEST_STATUS.approved.label).toBe("Approved");
    expect(LIBERTY_REQUEST_STATUS.rejected.label).toBe("Rejected");
    expect(LIBERTY_REQUEST_STATUS.cancelled.label).toBe("Cancelled");
  });

  it("should have colors for each status", () => {
    expect(LIBERTY_REQUEST_STATUS.pending.color).toBe("yellow");
    expect(LIBERTY_REQUEST_STATUS.approved.color).toBe("green");
    expect(LIBERTY_REQUEST_STATUS.rejected.color).toBe("red");
    expect(LIBERTY_REQUEST_STATUS.cancelled.color).toBe("gray");
  });
});

describe("LIBERTY_LOCATIONS", () => {
  it("should have all expected locations", () => {
    const locationValues = LIBERTY_LOCATIONS.map((l) => l.value);
    expect(locationValues).toContain("shoppette");
    expect(locationValues).toContain("bx_commissary");
    expect(locationValues).toContain("gym");
    expect(locationValues).toContain("library");
    expect(locationValues).toContain("other");
  });

  it("should have labels for each location", () => {
    LIBERTY_LOCATIONS.forEach((loc) => {
      expect(loc).toHaveProperty("value");
      expect(loc).toHaveProperty("label");
      expect(typeof loc.label).toBe("string");
    });
  });
});

describe("getNextWeekendDates", () => {
  it("should return saturday and sunday dates", () => {
    const { saturday, sunday } = getNextWeekendDates();
    expect(saturday).toBeInstanceOf(Date);
    expect(sunday).toBeInstanceOf(Date);
    expect(saturday.getDay()).toBe(6); // Saturday
    expect(sunday.getDay()).toBe(0); // Sunday
  });

  it("should have sunday one day after saturday", () => {
    const { saturday, sunday } = getNextWeekendDates();
    const diff = sunday.getTime() - saturday.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    expect(diff).toBe(oneDayMs);
  });
});

describe("getDeadlineDayName", () => {
  it("should return correct day names", () => {
    expect(getDeadlineDayName(0)).toBe("Sunday");
    expect(getDeadlineDayName(1)).toBe("Monday");
    expect(getDeadlineDayName(2)).toBe("Tuesday");
    expect(getDeadlineDayName(3)).toBe("Wednesday");
    expect(getDeadlineDayName(4)).toBe("Thursday");
    expect(getDeadlineDayName(5)).toBe("Friday");
    expect(getDeadlineDayName(6)).toBe("Saturday");
  });

  it("should default to Tuesday for undefined", () => {
    expect(getDeadlineDayName(undefined)).toBe("Tuesday");
    expect(getDeadlineDayName(null)).toBe("Tuesday");
  });
});

describe("usePendingLibertyRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with loading state", async () => {
    const { onSnapshot } = await import("firebase/firestore");

    onSnapshot.mockImplementation(() => vi.fn());

    const { usePendingLibertyRequests } = await import("./useLibertyRequests");
    const { result } = renderHook(() => usePendingLibertyRequests());

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
          destination: "Shoppette",
          status: "pending",
        }),
      },
    ];

    onSnapshot.mockImplementation((q, success) => {
      success({ docs: mockDocs });
      return vi.fn();
    });

    const { usePendingLibertyRequests } = await import("./useLibertyRequests");
    const { result } = renderHook(() => usePendingLibertyRequests());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.requests).toHaveLength(1);
      expect(result.current.requests[0].id).toBe("request-1");
    });
  });
});

describe("useLibertyRequestActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a liberty request successfully", async () => {
    const { addDoc, getDocs } = await import("firebase/firestore");

    getDocs.mockResolvedValue({ empty: true, docs: [] });
    addDoc.mockResolvedValue({ id: "new-request-id" });

    const { useLibertyRequestActions } = await import("./useLibertyRequests");
    const { result } = renderHook(() => useLibertyRequestActions());

    await act(async () => {
      const response = await result.current.createLibertyRequest({
        location: "shoppette",
        departureDate: "2026-02-07",
        departureTime: "10:00",
        returnDate: "2026-02-07",
        returnTime: "14:00",
        contactNumber: "555-0100",
        purpose: "Shopping",
        weekendDate: "2026-02-07",
      });
      expect(response.success).toBe(true);
      expect(response.requestId).toBe("new-request-id");
    });

    expect(addDoc).toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });
});

describe("useLeaveAdminActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a liberty request for another user (approved)", async () => {
    const { addDoc, getDoc } = await import("firebase/firestore");

    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        firstName: "Admin",
        lastName: "User",
      }),
    });

    addDoc.mockResolvedValue({ id: "new-request-id" });

    const { useLeaveAdminActions } = await import("./useLibertyRequests");
    const { result } = renderHook(() => useLeaveAdminActions());

    await act(async () => {
      const response = await result.current.createLibertyRequestForUser({
        targetUserId: "target-user-id",
        targetUserName: "Target User",
        targetUserEmail: "target@example.com",
        location: "shoppette",
        departureDate: "2026-02-07",
        departureTime: "10:00",
        returnDate: "2026-02-07",
        returnTime: "14:00",
        contactNumber: "555-0100",
        purpose: "Shopping",
        weekendDate: "2026-02-07",
        status: "approved",
      });
      expect(response.success).toBe(true);
      expect(response.requestId).toBe("new-request-id");
    });

    expect(addDoc).toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should create a liberty request for another user (pending)", async () => {
    const { addDoc, getDoc } = await import("firebase/firestore");

    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        firstName: "Admin",
        lastName: "User",
      }),
    });

    addDoc.mockResolvedValue({ id: "pending-request-id" });

    const { useLeaveAdminActions } = await import("./useLibertyRequests");
    const { result } = renderHook(() => useLeaveAdminActions());

    await act(async () => {
      const response = await result.current.createLibertyRequestForUser({
        targetUserId: "target-user-id",
        targetUserName: "Target User",
        targetUserEmail: "target@example.com",
        location: "gym",
        weekendDate: "2026-02-07",
        status: "pending",
      });
      expect(response.success).toBe(true);
      expect(response.requestId).toBe("pending-request-id");
    });

    expect(addDoc).toHaveBeenCalled();
  });

  it("should handle errors when creating liberty request for user", async () => {
    const { addDoc, getDoc } = await import("firebase/firestore");

    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        firstName: "Admin",
        lastName: "User",
      }),
    });

    addDoc.mockRejectedValue(new Error("Permission denied"));

    const { useLeaveAdminActions } = await import("./useLibertyRequests");
    const { result } = renderHook(() => useLeaveAdminActions());

    await act(async () => {
      try {
        await result.current.createLibertyRequestForUser({
          targetUserId: "target-user-id",
          targetUserName: "Target User",
          targetUserEmail: "target@example.com",
          location: "shoppette",
          weekendDate: "2026-02-07",
        });
      } catch (err) {
        expect(err.message).toBe("Permission denied");
      }
    });

    expect(result.current.error).toBe("Permission denied");
  });

  it("should include createdOnBehalfOf flag in request data", async () => {
    const { addDoc, getDoc } = await import("firebase/firestore");

    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        firstName: "Admin",
        lastName: "User",
      }),
    });

    addDoc.mockResolvedValue({ id: "new-request-id" });

    const { useLeaveAdminActions } = await import("./useLibertyRequests");
    const { result } = renderHook(() => useLeaveAdminActions());

    await act(async () => {
      await result.current.createLibertyRequestForUser({
        targetUserId: "target-user-id",
        targetUserName: "Target User",
        targetUserEmail: "target@example.com",
        location: "library",
        weekendDate: "2026-02-07",
      });
    });

    // Verify addDoc was called with correct data
    expect(addDoc).toHaveBeenCalled();
    const callArgs = addDoc.mock.calls[0][1];
    expect(callArgs.createdOnBehalfOf).toBe(true);
    expect(callArgs.createdByAdminId).toBe("test-user-id");
    expect(callArgs.requesterId).toBe("target-user-id");
  });
});

describe("usePendingLibertyRequestCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return correct count", async () => {
    const { onSnapshot } = await import("firebase/firestore");

    onSnapshot.mockImplementation((q, success) => {
      success({ size: 3 });
      return vi.fn();
    });

    const { usePendingLibertyRequestCount } = await import("./useLibertyRequests");
    const { result } = renderHook(() => usePendingLibertyRequestCount());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.count).toBe(3);
    });
  });
});
