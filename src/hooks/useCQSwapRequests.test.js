import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'
import {
  usePendingSwapRequests,
  useMySwapRequests,
  useSwapRequestActions,
  useSwapApprovalActions,
  usePendingSwapRequestCount,
} from './useCQSwapRequests'

// Mock Firebase modules
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  onSnapshot: vi.fn(),
  doc: vi.fn(() => ({})),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  getDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'timestamp'),
  writeBatch: vi.fn(() => ({
    update: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
}))

vi.mock('../config/firebase', () => ({
  db: {},
}))

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      uid: 'test-user-id',
      displayName: 'Test User',
      email: 'user11@example.com',
    },
  }),
}))

// Import the mocked functions for use in tests
import {
  onSnapshot,
  addDoc,
  getDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'

// Global cleanup
afterAll(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('usePendingSwapRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('should fetch pending swap requests', async () => {
    const mockRequests = [
      {
        id: 'request-1',
        requesterId: 'user-1',
        requesterName: 'SGT Smith',
        scheduleId: 'schedule-1',
        scheduleDate: '2026-01-25',
        currentShiftType: 'shift1',
        currentPosition: 1,
        proposedPersonnelId: 'user-2',
        proposedPersonnelName: 'PFC Jones',
        reason: 'Medical appointment',
        status: 'pending',
        createdAt: { toDate: () => new Date() },
      },
      {
        id: 'request-2',
        requesterId: 'user-3',
        requesterName: 'CPL Davis',
        scheduleId: 'schedule-2',
        scheduleDate: '2026-01-26',
        currentShiftType: 'shift2',
        currentPosition: 2,
        proposedPersonnelId: 'user-4',
        proposedPersonnelName: 'SPC Brown',
        status: 'pending',
        createdAt: { toDate: () => new Date() },
      },
    ]

    vi.mocked(onSnapshot).mockImplementation((query, callback) => {
      callback({
        docs: mockRequests.map((req) => ({
          id: req.id,
          data: () => req,
        })),
      })
      return vi.fn() // unsubscribe function
    })

    const { result } = renderHook(() => usePendingSwapRequests())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.requests).toHaveLength(2)
    expect(result.current.requests[0].requesterName).toBe('SGT Smith')
    expect(result.current.requests[1].proposedPersonnelName).toBe('SPC Brown')
    expect(result.current.error).toBeNull()
  })

  it('should handle errors gracefully', async () => {
    const mockError = new Error('Firestore error')

    vi.mocked(onSnapshot).mockImplementation((query, successCallback, errorCallback) => {
      errorCallback(mockError)
      return vi.fn()
    })

    const { result } = renderHook(() => usePendingSwapRequests())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Firestore error')
    expect(result.current.requests).toEqual([])
  })
})

describe('useMySwapRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('should fetch current user swap requests', async () => {
    const mockRequests = [
      {
        id: 'request-1',
        requesterId: 'test-user-id',
        requesterName: 'Test User',
        scheduleId: 'schedule-1',
        scheduleDate: '2026-01-25',
        currentShiftType: 'shift1',
        currentPosition: 1,
        proposedPersonnelId: 'user-2',
        proposedPersonnelName: 'PFC Jones',
        status: 'pending',
        createdAt: { toDate: () => new Date() },
      },
    ]

    vi.mocked(onSnapshot).mockImplementation((query, callback) => {
      callback({
        docs: mockRequests.map((req) => ({
          id: req.id,
          data: () => req,
        })),
      })
      return vi.fn()
    })

    const { result } = renderHook(() => useMySwapRequests())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.requests).toHaveLength(1)
    expect(result.current.requests[0].requesterId).toBe('test-user-id')
  })
})

describe('useSwapRequestActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('should create a swap request', async () => {
    vi.mocked(addDoc).mockResolvedValue({ id: 'new-request-id' })

    const { result } = renderHook(() => useSwapRequestActions())

    const requestData = {
      scheduleId: 'schedule-1',
      scheduleDate: '2026-01-25',
      currentShiftType: 'shift1',
      currentPosition: 1,
      proposedPersonnelId: 'user-2',
      proposedPersonnelName: 'PFC Jones',
      reason: 'Medical appointment',
    }

    const response = await result.current.createSwapRequest(requestData)

    expect(response.success).toBe(true)
    expect(response.requestId).toBe('new-request-id')
    expect(addDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        requesterId: 'test-user-id',
        requesterName: 'Test User',
        scheduleId: 'schedule-1',
        status: 'pending',
        proposedPersonnelName: 'PFC Jones',
      })
    )
  })

  it('should cancel a swap request', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({
        requesterId: 'test-user-id',
        status: 'pending',
      }),
    })
    vi.mocked(updateDoc).mockResolvedValue()

    const { result } = renderHook(() => useSwapRequestActions())

    const response = await result.current.cancelSwapRequest('request-id')

    expect(response.success).toBe(true)
    expect(updateDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        status: 'cancelled',
      })
    )
  })

  it('should reject cancelling another users request', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({
        requesterId: 'different-user-id',
        status: 'pending',
      }),
    })

    const { result } = renderHook(() => useSwapRequestActions())

    await expect(result.current.cancelSwapRequest('request-id')).rejects.toThrow(
      'You can only cancel your own requests'
    )
  })

  it('should reject cancelling non-pending request', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({
        requesterId: 'test-user-id',
        status: 'approved',
      }),
    })

    const { result } = renderHook(() => useSwapRequestActions())

    await expect(result.current.cancelSwapRequest('request-id')).rejects.toThrow(
      'Can only cancel pending requests'
    )
  })
})

describe('useSwapApprovalActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('should approve a swap request', async () => {
    const mockRequest = {
      requesterId: 'user-1',
      scheduleId: 'schedule-1',
      currentShiftType: 'shift1',
      currentPosition: 1,
      proposedPersonnelId: 'user-2',
      proposedPersonnelName: 'PFC Jones',
      status: 'pending',
    }

    const mockSchedule = {
      shift1Person1Id: 'user-1',
      shift1Person1Name: 'SGT Smith',
    }

    vi.mocked(getDoc)
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => mockRequest,
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => mockSchedule,
      })

    const mockBatchUpdate = vi.fn()
    const mockBatchCommit = vi.fn(() => Promise.resolve())
    vi.mocked(writeBatch).mockReturnValue({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    })

    const { result } = renderHook(() => useSwapApprovalActions())

    const response = await result.current.approveSwapRequest('request-id')

    expect(response.success).toBe(true)
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2) // Schedule update + request status update
    expect(mockBatchCommit).toHaveBeenCalled()
  })

  it('should reject a swap request', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({
        status: 'pending',
      }),
    })
    vi.mocked(updateDoc).mockResolvedValue()

    const { result } = renderHook(() => useSwapApprovalActions())

    const response = await result.current.rejectSwapRequest('request-id', 'Not available')

    expect(response.success).toBe(true)
    expect(updateDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        status: 'rejected',
        rejectionReason: 'Not available',
        rejectedBy: 'test-user-id',
      })
    )
  })

  it('should reject approving non-pending request', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({
        status: 'approved',
      }),
    })

    const { result } = renderHook(() => useSwapApprovalActions())

    await expect(result.current.approveSwapRequest('request-id')).rejects.toThrow(
      'Request is no longer pending'
    )
  })
})

describe('usePendingSwapRequestCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('should return pending count', async () => {
    vi.mocked(onSnapshot).mockImplementation((query, callback) => {
      callback({
        size: 5,
      })
      return vi.fn()
    })

    const { result } = renderHook(() => usePendingSwapRequestCount())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.count).toBe(5)
  })

  it('should return 0 when no pending requests', async () => {
    vi.mocked(onSnapshot).mockImplementation((query, callback) => {
      callback({
        size: 0,
      })
      return vi.fn()
    })

    const { result } = renderHook(() => usePendingSwapRequestCount())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.count).toBe(0)
  })
})
