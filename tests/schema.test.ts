import { describe, expect, it } from 'vitest';
import { createDefaultSettings, ensureLocale, parseSettings } from '../src/shared/schema';

describe('settings schema', () => {
  it('accepts defaults', () => {
    expect(parseSettings(createDefaultSettings()).schemaVersion).toBe(1);
  });

  it('rejects persisted global mute and unknown fields', () => {
    expect(() => parseSettings({ ...createDefaultSettings(), globalMuted: true })).toThrow();
  });

  it('rejects out-of-range volumes', () => {
    expect(() => parseSettings({ ...createDefaultSettings(), cartoonVolume: 101 })).toThrow();
  });

  it('accepts a persisted custom window size and rejects undersized windows', () => {
    expect(parseSettings({ ...createDefaultSettings(), windowSize: { width: 720, height: 576 } }).windowSize).toEqual({ width: 720, height: 576 });
    expect(() => parseSettings({ ...createDefaultSettings(), windowSize: { width: 200, height: 160 } })).toThrow();
  });

  it('ships public defaults without personal playlists', () => {
    const settings = createDefaultSettings('es');
    expect(settings.playlists).toEqual([]);
    expect(settings.activeCartoonPlaylistId).toBeUndefined();
    expect(settings.activeLofiPlaylistId).toBeUndefined();
    expect(settings.locale).toBe('es');
  });

  it('preserves v1.0.2 playlists when locale is absent', () => {
    const now = new Date().toISOString();
    const legacy = {
      ...createDefaultSettings(),
      locale: undefined,
      playlists: [{ id: '10000000-0000-4000-8000-000000000001', sourceType: 'CARTOON' as const, youtubePlaylistId: 'PLlegacy12345', originalUrl: 'https://youtube.com/playlist?list=PLlegacy12345', displayName: 'Legacy', enabled: true, sortOrder: 0, createdAt: now, updatedAt: now }],
      activeCartoonPlaylistId: '10000000-0000-4000-8000-000000000001'
    };
    const parsed = ensureLocale(parseSettings(legacy), 'es');
    expect(parsed.playlists).toHaveLength(1);
    expect(parsed.playlists[0].displayName).toBe('Legacy');
    expect(parsed.locale).toBe('es');
  });
});
