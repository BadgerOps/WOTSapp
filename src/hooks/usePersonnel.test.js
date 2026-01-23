import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePersonnel, usePersonnelActions, usePersonnelImports } from './usePersonnel';

// Mock Firebase
vi.mock('../config/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn((q, successCallback) => {
    // Simulate successful snapshot
    successCallback({
      docs: [
        {
          id: '1',
          data: () => ({
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            rank: 'SGT',
          }),
        },
      ],
    });
    return vi.fn(); // unsubscribe function
  }),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-id' })),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
  getDocs: vi.fn(() => Promise.resolve({ empty: true, docs: [] })),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      uid: 'test-user-id',
      displayName: 'Test User',
    },
  }),
}));

describe('usePersonnel', () => {
  it('should fetch personnel data', async () => {
    const { result } = renderHook(() => usePersonnel());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.personnel).toHaveLength(1);
    expect(result.current.personnel[0]).toMatchObject({
      id: '1',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      rank: 'SGT',
    });
    expect(result.current.error).toBeNull();
  });

  it('should handle errors when fetching personnel', async () => {
    const { onSnapshot } = await import('firebase/firestore');

    // Mock error scenario
    onSnapshot.mockImplementationOnce((q, successCallback, errorCallback) => {
      errorCallback(new Error('Firestore error'));
      return vi.fn();
    });

    const { result } = renderHook(() => usePersonnel());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Firestore error');
    expect(result.current.personnel).toEqual([]);
  });
});

describe('usePersonnelActions', () => {
  let result;

  beforeEach(() => {
    const { result: hookResult } = renderHook(() => usePersonnelActions());
    result = hookResult;
  });

  it('should create a personnel record', async () => {
    const personnelData = {
      email: 'new@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      rank: 'SSG',
      phoneNumber: '555-0123',
      squad: '1st Squad',
      platoon: '1st Platoon',
      detailEligible: true,
    };

    const id = await result.current.createPersonnel(personnelData);

    expect(id).toBe('new-id');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should update a personnel record', async () => {
    const updates = {
      rank: 'SFC',
      squad: '2nd Squad',
    };

    await result.current.updatePersonnel('personnel-id', updates);

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should delete a personnel record', async () => {
    await result.current.deletePersonnel('personnel-id');

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should import multiple personnel records', async () => {
    const personnelArray = [
      {
        email: 'person1@example.com',
        firstName: 'Person',
        lastName: 'One',
        rank: 'SGT',
        phoneNumber: '555-0001',
        squad: '1st Squad',
        platoon: '1st Platoon',
        detailEligible: true,
      },
      {
        email: 'person2@example.com',
        firstName: 'Person',
        lastName: 'Two',
        rank: 'SSG',
        phoneNumber: '555-0002',
        squad: '2nd Squad',
        platoon: '1st Platoon',
        detailEligible: true,
      },
    ];

    const importResult = await result.current.importPersonnel(personnelArray);

    expect(importResult.recordsProcessed).toBe(2);
    expect(importResult.recordsFailed).toBe(0);
    expect(importResult.errors).toHaveLength(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should link personnel to user', async () => {
    await result.current.linkPersonnelToUser('personnel-id', 'user-id');

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  describe('updatePersonnelRole', () => {
    it('should update role on personnel record only when no linked user', async () => {
      const { updateDoc } = await import('firebase/firestore');
      updateDoc.mockClear();

      await result.current.updatePersonnelRole('personnel-id', 'admin', undefined);

      // Should only be called once (for personnel record)
      expect(updateDoc).toHaveBeenCalledTimes(1);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should update role on both personnel and user when linked', async () => {
      const { updateDoc } = await import('firebase/firestore');
      updateDoc.mockClear();

      await result.current.updatePersonnelRole('personnel-id', 'admin', 'linked-user-id');

      // Should be called twice (personnel + user)
      expect(updateDoc).toHaveBeenCalledTimes(2);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should normalize role to lowercase', async () => {
      const { updateDoc } = await import('firebase/firestore');
      updateDoc.mockClear();

      await result.current.updatePersonnelRole('personnel-id', 'ADMIN', undefined);

      // The role should be normalized to lowercase
      expect(updateDoc).toHaveBeenCalled();
      expect(result.current.error).toBeNull();
    });

    it('should handle invalid roles by defaulting to user', async () => {
      const { updateDoc } = await import('firebase/firestore');
      updateDoc.mockClear();

      await result.current.updatePersonnelRole('personnel-id', 'invalid_role', undefined);

      // Should still complete without error (normalizeRole returns 'user' for invalid)
      expect(updateDoc).toHaveBeenCalled();
      expect(result.current.error).toBeNull();
    });

    it('should handle errors during role update', async () => {
      const { updateDoc } = await import('firebase/firestore');
      updateDoc.mockRejectedValueOnce(new Error('Role update failed'));

      await expect(
        result.current.updatePersonnelRole('personnel-id', 'admin', undefined)
      ).rejects.toThrow('Role update failed');

      await waitFor(() => {
        expect(result.current.error).toBe('Role update failed');
      });
    });
  });

  it('should handle errors during operations', async () => {
    const { addDoc } = await import('firebase/firestore');

    // Mock error
    addDoc.mockRejectedValueOnce(new Error('Database error'));

    const personnelData = {
      email: 'error@example.com',
      firstName: 'Error',
      lastName: 'Test',
      rank: 'PFC',
    };

    await expect(result.current.createPersonnel(personnelData)).rejects.toThrow('Database error');

    await waitFor(() => {
      expect(result.current.error).toBe('Database error');
    });
  });
});

describe('usePersonnelImports', () => {
  it('should fetch import history', async () => {
    const { onSnapshot } = await import('firebase/firestore');

    // Mock import history data
    onSnapshot.mockImplementationOnce((q, successCallback) => {
      successCallback({
        docs: [
          {
            id: 'import-1',
            data: () => ({
              uploadedBy: 'admin-id',
              uploadedAt: new Date(),
              recordsProcessed: 10,
              recordsFailed: 0,
              errors: [],
              status: 'completed',
            }),
          },
        ],
      });
      return vi.fn();
    });

    const { result } = renderHook(() => usePersonnelImports());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.imports).toHaveLength(1);
    expect(result.current.imports[0].status).toBe('completed');
    expect(result.current.imports[0].recordsProcessed).toBe(10);
    expect(result.current.error).toBeNull();
  });
});
