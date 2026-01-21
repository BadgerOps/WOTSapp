import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Firebase if needed
global.mockFirebase = {
  auth: {},
  firestore: {},
  storage: {},
};
