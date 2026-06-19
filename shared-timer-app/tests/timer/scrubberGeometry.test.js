import {
  applyKeyboardStep,
  pointerToProgress,
  progressToRemainingMs
} from '../../src/features/timer/scrubberGeometry';

describe('scrubberGeometry', () => {
  const rect = { left: 0, top: 0, width: 100, height: 100 };

  test.each(['circle', 'dots', 'ring'])('%s maps clockwise cardinal points', mode => {
    expect(pointerToProgress(mode, { x: 50, y: 0 }, rect)).toBe(1);
    expect(pointerToProgress(mode, { x: 100, y: 50 }, rect)).toBeCloseTo(0.25);
    expect(pointerToProgress(mode, { x: 50, y: 100 }, rect)).toBeCloseTo(0.5);
    expect(pointerToProgress(mode, { x: 0, y: 50 }, rect)).toBeCloseTo(0.75);
  });

  test.each(['bar', 'battery', 'minimal'])('%s maps and clamps horizontal positions', mode => {
    expect(pointerToProgress(mode, { x: -20, y: 50 }, rect)).toBe(0);
    expect(pointerToProgress(mode, { x: 50, y: 50 }, rect)).toBe(0.5);
    expect(pointerToProgress(mode, { x: 120, y: 50 }, rect)).toBe(1);
  });

  test('hourglass maps bottom to empty and top to full', () => {
    expect(pointerToProgress('hourglass', { x: 50, y: 100 }, rect)).toBe(0);
    expect(pointerToProgress('hourglass', { x: 50, y: 50 }, rect)).toBe(0.5);
    expect(pointerToProgress('hourglass', { x: 50, y: 0 }, rect)).toBe(1);
  });

  test('quantizes remaining time to seconds and never returns zero', () => {
    expect(progressToRemainingMs(0, 600_000)).toBe(1_000);
    expect(progressToRemainingMs(0.501, 600_000)).toBe(301_000);
    expect(progressToRemainingMs(2, 600_000)).toBe(600_000);
  });

  test('supports accessible keyboard increments and bounds', () => {
    expect(applyKeyboardStep('ArrowRight', 10_000, 600_000)).toBe(11_000);
    expect(applyKeyboardStep('ArrowDown', 10_000, 600_000)).toBe(9_000);
    expect(applyKeyboardStep('PageUp', 10_000, 600_000)).toBe(70_000);
    expect(applyKeyboardStep('PageDown', 10_000, 600_000)).toBe(1_000);
    expect(applyKeyboardStep('Home', 10_000, 600_000)).toBe(1_000);
    expect(applyKeyboardStep('End', 10_000, 600_000)).toBe(600_000);
    expect(applyKeyboardStep('Escape', 10_000, 600_000)).toBeNull();
  });
});
