import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePosts, usePostActions } from './usePosts';
import * as firestore from 'firebase/firestore';

// Mock Firebase
vi.mock('firebase/firestore');
vi.mock('../config/firebase', () => ({
  db: {},
}));

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      uid: 'test-user-id',
      displayName: 'Test User',
      email: 'test@example.com',
    },
  }),
}));

describe('usePosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch published posts', async () => {
    const mockPosts = [
      {
        id: '1',
        title: 'Test Post',
        content: 'Test Content',
        type: 'general',
        status: 'published',
        authorId: 'user1',
        authorName: 'John Doe',
        createdAt: { toDate: () => new Date() },
      },
    ];

    const mockOnSnapshot = vi.fn((query, callback) => {
      callback({
        docs: mockPosts.map((post) => ({
          id: post.id,
          data: () => post,
        })),
      });
      return vi.fn(); // unsubscribe function
    });

    firestore.onSnapshot = mockOnSnapshot;
    firestore.collection = vi.fn(() => ({}));
    firestore.query = vi.fn(() => ({}));
    firestore.where = vi.fn(() => ({}));
    firestore.orderBy = vi.fn(() => ({}));

    const { result } = renderHook(() => usePosts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.posts).toHaveLength(1);
    expect(result.current.posts[0].authorName).toBe('John Doe');
  });

  it('should filter posts by type', async () => {
    const mockPosts = [
      {
        id: '1',
        title: 'UOTD Post',
        content: 'Uniform content',
        type: 'uotd',
        status: 'published',
        authorId: 'user1',
        authorName: 'Admin User',
        createdAt: { toDate: () => new Date() },
      },
    ];

    const mockOnSnapshot = vi.fn((query, callback) => {
      callback({
        docs: mockPosts.map((post) => ({
          id: post.id,
          data: () => post,
        })),
      });
      return vi.fn();
    });

    firestore.onSnapshot = mockOnSnapshot;
    firestore.collection = vi.fn(() => ({}));
    firestore.query = vi.fn(() => ({}));
    firestore.where = vi.fn(() => ({}));
    firestore.orderBy = vi.fn(() => ({}));

    const { result } = renderHook(() => usePosts('uotd'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.posts).toHaveLength(1);
    expect(result.current.posts[0].type).toBe('uotd');
  });

  it('should handle errors gracefully', async () => {
    const mockError = new Error('Firestore error');
    const mockOnSnapshot = vi.fn((query, successCallback, errorCallback) => {
      errorCallback(mockError);
      return vi.fn();
    });

    firestore.onSnapshot = mockOnSnapshot;
    firestore.collection = vi.fn(() => ({}));
    firestore.query = vi.fn(() => ({}));
    firestore.where = vi.fn(() => ({}));
    firestore.orderBy = vi.fn(() => ({}));

    const { result } = renderHook(() => usePosts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Firestore error');
    expect(result.current.posts).toEqual([]);
  });
});

describe('usePostActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a post with author information', async () => {
    const mockAddDoc = vi.fn(() =>
      Promise.resolve({ id: 'new-post-id' })
    );
    const mockServerTimestamp = vi.fn(() => 'timestamp');

    firestore.addDoc = mockAddDoc;
    firestore.collection = vi.fn(() => ({}));
    firestore.serverTimestamp = mockServerTimestamp;

    const { result } = renderHook(() => usePostActions());

    const postData = {
      title: 'New Post',
      content: 'Post content',
      type: 'general',
      status: 'published',
    };

    await result.current.createPost(postData);

    expect(mockAddDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        title: 'New Post',
        content: 'Post content',
        type: 'general',
        status: 'published',
        authorId: 'test-user-id',
        authorName: 'Test User',
        createdAt: 'timestamp',
        updatedAt: 'timestamp',
      })
    );
  });

  it('should include authorName in created posts', async () => {
    const mockAddDoc = vi.fn(() =>
      Promise.resolve({ id: 'new-post-id' })
    );

    firestore.addDoc = mockAddDoc;
    firestore.collection = vi.fn(() => ({}));
    firestore.serverTimestamp = vi.fn(() => 'timestamp');

    const { result } = renderHook(() => usePostActions());

    await result.current.createPost({
      title: 'Test',
      content: 'Content',
      type: 'announcement',
      status: 'published',
    });

    const callArgs = mockAddDoc.mock.calls[0][1];
    expect(callArgs.authorName).toBe('Test User');
    expect(callArgs.authorId).toBe('test-user-id');
  });

  it('should update a post', async () => {
    const mockUpdateDoc = vi.fn(() => Promise.resolve());
    const mockDoc = vi.fn(() => ({}));
    const mockServerTimestamp = vi.fn(() => 'timestamp');

    firestore.updateDoc = mockUpdateDoc;
    firestore.doc = mockDoc;
    firestore.serverTimestamp = mockServerTimestamp;

    const { result } = renderHook(() => usePostActions());

    await result.current.updatePost('post-id', {
      title: 'Updated Title',
      content: 'Updated Content',
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        title: 'Updated Title',
        content: 'Updated Content',
        updatedAt: 'timestamp',
      })
    );
  });

  it('should delete a post', async () => {
    const mockDeleteDoc = vi.fn(() => Promise.resolve());
    const mockDoc = vi.fn(() => ({}));

    firestore.deleteDoc = mockDeleteDoc;
    firestore.doc = mockDoc;

    const { result } = renderHook(() => usePostActions());

    await result.current.deletePost('post-id');

    expect(mockDeleteDoc).toHaveBeenCalledWith({});
  });

  it('should handle errors when creating posts', async () => {
    const mockError = new Error('Creation failed');
    const mockAddDoc = vi.fn(() => Promise.reject(mockError));

    firestore.addDoc = mockAddDoc;
    firestore.collection = vi.fn(() => ({}));
    firestore.serverTimestamp = vi.fn(() => 'timestamp');

    const { result } = renderHook(() => usePostActions());

    await expect(
      result.current.createPost({
        title: 'Test',
        content: 'Content',
        type: 'general',
        status: 'published',
      })
    ).rejects.toThrow('Creation failed');

    await waitFor(() => {
      expect(result.current.error).toBe('Creation failed');
    });
  });
});
