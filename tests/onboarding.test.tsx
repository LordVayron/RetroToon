import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/renderer/App';
import { createDefaultSettings } from '../src/shared/schema';
import type { AppSettings, RetroToonAPI } from '../src/shared/types';

function mockAPI(overrides: Partial<RetroToonAPI> = {}): RetroToonAPI {
  const defaults = createDefaultSettings('en');
  return {
    loadSettings: vi.fn(async () => defaults),
    saveSettings: vi.fn(async (settings: AppSettings) => settings),
    setWindowPreset: vi.fn(async () => undefined),
    setAlwaysOnTop: vi.fn(async () => undefined),
    minimizeWindow: vi.fn(async () => undefined),
    resolvePlaylistVideos: vi.fn(async () => ['abcdefghijk']),
    toggleFullscreen: vi.fn(async () => false),
    importSettings: vi.fn(async () => null),
    applyImport: vi.fn(async (settings: AppSettings) => settings),
    exportSettings: vi.fn(async () => true),
    showContextMenu: vi.fn(),
    onOpenSettings: vi.fn(() => () => undefined),
    ...overrides
  };
}

describe('first-run onboarding', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: true })) });
  });

  afterEach(() => vi.restoreAllMocks());

  it('requires two validated playlists and saves both as active', async () => {
    const api = mockAPI();
    Object.defineProperty(window, 'retrotoon', { configurable: true, value: api });
    render(<App />);

    fireEvent.change(await screen.findByLabelText(/^CARTOON PLAYLIST URL/), { target: { value: 'https://youtube.com/playlist?list=PLcartoon12345' } });
    fireEvent.change(screen.getByLabelText(/^MUSIC PLAYLIST URL/), { target: { value: 'https://youtube.com/playlist?list=PLmusic1234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'CONNECT PLAYLISTS' }));

    await waitFor(() => expect(api.saveSettings).toHaveBeenCalled());
    const saved = vi.mocked(api.saveSettings).mock.calls[0][0];
    expect(saved.playlists).toHaveLength(2);
    expect(saved.playlists.map((item) => item.sourceType)).toEqual(['CARTOON', 'LOFI']);
    expect(saved.activeCartoonPlaylistId).toBe(saved.playlists[0].id);
    expect(saved.activeLofiPlaylistId).toBe(saved.playlists[1].id);
  });

  it('does not save an unavailable playlist', async () => {
    const api = mockAPI({ resolvePlaylistVideos: vi.fn(async () => []) });
    Object.defineProperty(window, 'retrotoon', { configurable: true, value: api });
    render(<App />);

    fireEvent.change(await screen.findByLabelText(/^CARTOON PLAYLIST URL/), { target: { value: 'https://youtube.com/playlist?list=PLcartoon12345' } });
    fireEvent.change(screen.getByLabelText(/^MUSIC PLAYLIST URL/), { target: { value: 'https://youtube.com/playlist?list=PLmusic1234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'CONNECT PLAYLISTS' }));

    expect(await screen.findAllByText('The playlist is empty, private, unavailable, or could not be reached.')).toHaveLength(2);
    expect(api.saveSettings).not.toHaveBeenCalled();
  });

  it('does not save when playlist validation loses its connection', async () => {
    const api = mockAPI({ resolvePlaylistVideos: vi.fn(async () => { throw new Error('offline'); }) });
    Object.defineProperty(window, 'retrotoon', { configurable: true, value: api });
    render(<App />);

    fireEvent.change(await screen.findByLabelText(/^CARTOON PLAYLIST URL/), { target: { value: 'https://youtube.com/playlist?list=PLcartoon12345' } });
    fireEvent.change(screen.getByLabelText(/^MUSIC PLAYLIST URL/), { target: { value: 'https://youtube.com/playlist?list=PLmusic1234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'CONNECT PLAYLISTS' }));

    expect(await screen.findAllByText('The playlist is empty, private, unavailable, or could not be reached.')).toHaveLength(2);
    expect(api.saveSettings).not.toHaveBeenCalled();
  });

  it('rejects the same playlist in both onboarding fields before connecting', async () => {
    const api = mockAPI();
    Object.defineProperty(window, 'retrotoon', { configurable: true, value: api });
    render(<App />);
    const url = 'https://youtube.com/playlist?list=PLduplicate1234';

    fireEvent.change(await screen.findByLabelText(/^CARTOON PLAYLIST URL/), { target: { value: url } });
    fireEvent.change(screen.getByLabelText(/^MUSIC PLAYLIST URL/), { target: { value: url } });
    fireEvent.click(screen.getByRole('button', { name: 'CONNECT PLAYLISTS' }));

    expect(await screen.findAllByText('That playlist is already saved in this collection.')).toHaveLength(2);
    expect(api.resolvePlaylistVideos).not.toHaveBeenCalled();
    expect(api.saveSettings).not.toHaveBeenCalled();
  });

  it('renders the detected Spanish locale and persists a language change', async () => {
    const api = mockAPI({ loadSettings: vi.fn(async () => createDefaultSettings('es')) });
    Object.defineProperty(window, 'retrotoon', { configurable: true, value: api });
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'SINTONIZA TU RECEPTOR' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('IDIOMA'), { target: { value: 'en' } });

    await waitFor(() => expect(api.saveSettings).toHaveBeenCalled());
    expect(vi.mocked(api.saveSettings).mock.calls[0][0].locale).toBe('en');
  });
});
