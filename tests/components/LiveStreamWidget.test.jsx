// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LiveStreamWidget from '../../src/components/LiveStreamWidget';
import { fetchJson } from '../../src/utils/apiClient';

vi.mock('../../src/utils/apiClient', () => ({
  fetchJson: vi.fn(() => Promise.resolve([
    { user_login: 'handofblood', is_live: true, viewer_count: 1200 }
  ]))
}));

vi.mock('../../src/utils/clientStorage', () => ({
  isLiveStreamWidgetVisible: () => true
}));

vi.mock('../../src/hooks/usePageVisibility', () => ({
  usePageVisibility: () => true
}));

describe('LiveStreamWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
  });

  test('keeps the floating stream trigger circular', async () => {
    render(<LiveStreamWidget />);
    await waitFor(() => expect(fetchJson).toHaveBeenCalledWith('/api/twitch/status', { token: '' }));

    const trigger = screen.getByRole('button', { name: /stream umschalten/i });
    expect(trigger).toHaveClass('stream-widget-trigger');
    expect(trigger).toHaveStyle({
      width: '56px',
      height: '56px',
      borderRadius: '50%'
    });
  });

  test('supports pointer dragging for touch capable devices', async () => {
    render(<LiveStreamWidget />);

    fireEvent.click(screen.getByRole('button', { name: /stream umschalten/i }));
    const handOfBlood = screen.getByRole('button', { name: /handofblood/i });
    await waitFor(() => expect(handOfBlood).toBeEnabled());
    fireEvent.click(handOfBlood);

    const widget = screen.getByTitle('Live Stream').closest('.glass-card');
    const dragHandle = widget.querySelector('.drag-handle');

    fireEvent.pointerDown(dragHandle, { clientX: 700, clientY: 520, pointerType: 'touch' });
    fireEvent.pointerMove(window, { clientX: 650, clientY: 500, pointerType: 'touch' });
    fireEvent.pointerUp(window, { pointerType: 'touch' });

    expect(widget.style.left).toBe('554px');
    expect(widget.style.top).toBe('448px');
  });
});
