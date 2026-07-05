// @vitest-environment jsdom
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../src/context/AuthContext';

function AuthProbe() {
  return <div data-testid="auth-probe">ready</div>;
}

function createLocalStorageMock() {
  const store = new Map();
  return {
    clear: vi.fn(() => store.clear()),
    getItem: vi.fn((key) => store.has(key) ? store.get(key) : null),
    removeItem: vi.fn((key) => store.delete(key)),
    setItem: vi.fn((key, value) => store.set(key, String(value)))
  };
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  test('auth bootstrap preserves local preferences missing from /api/auth/me', async () => {
    localStorage.setItem('timerToken', 'token-1');
    localStorage.setItem('timerAuthUser', JSON.stringify({
      id: 'user-1',
      username: 'koala',
      displayName: 'Koala',
      preferences: {
        preTimerPingSeconds: 30,
        timerVisual: 'circle',
        theme: 'neon'
      }
    }));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'user-1',
        username: 'koala',
        displayName: 'Koala Server',
        preferences: { timerVisual: 'bar' }
      })
    }));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('timerAuthUser'));
      expect(stored.displayName).toBe('Koala Server');
      expect(stored.preferences).toMatchObject({
        preTimerPingSeconds: 30,
        timerVisual: 'bar',
        theme: 'neon'
      });
    });
  });
});
