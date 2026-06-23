import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import React from 'react';

// Set up React testing environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Ensure React is properly initialized
globalThis.React = React;

// Set up cleanup after each test
afterEach(() => {
  cleanup();
});

globalThis.jest = {
  fn: vi.fn.bind(vi),
  mock: vi.mock.bind(vi),
  spyOn: vi.spyOn.bind(vi),
  clearAllMocks: vi.clearAllMocks.bind(vi),
  resetAllMocks: vi.resetAllMocks.bind(vi),
  restoreAllMocks: vi.restoreAllMocks.bind(vi)
};
