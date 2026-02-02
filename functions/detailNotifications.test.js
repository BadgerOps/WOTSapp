/**
 * Unit tests for detailNotifications Cloud Function
 * Tests for daily detail reset and notification logic
 *
 * To run: npx vitest functions/detailNotifications.test.js
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Firebase dependencies before importing the module
vi.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: vi.fn((opts, handler) => handler),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(),
}));

vi.mock("firebase-admin/messaging", () => ({
  getMessaging: vi.fn(),
}));

vi.mock("./utils/timezone", () => ({
  getConfiguredTimezone: vi.fn(() => Promise.resolve("America/New_York")),
  getCurrentTimeInTimezone: vi.fn(() => "07:00"),
  getTodayInTimezone: vi.fn(() => "2026-02-02"),
}));

vi.mock("./utils/sentry", () => ({
  wrapScheduled: vi.fn((fn) => fn),
  addBreadcrumb: vi.fn(),
}));

const {
  resetAssignmentForNewDay,
  resetExistingAssignments,
  getAssignmentsToReset,
  cloneAssignmentForDate,
  getMostRecentCompletedAssignment,
  hasAssignmentForToday,
  sendDetailReminders,
} = require("./detailNotifications");

describe("resetAssignmentForNewDay", () => {
  let mockDb;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          update: vi.fn(() => Promise.resolve()),
        })),
      })),
    };
  });

  it("should reset all tasks to uncompleted", async () => {
    const assignmentData = {
      status: "in_progress",
      tasks: [
        { taskId: "task-1", taskText: "Clean floor", completed: true, completedAt: "2026-02-01T10:00:00Z" },
        { taskId: "task-2", taskText: "Wipe tables", completed: true, completedAt: "2026-02-01T10:05:00Z" },
        { taskId: "task-3", taskText: "Empty trash", completed: false, completedAt: null },
      ],
    };

    const updateMock = vi.fn(() => Promise.resolve());
    mockDb.collection = vi.fn(() => ({
      doc: vi.fn(() => ({
        update: updateMock,
      })),
    }));

    const result = await resetAssignmentForNewDay(mockDb, "assignment-1", assignmentData);

    expect(result.wasReset).toBe(true);
    expect(result.previousStatus).toBe("in_progress");

    // Verify the update was called with reset tasks
    expect(updateMock).toHaveBeenCalled();
    const updateArgs = updateMock.mock.calls[0][0];

    expect(updateArgs.status).toBe("assigned");
    expect(updateArgs.tasks).toHaveLength(3);
    expect(updateArgs.tasks.every((t) => t.completed === false)).toBe(true);
    expect(updateArgs.tasks.every((t) => t.completedAt === null)).toBe(true);
    expect(updateArgs.startedAt).toBeNull();
    expect(updateArgs.completedAt).toBeNull();
  });

  it("should reset rejected assignments to assigned status", async () => {
    const assignmentData = {
      status: "rejected",
      rejectionReason: "Some areas missed",
      tasks: [
        { taskId: "task-1", completed: true },
      ],
    };

    const updateMock = vi.fn(() => Promise.resolve());
    mockDb.collection = vi.fn(() => ({
      doc: vi.fn(() => ({
        update: updateMock,
      })),
    }));

    const result = await resetAssignmentForNewDay(mockDb, "assignment-1", assignmentData);

    expect(result.wasReset).toBe(true);
    expect(result.previousStatus).toBe("rejected");

    const updateArgs = updateMock.mock.calls[0][0];
    expect(updateArgs.status).toBe("assigned");
    expect(updateArgs.rejectionReason).toBeNull();
    expect(updateArgs.rejectedAt).toBeNull();
  });

  it("should clear all completion-related fields", async () => {
    const assignmentData = {
      status: "in_progress",
      startedAt: new Date(),
      startedBy: "user-1",
      completionNotes: "All done",
      tasks: [],
    };

    const updateMock = vi.fn(() => Promise.resolve());
    mockDb.collection = vi.fn(() => ({
      doc: vi.fn(() => ({
        update: updateMock,
      })),
    }));

    await resetAssignmentForNewDay(mockDb, "assignment-1", assignmentData);

    const updateArgs = updateMock.mock.calls[0][0];
    expect(updateArgs.startedAt).toBeNull();
    expect(updateArgs.startedBy).toBeNull();
    expect(updateArgs.completedAt).toBeNull();
    expect(updateArgs.completedBy).toBeNull();
    expect(updateArgs.completionNotes).toBeNull();
    expect(updateArgs.lastResetAt).toBeInstanceOf(Date);
  });

  it("should preserve task assignment info while resetting completion", async () => {
    const assignmentData = {
      status: "in_progress",
      tasks: [
        {
          taskId: "task-1",
          taskText: "Clean floor",
          areaName: "Kitchen",
          location: "Building A",
          assignedTo: { personnelId: "user-1", name: "John Doe", rank: "SGT" },
          completed: true,
          completedAt: "2026-02-01T10:00:00Z",
          notes: "Done well",
        },
      ],
    };

    const updateMock = vi.fn(() => Promise.resolve());
    mockDb.collection = vi.fn(() => ({
      doc: vi.fn(() => ({
        update: updateMock,
      })),
    }));

    await resetAssignmentForNewDay(mockDb, "assignment-1", assignmentData);

    const updateArgs = updateMock.mock.calls[0][0];
    const resetTask = updateArgs.tasks[0];

    // Should preserve these fields
    expect(resetTask.taskId).toBe("task-1");
    expect(resetTask.taskText).toBe("Clean floor");
    expect(resetTask.areaName).toBe("Kitchen");
    expect(resetTask.location).toBe("Building A");
    expect(resetTask.assignedTo.personnelId).toBe("user-1");
    expect(resetTask.assignedTo.name).toBe("John Doe");

    // Should reset these fields
    expect(resetTask.completed).toBe(false);
    expect(resetTask.completedAt).toBeNull();
    expect(resetTask.notes).toBe("");
  });
});

describe("getAssignmentsToReset", () => {
  let mockDb;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return assignments matching the time slot", async () => {
    const mockDocs = [
      { id: "a1", data: () => ({ timeSlot: "morning", status: "assigned" }) },
      { id: "a2", data: () => ({ timeSlot: "evening", status: "assigned" }) },
      { id: "a3", data: () => ({ timeSlot: "both", status: "in_progress" }) },
      { id: "a4", data: () => ({ timeSlot: "morning", status: "approved" }) },
    ];

    mockDb = {
      collection: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ docs: mockDocs })),
        })),
      })),
    };

    const result = await getAssignmentsToReset(mockDb, "2026-02-02", "morning");

    // Should return morning and both time slots (regardless of status)
    expect(result).toHaveLength(3);
    expect(result.map((d) => d.id)).toContain("a1");
    expect(result.map((d) => d.id)).toContain("a3");
    expect(result.map((d) => d.id)).toContain("a4");
    expect(result.map((d) => d.id)).not.toContain("a2");
  });

  it("should filter by today's date only (not by status)", async () => {
    mockDb = {
      collection: vi.fn(() => ({
        where: vi.fn((field, op, value) => {
          // Verify we only filter by date, not by status
          expect(field).toBe("assignmentDate");
          expect(value).toBe("2026-02-02");
          return {
            get: vi.fn(() => Promise.resolve({ docs: [] })),
          };
        }),
      })),
    };

    await getAssignmentsToReset(mockDb, "2026-02-02", "morning");

    expect(mockDb.collection).toHaveBeenCalledWith("detailAssignments");
  });
});

describe("resetExistingAssignments", () => {
  let mockDb;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reset multiple assignments", async () => {
    const updateMock = vi.fn(() => Promise.resolve());
    const mockDocs = [
      { id: "a1", data: () => ({ timeSlot: "morning", status: "assigned", tasks: [] }) },
      { id: "a2", data: () => ({ timeSlot: "morning", status: "in_progress", tasks: [] }) },
    ];

    mockDb = {
      collection: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ docs: mockDocs })),
        })),
        doc: vi.fn(() => ({
          update: updateMock,
        })),
      })),
    };

    const results = await resetExistingAssignments(mockDb, "2026-02-02", "morning");

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.wasReset)).toBe(true);
    expect(updateMock).toHaveBeenCalledTimes(2);
  });

  it("should return empty array when no assignments to reset", async () => {
    mockDb = {
      collection: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ docs: [] })),
        })),
      })),
    };

    const results = await resetExistingAssignments(mockDb, "2026-02-02", "morning");

    expect(results).toHaveLength(0);
  });

  it("should handle errors gracefully and continue with other assignments", async () => {
    const updateMock = vi.fn()
      .mockRejectedValueOnce(new Error("Update failed"))
      .mockResolvedValueOnce();

    const mockDocs = [
      { id: "a1", data: () => ({ timeSlot: "morning", status: "assigned", tasks: [] }) },
      { id: "a2", data: () => ({ timeSlot: "morning", status: "assigned", tasks: [] }) },
    ];

    mockDb = {
      collection: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ docs: mockDocs })),
        })),
        doc: vi.fn(() => ({
          update: updateMock,
        })),
      })),
    };

    const results = await resetExistingAssignments(mockDb, "2026-02-02", "morning");

    expect(results).toHaveLength(2);
    expect(results[0].wasReset).toBe(false);
    expect(results[0].error).toBe("Update failed");
    expect(results[1].wasReset).toBe(true);
  });
});

describe("hasAssignmentForToday", () => {
  let mockDb;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when assignment exists for time slot", async () => {
    const mockDocs = [
      { id: "a1", data: () => ({ timeSlot: "morning" }) },
    ];

    mockDb = {
      collection: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ docs: mockDocs })),
        })),
      })),
    };

    const result = await hasAssignmentForToday(mockDb, "2026-02-02", "morning");
    expect(result).toBe(true);
  });

  it("should return true when 'both' time slot exists", async () => {
    const mockDocs = [
      { id: "a1", data: () => ({ timeSlot: "both" }) },
    ];

    mockDb = {
      collection: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ docs: mockDocs })),
        })),
      })),
    };

    const result = await hasAssignmentForToday(mockDb, "2026-02-02", "evening");
    expect(result).toBe(true);
  });

  it("should return false when no matching assignment exists", async () => {
    const mockDocs = [
      { id: "a1", data: () => ({ timeSlot: "morning" }) },
    ];

    mockDb = {
      collection: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({ docs: mockDocs })),
        })),
      })),
    };

    const result = await hasAssignmentForToday(mockDb, "2026-02-02", "evening");
    expect(result).toBe(false);
  });
});

describe("getMostRecentCompletedAssignment", () => {
  let mockDb;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return most recent completed assignment for time slot", async () => {
    const mockDocs = [
      { id: "a1", data: () => ({ timeSlot: "morning", status: "approved", templateName: "Cleaning" }) },
      { id: "a2", data: () => ({ timeSlot: "evening", status: "approved", templateName: "Night Clean" }) },
    ];

    mockDb = {
      collection: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(() => Promise.resolve({ docs: mockDocs })),
            })),
          })),
        })),
      })),
    };

    const result = await getMostRecentCompletedAssignment(mockDb, "morning");

    expect(result).not.toBeNull();
    expect(result.id).toBe("a1");
    expect(result.templateName).toBe("Cleaning");
  });

  it("should return null when no completed assignments exist", async () => {
    mockDb = {
      collection: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(() => Promise.resolve({ docs: [] })),
            })),
          })),
        })),
      })),
    };

    const result = await getMostRecentCompletedAssignment(mockDb, "morning");
    expect(result).toBeNull();
  });

  it("should match 'both' time slot assignments", async () => {
    const mockDocs = [
      { id: "a1", data: () => ({ timeSlot: "both", status: "approved" }) },
    ];

    mockDb = {
      collection: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(() => Promise.resolve({ docs: mockDocs })),
            })),
          })),
        })),
      })),
    };

    const result = await getMostRecentCompletedAssignment(mockDb, "evening");

    expect(result).not.toBeNull();
    expect(result.id).toBe("a1");
  });
});

describe("cloneAssignmentForDate", () => {
  let mockDb;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new assignment with reset tasks", async () => {
    const addMock = vi.fn(() => Promise.resolve({ id: "new-assignment-1" }));

    mockDb = {
      collection: vi.fn(() => ({
        add: addMock,
      })),
    };

    const sourceAssignment = {
      id: "source-1",
      templateId: "template-1",
      templateName: "Daily Cleaning",
      timeSlot: "morning",
      morningTime: "08:00",
      eveningTime: "18:00",
      tasks: [
        { taskId: "t1", taskText: "Clean floor", completed: true, completedAt: "2026-02-01T10:00:00Z" },
        { taskId: "t2", taskText: "Wipe tables", completed: true, completedAt: "2026-02-01T10:05:00Z" },
      ],
      assignedTo: [{ personnelId: "user-1", name: "John Doe" }],
    };

    const newId = await cloneAssignmentForDate(mockDb, sourceAssignment, "2026-02-02", "morning");

    expect(newId).toBe("new-assignment-1");
    expect(addMock).toHaveBeenCalled();

    const addedDoc = addMock.mock.calls[0][0];

    // Verify reset state
    expect(addedDoc.status).toBe("assigned");
    expect(addedDoc.assignmentDate).toBe("2026-02-02");
    expect(addedDoc.clonedFrom).toBe("source-1");

    // Verify tasks are reset
    expect(addedDoc.tasks).toHaveLength(2);
    expect(addedDoc.tasks.every((t) => t.completed === false)).toBe(true);
    expect(addedDoc.tasks.every((t) => t.completedAt === null)).toBe(true);

    // Verify completion fields are cleared
    expect(addedDoc.startedAt).toBeNull();
    expect(addedDoc.completedAt).toBeNull();
    expect(addedDoc.approvedAt).toBeNull();
  });

  it("should preserve assignedTo from source", async () => {
    const addMock = vi.fn(() => Promise.resolve({ id: "new-1" }));

    mockDb = {
      collection: vi.fn(() => ({
        add: addMock,
      })),
    };

    const sourceAssignment = {
      id: "source-1",
      templateId: "t1",
      templateName: "Clean",
      tasks: [],
      assignedTo: [
        { personnelId: "user-1", name: "John Doe", rank: "SGT" },
        { personnelId: "user-2", name: "Jane Smith", rank: "PFC" },
      ],
    };

    await cloneAssignmentForDate(mockDb, sourceAssignment, "2026-02-02", "morning");

    const addedDoc = addMock.mock.calls[0][0];
    expect(addedDoc.assignedTo).toHaveLength(2);
    expect(addedDoc.assignedTo[0].personnelId).toBe("user-1");
  });
});

describe("sendDetailReminders integration", () => {
  let mockDb;
  let mockMessaging;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock messaging
    mockMessaging = {
      sendEachForMulticast: vi.fn(() =>
        Promise.resolve({
          successCount: 1,
          failureCount: 0,
          responses: [{ success: true }],
        })
      ),
    };
  });

  it("should reset existing assignments before processing", async () => {
    const updateMock = vi.fn(() => Promise.resolve());

    // Mock assignment docs
    const mockAssignmentDocs = [
      {
        id: "a1",
        data: () => ({
          timeSlot: "morning",
          status: "in_progress",
          templateName: "Daily Clean",
          tasks: [
            { taskId: "t1", completed: true, assignedTo: { personnelId: "user-1" } },
          ],
        }),
      },
    ];

    // Mock user docs with forEach method
    const mockUserDocs = [
      {
        id: "user-1",
        data: () => ({ fcmTokens: ["token-1"] }),
        ref: { id: "user-1" },
      },
    ];
    const mockUsersSnapshot = {
      docs: mockUserDocs,
      forEach: vi.fn((callback) => {
        mockUserDocs.forEach(callback);
      }),
    };

    mockDb = {
      collection: vi.fn((collectionName) => {
        if (collectionName === "detailAssignments") {
          return {
            where: vi.fn(() => ({
              // Support single where (getAssignmentsToReset) and chained where (getTodaysAssignments)
              where: vi.fn(() => ({
                get: vi.fn(() => Promise.resolve({ docs: mockAssignmentDocs })),
              })),
              get: vi.fn(() => Promise.resolve({ docs: mockAssignmentDocs })),
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => ({
                  get: vi.fn(() => Promise.resolve({ docs: [] })),
                })),
              })),
            })),
            doc: vi.fn(() => ({
              update: updateMock,
            })),
          };
        }
        if (collectionName === "users") {
          return {
            where: vi.fn(() => ({
              get: vi.fn(() => Promise.resolve(mockUsersSnapshot)),
            })),
          };
        }
        if (collectionName === "personnel") {
          return {
            where: vi.fn(() => ({
              get: vi.fn(() => Promise.resolve({ docs: [] })),
            })),
          };
        }
        return {
          where: vi.fn(() => ({
            get: vi.fn(() => Promise.resolve({ docs: [] })),
          })),
        };
      }),
    };

    const result = await sendDetailReminders(mockDb, mockMessaging, "morning", "America/New_York");

    // Should have reset the existing assignment
    expect(updateMock).toHaveBeenCalled();
    expect(result.resetResults).toBeDefined();
  });

  it("should include resetResults in return value", async () => {
    const mockAssignmentDocs = [
      {
        id: "a1",
        data: () => ({
          timeSlot: "morning",
          status: "assigned",
          templateName: "Daily Clean",
          tasks: [{ taskId: "t1", assignedTo: { personnelId: "user-1" } }],
        }),
      },
    ];

    // Mock user docs with forEach method
    const mockUserDocs = [
      {
        id: "user-1",
        data: () => ({ fcmTokens: ["token-1"] }),
        ref: { id: "user-1" },
      },
    ];
    const mockUsersSnapshot = {
      docs: mockUserDocs,
      forEach: vi.fn((callback) => {
        mockUserDocs.forEach(callback);
      }),
    };

    mockDb = {
      collection: vi.fn((collectionName) => {
        if (collectionName === "detailAssignments") {
          return {
            where: vi.fn(() => ({
              // Support single where (getAssignmentsToReset) and chained where (getTodaysAssignments)
              where: vi.fn(() => ({
                get: vi.fn(() => Promise.resolve({ docs: mockAssignmentDocs })),
              })),
              get: vi.fn(() => Promise.resolve({ docs: mockAssignmentDocs })),
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => ({
                  get: vi.fn(() => Promise.resolve({ docs: [] })),
                })),
              })),
            })),
            doc: vi.fn(() => ({
              update: vi.fn(() => Promise.resolve()),
            })),
          };
        }
        if (collectionName === "users") {
          return {
            where: vi.fn(() => ({
              get: vi.fn(() => Promise.resolve(mockUsersSnapshot)),
            })),
          };
        }
        if (collectionName === "personnel") {
          return {
            where: vi.fn(() => ({
              get: vi.fn(() => Promise.resolve({ docs: [] })),
            })),
          };
        }
        return {
          where: vi.fn(() => ({
            get: vi.fn(() => Promise.resolve({ docs: [] })),
          })),
        };
      }),
    };

    const result = await sendDetailReminders(mockDb, mockMessaging, "morning", "America/New_York");

    expect(result.resetResults).toBeDefined();
    expect(Array.isArray(result.resetResults)).toBe(true);
  });
});

describe("Detail Reset All Statuses", () => {
  it("should reset ALL assignments including approved ones", async () => {
    // This test verifies that the getAssignmentsToReset query targets
    // ALL assignments for today regardless of status
    const mockDocs = [
      { id: "a1", data: () => ({ timeSlot: "morning", status: "approved" }) },
      { id: "a2", data: () => ({ timeSlot: "morning", status: "assigned" }) },
      { id: "a3", data: () => ({ timeSlot: "morning", status: "completed" }) },
    ];

    const mockDb = {
      collection: vi.fn(() => ({
        where: vi.fn((field, op, value) => {
          // Verify we only filter by date, not by status
          expect(field).toBe("assignmentDate");
          expect(value).toBe("2026-02-02");
          return {
            get: vi.fn(() => Promise.resolve({ docs: mockDocs })),
          };
        }),
      })),
    };

    const result = await getAssignmentsToReset(mockDb, "2026-02-02", "morning");

    // Should include all assignments regardless of status
    expect(result).toHaveLength(3);
    expect(mockDb.collection).toHaveBeenCalledWith("detailAssignments");
  });

  it("should clear approval fields when resetting approved assignment", async () => {
    const updateMock = vi.fn(() => Promise.resolve());
    const mockDb = {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          update: updateMock,
        })),
      })),
    };

    const approvedAssignment = {
      status: "approved",
      approvedAt: new Date(),
      approvedBy: "admin-1",
      approvedByName: "Admin User",
      approverNotes: "Good work",
      tasks: [{ taskId: "t1", completed: true }],
    };

    await resetAssignmentForNewDay(mockDb, "assignment-1", approvedAssignment);

    const updateArgs = updateMock.mock.calls[0][0];
    expect(updateArgs.status).toBe("assigned");
    expect(updateArgs.approvedAt).toBeNull();
    expect(updateArgs.approvedBy).toBeNull();
    expect(updateArgs.approvedByName).toBeNull();
    expect(updateArgs.approverNotes).toBeNull();
  });

  it("cloned assignments should preserve link to source for history tracking", async () => {
    const addMock = vi.fn(() => Promise.resolve({ id: "new-1" }));

    const mockDb = {
      collection: vi.fn(() => ({
        add: addMock,
      })),
    };

    const sourceAssignment = {
      id: "approved-source-123",
      templateId: "t1",
      templateName: "Daily Clean",
      tasks: [],
      assignedTo: [],
    };

    await cloneAssignmentForDate(mockDb, sourceAssignment, "2026-02-02", "morning");

    const addedDoc = addMock.mock.calls[0][0];

    // clonedFrom field should link back to the source for history tracking
    expect(addedDoc.clonedFrom).toBe("approved-source-123");
    // Should not overwrite/delete the source assignment
    expect(addedDoc.id).toBeUndefined(); // New doc, no id set yet
  });
});
