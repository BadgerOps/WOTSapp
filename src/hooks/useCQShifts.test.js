import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCQShifts, useActiveShift, useCQShiftActions } from './useCQShifts'
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
      displayName: 'Test Admin',
      email: 'admin@example.com',
    },
  }),
}))

describe('useCQShifts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch all shifts', async () => {
    const mockShifts = [
      {
        id: 'shift-1',
        assignee1Id: 'person-1',
        assignee1Name: 'SGT Smith',
        assignee2Id: 'person-2',
        assignee2Name: 'PFC Jones',
        status: 'upcoming',
        startTime: { toDate: () => new Date('2026-01-22T06:00:00') },
        endTime: { toDate: () => new Date('2026-01-22T18:00:00') },
      },
      {
        id: 'shift-2',
        assignee1Id: 'person-3',
        assignee1Name: 'SSG Johnson',
        status: 'completed',
        startTime: { toDate: () => new Date('2026-01-21T06:00:00') },
        endTime: { toDate: () => new Date('2026-01-21T18:00:00') },
      },
    ]

    const mockOnSnapshot = vi.fn((query, callback) => {
      callback({
        docs: mockShifts.map((shift) => ({
          id: shift.id,
          data: () => shift,
        })),
      })
      return vi.fn()
    })

    firestore.onSnapshot = mockOnSnapshot
    firestore.collection = vi.fn(() => ({}))
    firestore.query = vi.fn(() => ({}))
    firestore.where = vi.fn(() => ({}))
    firestore.orderBy = vi.fn(() => ({}))

    const { result } = renderHook(() => useCQShifts())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.shifts).toHaveLength(2)
    expect(result.current.shifts[0].assignee1Name).toBe('SGT Smith')
    expect(result.current.error).toBeNull()
  })

  it('should filter shifts by status', async () => {
    const mockShifts = [
      {
        id: 'shift-1',
        assignee1Name: 'SGT Smith',
        status: 'active',
        startTime: { toDate: () => new Date() },
        endTime: { toDate: () => new Date() },
      },
    ]

    const mockOnSnapshot = vi.fn((query, callback) => {
      callback({
        docs: mockShifts.map((shift) => ({
          id: shift.id,
          data: () => shift,
        })),
      })
      return vi.fn()
    })

    firestore.onSnapshot = mockOnSnapshot
    firestore.collection = vi.fn(() => ({}))
    firestore.query = vi.fn(() => ({}))
    firestore.where = vi.fn(() => ({}))
    firestore.orderBy = vi.fn(() => ({}))

    const { result } = renderHook(() => useCQShifts('active'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.shifts).toHaveLength(1)
    expect(result.current.shifts[0].status).toBe('active')
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

    const { result } = renderHook(() => useCQShifts())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Firestore error')
    expect(result.current.shifts).toEqual([])
  })
})

describe('useActiveShift', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return the active shift', async () => {
    const mockActiveShift = {
      id: 'active-shift-1',
      assignee1Name: 'SGT Active',
      status: 'active',
      startTime: { toDate: () => new Date() },
      endTime: { toDate: () => new Date() },
    }

    const mockOnSnapshot = vi.fn((query, callback) => {
      callback({
        empty: false,
        docs: [
          {
            id: mockActiveShift.id,
            data: () => mockActiveShift,
          },
        ],
      })
      return vi.fn()
    })

    firestore.onSnapshot = mockOnSnapshot
    firestore.collection = vi.fn(() => ({}))
    firestore.query = vi.fn(() => ({}))
    firestore.where = vi.fn(() => ({}))

    const { result } = renderHook(() => useActiveShift())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.activeShift).not.toBeNull()
    expect(result.current.activeShift.assignee1Name).toBe('SGT Active')
    expect(result.current.activeShift.status).toBe('active')
  })

  it('should return null when no active shift exists', async () => {
    const mockOnSnapshot = vi.fn((query, callback) => {
      callback({
        empty: true,
        docs: [],
      })
      return vi.fn()
    })

    firestore.onSnapshot = mockOnSnapshot
    firestore.collection = vi.fn(() => ({}))
    firestore.query = vi.fn(() => ({}))
    firestore.where = vi.fn(() => ({}))

    const { result } = renderHook(() => useActiveShift())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.activeShift).toBeNull()
    expect(result.current.error).toBeNull()
  })
})

describe('useCQShiftActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create a new shift', async () => {
    const mockAddDoc = vi.fn(() => Promise.resolve({ id: 'new-shift-id' }))
    const mockServerTimestamp = vi.fn(() => 'timestamp')

    firestore.addDoc = mockAddDoc
    firestore.collection = vi.fn(() => ({}))
    firestore.serverTimestamp = mockServerTimestamp
    firestore.Timestamp = {
      fromDate: vi.fn((date) => ({ toDate: () => date })),
    }

    const { result } = renderHook(() => useCQShiftActions())

    const shiftData = {
      startTime: '2026-01-22T06:00',
      endTime: '2026-01-22T18:00',
      assignee1Id: 'person-1',
      assignee1Name: 'SGT Smith',
      assignee2Id: 'person-2',
      assignee2Name: 'PFC Jones',
      notes: 'Test shift',
    }

    const shiftId = await result.current.createShift(shiftData)

    expect(shiftId).toBe('new-shift-id')
    expect(mockAddDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        assignee1Id: 'person-1',
        assignee1Name: 'SGT Smith',
        status: 'upcoming',
        createdBy: 'test-user-id',
        createdByName: 'Test Admin',
      })
    )
  })

  it('should update a shift', async () => {
    const mockUpdateDoc = vi.fn(() => Promise.resolve())
    const mockDoc = vi.fn(() => ({}))
    const mockServerTimestamp = vi.fn(() => 'timestamp')

    firestore.updateDoc = mockUpdateDoc
    firestore.doc = mockDoc
    firestore.serverTimestamp = mockServerTimestamp
    firestore.Timestamp = {
      fromDate: vi.fn((date) => ({ toDate: () => date })),
    }

    const { result } = renderHook(() => useCQShiftActions())

    await result.current.updateShift('shift-id', {
      notes: 'Updated notes',
    })

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        notes: 'Updated notes',
        updatedAt: 'timestamp',
      })
    )
  })

  it('should activate a shift', async () => {
    const mockUpdateDoc = vi.fn(() => Promise.resolve())
    const mockDoc = vi.fn(() => ({}))
    const mockServerTimestamp = vi.fn(() => 'timestamp')

    firestore.updateDoc = mockUpdateDoc
    firestore.doc = mockDoc
    firestore.serverTimestamp = mockServerTimestamp

    const { result } = renderHook(() => useCQShiftActions())

    await result.current.activateShift('shift-id')

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        status: 'active',
      })
    )
  })

  it('should complete a shift', async () => {
    const mockUpdateDoc = vi.fn(() => Promise.resolve())
    const mockDoc = vi.fn(() => ({}))
    const mockServerTimestamp = vi.fn(() => 'timestamp')

    firestore.updateDoc = mockUpdateDoc
    firestore.doc = mockDoc
    firestore.serverTimestamp = mockServerTimestamp

    const { result } = renderHook(() => useCQShiftActions())

    await result.current.completeShift('shift-id')

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        status: 'completed',
      })
    )
  })

  it('should delete a shift', async () => {
    const mockDeleteDoc = vi.fn(() => Promise.resolve())
    const mockDoc = vi.fn(() => ({}))

    firestore.deleteDoc = mockDeleteDoc
    firestore.doc = mockDoc

    const { result } = renderHook(() => useCQShiftActions())

    await result.current.deleteShift('shift-id')

    expect(mockDeleteDoc).toHaveBeenCalledWith({})
  })

  it('should handle errors when creating shifts', async () => {
    const mockError = new Error('Creation failed')
    const mockAddDoc = vi.fn(() => Promise.reject(mockError))

    firestore.addDoc = mockAddDoc
    firestore.collection = vi.fn(() => ({}))
    firestore.serverTimestamp = vi.fn(() => 'timestamp')
    firestore.Timestamp = {
      fromDate: vi.fn((date) => ({ toDate: () => date })),
    }

    const { result } = renderHook(() => useCQShiftActions())

    await expect(
      result.current.createShift({
        startTime: '2026-01-22T06:00',
        endTime: '2026-01-22T18:00',
        assignee1Id: 'person-1',
        assignee1Name: 'SGT Smith',
      })
    ).rejects.toThrow('Creation failed')

    await waitFor(() => {
      expect(result.current.error).toBe('Creation failed')
    })
  })
})
