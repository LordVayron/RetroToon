import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClickInterpreter, desiredSource, extractPlaylistId, nextAudioMode } from '../src/renderer/domain';

describe('playlist URL extraction', () => {
  it('extracts recognized YouTube playlist identifiers', () => {
    expect(extractPlaylistId(' https://www.youtube.com/playlist?list=PL1234567890_ab ')).toBe('PL1234567890_ab');
  });

  it('rejects video-only and non-YouTube URLs', () => {
    expect(extractPlaylistId('https://youtube.com/watch?v=abcdefghijk')).toBeNull();
    expect(extractPlaylistId('https://example.com/playlist?list=PL1234567890')).toBeNull();
  });
});

describe('audio modes', () => {
  it('selects only the expected source', () => {
    expect(desiredSource('AUTO_HOVER', false, false)).toBe('LOFI');
    expect(desiredSource('AUTO_HOVER', true, false)).toBe('CARTOON');
    expect(desiredSource('LOFI_LOCKED', true, false)).toBe('LOFI');
    expect(desiredSource('CARTOON_LOCKED', false, false)).toBe('CARTOON');
    expect(desiredSource('CARTOON_LOCKED', false, true)).toBe('NONE');
  });

  it('cycles modes in PRD order', () => {
    expect(nextAudioMode('AUTO_HOVER')).toBe('LOFI_LOCKED');
    expect(nextAudioMode('LOFI_LOCKED')).toBe('CARTOON_LOCKED');
    expect(nextAudioMode('CARTOON_LOCKED')).toBe('AUTO_HOVER');
  });
});

describe('click interpreter', () => {
  afterEach(() => vi.useRealTimers());

  it('delays and emits a single seek', () => {
    vi.useFakeTimers();
    const emit = vi.fn();
    const interpreter = new ClickInterpreter(emit);
    interpreter.press('back');
    expect(emit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(700);
    expect(emit).toHaveBeenCalledWith('SEEK_BACK');
  });

  it('turns a triple click into one navigation without a seek', () => {
    vi.useFakeTimers();
    const emit = vi.fn();
    const interpreter = new ClickInterpreter(emit);
    interpreter.press('forward');
    interpreter.press('forward');
    interpreter.press('forward');
    vi.advanceTimersByTime(800);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('NEXT');
  });

  it('keeps mixed directions independent', () => {
    vi.useFakeTimers();
    const emit = vi.fn();
    const interpreter = new ClickInterpreter(emit);
    interpreter.press('back');
    interpreter.press('forward');
    vi.advanceTimersByTime(700);
    expect(emit.mock.calls.map(([action]) => action)).toEqual(['SEEK_BACK', 'SEEK_FORWARD']);
  });

  it('ignores excess rapid clicks after navigation', () => {
    vi.useFakeTimers();
    const emit = vi.fn();
    const interpreter = new ClickInterpreter(emit);
    interpreter.press('forward');
    interpreter.press('forward');
    interpreter.press('forward');
    interpreter.press('forward');
    vi.advanceTimersByTime(700);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('NEXT');
  });
});
