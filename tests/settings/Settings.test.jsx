// @vitest-environment jsdom
import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Settings from '../../src/pages/Settings';
import { fetchJson } from '../../src/utils/apiClient';

vi.mock('react-router-dom', () => ({
  Link: ({ children, ...props }) => <a {...props}>{children}</a>,
  useNavigate: () => vi.fn()
}));

vi.mock('../../src/context/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() })
}));

vi.mock('../../src/features/casino/ChipSkinContext', () => ({
  useChipSkin: () => ({
    skin: 'classic',
    setSkin: vi.fn(),
    availableSkins: [],
    loadingSkins: false,
    getSkinImage: vi.fn()
  })
}));

vi.mock('../../src/features/casino/chipConfig', () => ({
  CHIP_SKINS: {}
}));

vi.mock('../../src/utils/pokemonUtils', () => ({
  getNextPokemon: vi.fn()
}));

vi.mock('../../src/utils/soundGenerator', () => ({
  ALARM_SOUNDS: { CLASSIC_BEEP: 'Classic Beep' },
  playAlarmSound: vi.fn()
}));

vi.mock('../../src/pages/Friends', () => ({
  default: () => <div data-testid="friends-placeholder" />
}));

vi.mock('../../src/utils/clientStorage', () => ({
  getTimerToken: () => null,
  isLiveStreamWidgetVisible: () => false,
  setLiveStreamWidgetVisibility: vi.fn()
}));

vi.mock('../../src/utils/apiClient', () => ({
  fetchJson: vi.fn((url) => {
    if (url === '/api/esports/teams') return Promise.resolve([]);
    if (url === '/api/pokemon') return Promise.resolve([]);
    if (url === '/api/pokemon/configs') return Promise.resolve({ colors: {} });
    if (url === '/api/users') return Promise.resolve({ success: true });
    return Promise.resolve({});
  })
}));

function SettingsHarness() {
  const [user, setUser] = useState({
    id: 'user-1',
    username: 'koala',
    displayName: 'Koala',
    preferences: {
      timerVisual: 'circle',
      preTimerPingSeconds: 30
    }
  });

  return <Settings user={user} setUser={setUser} socket={{}} />;
}

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('saves pre-timer ping preference through an explicit settings save action', async () => {
    render(<SettingsHarness />);

    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      const saveCall = fetchJson.mock.calls.find(([url]) => url === '/api/users');
      expect(saveCall).toBeTruthy();
      const [, options] = saveCall;
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toMatchObject({
        id: 'user-1',
        displayName: 'Koala',
        preferences: {
          preTimerPingSeconds: 30
        }
      });
    });
  });
});
