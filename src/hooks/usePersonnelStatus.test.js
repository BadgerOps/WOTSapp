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
  setDoc: vi.fn(),
  addDoc: vi.fn(),
  serverTimestamp: vi.fn(() => "timestamp"),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
  getDoc: vi.fn(() =>
    Promise.resolve({
      exists: () => true,
      data: () => ({ status: "present" }),
    }),
  ),
}));

vi.mock("../config/firebase", () => ({
  db: {},
}));

vi.mock("./usePersonnel", () => ({
  usePersonnel: () => ({
    personnel: [],
    loading: false,
    error: null,
  }),
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
import { STATUS_TYPES } from "./usePersonnelStatus";

describe("STATUS_TYPES", () => {
  it("should have all required status types", () => {
    expect(STATUS_TYPES).toHaveProperty("present");
    expect(STATUS_TYPES).toHaveProperty("pass");
    // expect(STATUS_TYPES).toHaveProperty('leave')
    // expect(STATUS_TYPES).toHaveProperty('tdy')
    expect(STATUS_TYPES).toHaveProperty("sick_call");
  });

  it("should have labels for each status", () => {
    expect(STATUS_TYPES.present.label).toBe("Present");
    expect(STATUS_TYPES.pass.label).toBe("Pass");
    // expect(STATUS_TYPES.leave.label).toBe("Leave");
    // expect(STATUS_TYPES.tdy.label).toBe("TDY");
    expect(STATUS_TYPES.sick_call.label).toBe("Sick Call");
  });

  it("should have colors for each status", () => {
    expect(STATUS_TYPES.present.color).toBe("green");
    expect(STATUS_TYPES.pass.color).toBe("yellow");
    // expect(STATUS_TYPES.leave.color).toBe("blue");
    // expect(STATUS_TYPES.tdy.color).toBe("purple");
    expect(STATUS_TYPES.sick_call.color).toBe("orange");
  });
});
