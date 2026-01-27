import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
  useCQNotes,
  useRecentCQNotes,
  useCQNoteActions,
  NOTE_TYPES,
} from './useCQNotes'
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
      displayName: 'Test CQ NCO',
      email: 'user2@example.com',
    },
  }),
}))

describe('NOTE_TYPES', () => {
  it('should have all required note types', () => {
    expect(NOTE_TYPES).toHaveProperty('routine')
    expect(NOTE_TYPES).toHaveProperty('incident')
    expect(NOTE_TYPES).toHaveProperty('visitor')
    expect(NOTE_TYPES).toHaveProperty('maintenance')
    expect(NOTE_TYPES).toHaveProperty('other')
  })

  it('should have labels and colors for each note type', () => {
    Object.values(NOTE_TYPES).forEach((type) => {
      expect(type).toHaveProperty('label')
      expect(type).toHaveProperty('color')
    })
  })
})

describe('useCQNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch all notes when no shiftId provided', async () => {
    const mockNotes = [
      {
        id: 'note-1',
        description: 'Routine check completed',
        type: 'routine',
        severity: 'normal',
        timestamp: { toDate: () => new Date() },
        createdBy: 'user-1',
        createdByName: 'SGT Smith',
      },
      {
        id: 'note-2',
        description: 'Visitor arrived',
        type: 'visitor',
        severity: 'normal',
        timestamp: { toDate: () => new Date() },
        createdBy: 'user-1',
        createdByName: 'SGT Smith',
      },
    ]

    const mockOnSnapshot = vi.fn((query, callback) => {
      callback({
        docs: mockNotes.map((note) => ({
          id: note.id,
          data: () => note,
        })),
      })
      return vi.fn()
    })

    firestore.onSnapshot = mockOnSnapshot
    firestore.collection = vi.fn(() => ({}))
    firestore.query = vi.fn(() => ({}))
    firestore.where = vi.fn(() => ({}))
    firestore.orderBy = vi.fn(() => ({}))

    const { result } = renderHook(() => useCQNotes())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.notes).toHaveLength(2)
    expect(result.current.notes[0].type).toBe('routine')
    expect(result.current.error).toBeNull()
  })

  it('should filter notes by shiftId when provided', async () => {
    const mockNotes = [
      {
        id: 'note-1',
        description: 'Note for specific shift',
        type: 'routine',
        shiftId: 'shift-123',
        timestamp: { toDate: () => new Date() },
      },
    ]

    const mockOnSnapshot = vi.fn((query, callback) => {
      callback({
        docs: mockNotes.map((note) => ({
          id: note.id,
          data: () => note,
        })),
      })
      return vi.fn()
    })

    firestore.onSnapshot = mockOnSnapshot
    firestore.collection = vi.fn(() => ({}))
    firestore.query = vi.fn(() => ({}))
    firestore.where = vi.fn(() => ({}))
    firestore.orderBy = vi.fn(() => ({}))

    const { result } = renderHook(() => useCQNotes('shift-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.notes).toHaveLength(1)
    expect(firestore.where).toHaveBeenCalledWith('shiftId', '==', 'shift-123')
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

    const { result } = renderHook(() => useCQNotes())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Firestore error')
    expect(result.current.notes).toEqual([])
  })
})

describe('useRecentCQNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch limited number of recent notes', async () => {
    const mockNotes = Array.from({ length: 5 }, (_, i) => ({
      id: `note-${i}`,
      description: `Note ${i}`,
      type: 'routine',
      timestamp: { toDate: () => new Date() },
    }))

    const mockOnSnapshot = vi.fn((query, callback) => {
      callback({
        docs: mockNotes.map((note) => ({
          id: note.id,
          data: () => note,
        })),
      })
      return vi.fn()
    })

    firestore.onSnapshot = mockOnSnapshot
    firestore.collection = vi.fn(() => ({}))
    firestore.query = vi.fn(() => ({}))
    firestore.orderBy = vi.fn(() => ({}))
    firestore.limit = vi.fn(() => ({}))

    const { result } = renderHook(() => useRecentCQNotes(5))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.notes).toHaveLength(5)
    expect(firestore.limit).toHaveBeenCalledWith(5)
  })

  it('should use default limit of 10', async () => {
    const mockOnSnapshot = vi.fn((query, callback) => {
      callback({ docs: [] })
      return vi.fn()
    })

    firestore.onSnapshot = mockOnSnapshot
    firestore.collection = vi.fn(() => ({}))
    firestore.query = vi.fn(() => ({}))
    firestore.orderBy = vi.fn(() => ({}))
    firestore.limit = vi.fn(() => ({}))

    renderHook(() => useRecentCQNotes())

    await waitFor(() => {
      expect(firestore.limit).toHaveBeenCalledWith(10)
    })
  })
})

describe('useCQNoteActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should add a new note', async () => {
    const mockAddDoc = vi.fn(() => Promise.resolve({ id: 'new-note-id' }))
    const mockServerTimestamp = vi.fn(() => 'timestamp')

    firestore.addDoc = mockAddDoc
    firestore.collection = vi.fn(() => ({}))
    firestore.serverTimestamp = mockServerTimestamp

    const { result } = renderHook(() => useCQNoteActions())

    const noteData = {
      description: 'New routine note',
      type: 'routine',
      severity: 'normal',
      shiftId: 'shift-123',
    }

    const noteId = await result.current.addNote(noteData)

    expect(noteId).toBe('new-note-id')
    expect(mockAddDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        description: 'New routine note',
        type: 'routine',
        severity: 'normal',
        shiftId: 'shift-123',
        createdBy: 'test-user-id',
        createdByName: 'Test CQ NCO',
      })
    )
  })

  it('should add a note with default type and severity', async () => {
    const mockAddDoc = vi.fn(() => Promise.resolve({ id: 'new-note-id' }))

    firestore.addDoc = mockAddDoc
    firestore.collection = vi.fn(() => ({}))
    firestore.serverTimestamp = vi.fn(() => 'timestamp')

    const { result } = renderHook(() => useCQNoteActions())

    await result.current.addNote({
      description: 'Note without explicit type',
    })

    expect(mockAddDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        type: 'routine',
        severity: 'normal',
      })
    )
  })

  it('should update a note', async () => {
    const mockUpdateDoc = vi.fn(() => Promise.resolve())
    const mockDoc = vi.fn(() => ({}))
    const mockServerTimestamp = vi.fn(() => 'timestamp')

    firestore.updateDoc = mockUpdateDoc
    firestore.doc = mockDoc
    firestore.serverTimestamp = mockServerTimestamp

    const { result } = renderHook(() => useCQNoteActions())

    await result.current.updateNote('note-id', {
      description: 'Updated description',
      severity: 'high',
    })

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        description: 'Updated description',
        severity: 'high',
        updatedAt: 'timestamp',
      })
    )
  })

  it('should delete a note', async () => {
    const mockDeleteDoc = vi.fn(() => Promise.resolve())
    const mockDoc = vi.fn(() => ({}))

    firestore.deleteDoc = mockDeleteDoc
    firestore.doc = mockDoc

    const { result } = renderHook(() => useCQNoteActions())

    await result.current.deleteNote('note-id')

    expect(mockDeleteDoc).toHaveBeenCalledWith({})
  })

  it('should handle errors when adding notes', async () => {
    const mockError = new Error('Add failed')
    const mockAddDoc = vi.fn(() => Promise.reject(mockError))

    firestore.addDoc = mockAddDoc
    firestore.collection = vi.fn(() => ({}))
    firestore.serverTimestamp = vi.fn(() => 'timestamp')

    const { result } = renderHook(() => useCQNoteActions())

    await expect(
      result.current.addNote({ description: 'Test note' })
    ).rejects.toThrow('Add failed')

    await waitFor(() => {
      expect(result.current.error).toBe('Add failed')
    })
  })

  it('should handle errors when updating notes', async () => {
    const mockError = new Error('Update failed')
    const mockUpdateDoc = vi.fn(() => Promise.reject(mockError))

    firestore.updateDoc = mockUpdateDoc
    firestore.doc = vi.fn(() => ({}))
    firestore.serverTimestamp = vi.fn(() => 'timestamp')

    const { result } = renderHook(() => useCQNoteActions())

    await expect(
      result.current.updateNote('note-id', { description: 'Updated' })
    ).rejects.toThrow('Update failed')

    await waitFor(() => {
      expect(result.current.error).toBe('Update failed')
    })
  })

  it('should handle errors when deleting notes', async () => {
    const mockError = new Error('Delete failed')
    const mockDeleteDoc = vi.fn(() => Promise.reject(mockError))

    firestore.deleteDoc = mockDeleteDoc
    firestore.doc = vi.fn(() => ({}))

    const { result } = renderHook(() => useCQNoteActions())

    await expect(result.current.deleteNote('note-id')).rejects.toThrow(
      'Delete failed'
    )

    await waitFor(() => {
      expect(result.current.error).toBe('Delete failed')
    })
  })

  it('should add incident note with high severity', async () => {
    const mockAddDoc = vi.fn(() => Promise.resolve({ id: 'incident-note-id' }))

    firestore.addDoc = mockAddDoc
    firestore.collection = vi.fn(() => ({}))
    firestore.serverTimestamp = vi.fn(() => 'timestamp')

    const { result } = renderHook(() => useCQNoteActions())

    await result.current.addNote({
      description: 'Security incident occurred',
      type: 'incident',
      severity: 'high',
      shiftId: 'shift-123',
    })

    expect(mockAddDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        type: 'incident',
        severity: 'high',
      })
    )
  })
})
