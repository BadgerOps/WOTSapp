import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
  usePendingSwapRequests,
  useMySwapRequests,
  useSwapRequestActions,
  useSwapApprovalActions,
  usePendingSwapRequestCount,
} from './useCQSwapRequests'
import * as firestore from 'firebase/firestore'

// Mock Firebase
vi.mock('firebase/firestore')
vi.mock('../config/firebase', () => ({
  db: {},
}))

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      uid: 'test-user-id',
      displayName: 'Test User',
      email: 'test@example.com',
    },
  }),
}))

describe('usePendingSwapRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    const mockOnSnapshot = vi.fn((query, callback) => {
      callback({
        docs: mockRequests.map((req) => ({
          id: req.id,
          data: () => req,
        })),
      })
      return vi.fn()
    })

    firestore.onSnapshot = mockOnSnapshot
    firestore.collection = vi.fn(() => ({}))
    firestore.query = vi.fn(() => ({}))
    firestore.where = vi.fn(() => ({}))
    firestore.orderBy = vi.fn(() => ({}))

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
    const mockOnSnapshot = vi.fn((query, successCallback, errorCallback) => {
      errorCallback(mockError)
      return vi.fn()
    })

    firestore.onSnapshot = mockOnSnapshot
    firestore.collection = vi.fn(() => ({}))
    firestore.query = vi.fn(() => ({}))
    firestore.where = vi.fn(() => ({}))
    firestore.orderBy = vi.fn(() => ({}))

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

    const mockOnSnapshot = vi.fn((query, callback) => {
      callback({
        docs: mockRequests.map((req) => ({
          id: req.id,
          data: () => req,
        })),
      })
      return vi.fn()
    })

    firestore.onSnapshot = mockOnSnapshot
    firestore.collection = vi.fn(() => ({}))
    firestore.query = vi.fn(() => ({}))
    firestore.where = vi.fn(() => ({}))
    firestore.orderBy = vi.fn(() => ({}))

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

  it('should create a swap request', async () => {
    const mockAddDoc = vi.fn(() => Promise.resolve({ id: 'new-request-id' }))
    const mockServerTimestamp = vi.fn(() => 'timestamp')

    firestore.addDoc = mockAddDoc
    firestore.collection = vi.fn(() => ({}))
    firestore.serverTimestamp = mockServerTimestamp

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
    expect(mockAddDoc).toHaveBeenCalledWith(
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
    const mockGetDoc = vi.fn(() =>
      Promise.resolve({
        exists: () => true,
        data: () => ({
          requesterId: 'test-user-id',
          status: 'pending',
        }),
      })
    )
    const mockUpdateDoc = vi.fn(() => Promise.resolve())
    const mockDoc = vi.fn(() => ({}))
    const mockServerTimestamp = vi.fn(() => 'timestamp')

    firestore.getDoc = mockGetDoc
    firestore.updateDoc = mockUpdateDoc
    firestore.doc = mockDoc
    firestore.serverTimestamp = mockServerTimestamp

    const { result } = renderHook(() => useSwapRequestActions())

    const response = await result.current.cancelSwapRequest('request-id')

    expect(response.success).toBe(true)
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        status: 'cancelled',
      })
    )
  })

  it('should reject cancelling another users request', async () => {
    const mockGetDoc = vi.fn(() =>
      Promise.resolve({
        exists: () => true,
        data: () => ({
          requesterId: 'different-user-id',
          status: 'pending',
        }),
      })
    )
    const mockDoc = vi.fn(() => ({}))

    firestore.getDoc = mockGetDoc
    firestore.doc = mockDoc

    const { result } = renderHook(() => useSwapRequestActions())

    await expect(result.current.cancelSwapRequest('request-id')).rejects.toThrow(
      'You can only cancel your own requests'
    )
  })

  it('should reject cancelling non-pending request', async () => {
    const mockGetDoc = vi.fn(() =>
      Promise.resolve({
        exists: () => true,
        data: () => ({
          requesterId: 'test-user-id',
          status: 'approved',
        }),
      })
    )
    const mockDoc = vi.fn(() => ({}))

    firestore.getDoc = mockGetDoc
    firestore.doc = mockDoc

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

    const mockGetDoc = vi
      .fn()
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
    const mockWriteBatch = vi.fn(() => ({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    }))

    const mockDoc = vi.fn(() => ({}))
    const mockServerTimestamp = vi.fn(() => 'timestamp')

    firestore.getDoc = mockGetDoc
    firestore.doc = mockDoc
    firestore.writeBatch = mockWriteBatch
    firestore.serverTimestamp = mockServerTimestamp

    const { result } = renderHook(() => useSwapApprovalActions())

    const response = await result.current.approveSwapRequest('request-id')

    expect(response.success).toBe(true)
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2) // Schedule update + request status update
    expect(mockBatchCommit).toHaveBeenCalled()
  })

  it('should reject a swap request', async () => {
    const mockGetDoc = vi.fn(() =>
      Promise.resolve({
        exists: () => true,
        data: () => ({
          status: 'pending',
        }),
      })
    )
    const mockUpdateDoc = vi.fn(() => Promise.resolve())
    const mockDoc = vi.fn(() => ({}))
    const mockServerTimestamp = vi.fn(() => 'timestamp')

    firestore.getDoc = mockGetDoc
    firestore.updateDoc = mockUpdateDoc
    firestore.doc = mockDoc
    firestore.serverTimestamp = mockServerTimestamp

    const { result } = renderHook(() => useSwapApprovalActions())

    const response = await result.current.rejectSwapRequest('request-id', 'Not available')

    expect(response.success).toBe(true)
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        status: 'rejected',
        rejectionReason: 'Not available',
        rejectedBy: 'test-user-id',
      })
    )
  })

  it('should reject approving non-pending request', async () => {
    const mockGetDoc = vi.fn(() =>
      Promise.resolve({
        exists: () => true,
        data: () => ({
          status: 'approved',
        }),
      })
    )
    const mockDoc = vi.fn(() => ({}))

    firestore.getDoc = mockGetDoc
    firestore.doc = mockDoc

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

  it('should return pending count', async () => {
    const mockOnSnapshot = vi.fn((query, callback) => {
      callback({
        size: 5,
      })
      return vi.fn()
    })

    firestore.onSnapshot = mockOnSnapshot
    firestore.collection = vi.fn(() => ({}))
    firestore.query = vi.fn(() => ({}))
    firestore.where = vi.fn(() => ({}))

    const { result } = renderHook(() => usePendingSwapRequestCount())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.count).toBe(5)
  })

  it('should return 0 when no pending requests', async () => {
    const mockOnSnapshot = vi.fn((query, callback) => {
      callback({
        size: 0,
      })
      return vi.fn()
    })

    firestore.onSnapshot = mockOnSnapshot
    firestore.collection = vi.fn(() => ({}))
    firestore.query = vi.fn(() => ({}))
    firestore.where = vi.fn(() => ({}))

    const { result } = renderHook(() => usePendingSwapRequestCount())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.count).toBe(0)
  })
})
