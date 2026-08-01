import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppLocale, AppSettings, AudioMode, PlaylistRecord, SourceType, WindowPreset } from '../shared/types';
import { AudioController } from './audioController';
import { ClickInterpreter, extractPlaylistId, nextAudioMode, type TransportAction } from './domain';
import { YouTubePlayerAdapter } from './youtube';
import { copyFor, type AppCopy } from './i18n';

const MODE_LABELS: Record<AudioMode, string> = {
  AUTO_HOVER: 'AUTO / ホバー',
  LOFI_LOCKED: 'LO-FI / 固定',
  CARTOON_LOCKED: 'TOON / 固定'
};

const ERROR_LABELS: Record<number, string> = {
  2: 'Invalid media request',
  5: 'HTML5 playback failed',
  100: 'Video removed or private',
  101: 'Embedding disabled',
  150: 'Embedding disabled',
  153: 'YouTube could not identify RetroToon'
};

function activePlaylist(settings: AppSettings, type: SourceType): PlaylistRecord | undefined {
  const id = type === 'CARTOON' ? settings.activeCartoonPlaylistId : settings.activeLofiPlaylistId;
  return settings.playlists.find((playlist) => playlist.id === id && playlist.enabled && playlist.sourceType === type);
}

function OnboardingPanel({ settings, onComplete, onLocale }: { settings: AppSettings; onComplete: (settings: AppSettings) => Promise<void>; onLocale: (locale: AppLocale) => Promise<void> }) {
  const copy = copyFor(settings.locale);
  const existingCartoon = activePlaylist(settings, 'CARTOON');
  const existingLofi = activePlaylist(settings, 'LOFI');
  const [urls, setUrls] = useState({ CARTOON: '', LOFI: '' });
  const [errors, setErrors] = useState({ CARTOON: '', LOFI: '' });
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    const required: SourceType[] = [!existingCartoon && 'CARTOON', !existingLofi && 'LOFI'].filter(Boolean) as SourceType[];
    const ids = new Map<SourceType, string>();
    const nextErrors = { CARTOON: '', LOFI: '' };
    for (const type of required) {
      const id = extractPlaylistId(urls[type].trim());
      if (!id) nextErrors[type] = copy.invalidPlaylist;
      else if (settings.playlists.some((item) => item.sourceType === type && item.youtubePlaylistId === id)) nextErrors[type] = copy.duplicatePlaylist;
      else ids.set(type, id);
    }
    if (required.length === 2 && ids.get('CARTOON') === ids.get('LOFI')) {
      nextErrors.CARTOON = copy.duplicatePlaylist;
      nextErrors.LOFI = copy.duplicatePlaylist;
    }
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setChecking(true);
    try {
      const results = await Promise.all(required.map(async (type) => ({ type, videos: await window.retrotoon.resolvePlaylistVideos(ids.get(type)!) })));
      const unavailable = results.filter((result) => result.videos.length === 0);
      if (unavailable.length > 0) {
        setErrors((current) => unavailable.reduce((next, result) => ({ ...next, [result.type]: copy.unavailablePlaylist }), current));
        return;
      }
      const now = new Date().toISOString();
      const additions = required.map((type): PlaylistRecord => ({
        id: crypto.randomUUID(),
        sourceType: type,
        youtubePlaylistId: ids.get(type)!,
        originalUrl: urls[type].trim(),
        displayName: type === 'CARTOON' ? copy.cartoonPlaylistName : copy.lofiPlaylistName,
        enabled: true,
        sortOrder: settings.playlists.filter((item) => item.sourceType === type).length,
        createdAt: now,
        updatedAt: now
      }));
      const cartoon = existingCartoon ?? additions.find((item) => item.sourceType === 'CARTOON')!;
      const lofi = existingLofi ?? additions.find((item) => item.sourceType === 'LOFI')!;
      await onComplete({ ...settings, playlists: [...settings.playlists, ...additions], activeCartoonPlaylistId: cartoon.id, activeLofiPlaylistId: lofi.id });
    } catch {
      for (const type of required) nextErrors[type] = copy.unavailablePlaylist;
      setErrors(nextErrors);
    } finally {
      setChecking(false);
    }
  };

  const field = (type: SourceType, label: string, existing?: PlaylistRecord) => (
    <label className={`onboarding-field ${existing ? 'is-connected' : ''}`}>
      <span>{label}<i>{existing ? copy.connected : '01'}</i></span>
      <input disabled={Boolean(existing) || checking} value={existing?.originalUrl ?? urls[type]} placeholder={copy.playlistPlaceholder} onChange={(event) => setUrls((current) => ({ ...current, [type]: event.target.value }))} />
      {errors[type] && <small role="alert">{errors[type]}</small>}
    </label>
  );

  return (
    <section className="onboarding-panel" aria-label={copy.onboardingTitle}>
      <header><div><small>{copy.onboardingEyebrow}</small><h1>{copy.onboardingTitle}</h1></div><label>{copy.language}<select value={settings.locale ?? 'en'} disabled={checking} onChange={(event) => void onLocale(event.target.value as AppLocale)}><option value="en">{copy.english}</option><option value="es">{copy.spanish}</option></select></label></header>
      <p>{copy.onboardingBody}</p>
      <div className="onboarding-grid">{field('CARTOON', copy.cartoonUrl, existingCartoon)}{field('LOFI', copy.musicUrl, existingLofi)}</div>
      <footer><small>{copy.onboardingPrivacy}</small><button type="button" disabled={checking} onClick={() => void submit()}>{checking ? copy.connecting : copy.connectPlaylists}</button></footer>
    </section>
  );
}

function SettingsPanel({ initial, onClose, onSave }: { initial: AppSettings; onClose: () => void; onSave: (value: AppSettings) => Promise<void> }) {
  const [draft, setDraft] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [newUrls, setNewUrls] = useState({ CARTOON: '', LOFI: '' });
  const [errors, setErrors] = useState({ CARTOON: '', LOFI: '' });
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState<SourceType | null>(null);
  const copy = copyFor(draft.locale);

  const change = (update: (current: AppSettings) => AppSettings) => {
    setDraft((current) => update(current));
    setDirty(true);
  };

  const close = () => {
    if (!dirty || window.confirm(copy.discardChanges)) onClose();
  };

  const addPlaylist = async (type: SourceType) => {
    const raw = newUrls[type].trim();
    const playlistId = extractPlaylistId(raw);
    if (!playlistId) {
      setErrors((current) => ({ ...current, [type]: copy.invalidPlaylist }));
      return;
    }
    if (draft.playlists.some((item) => item.sourceType === type && item.youtubePlaylistId === playlistId)) {
      setErrors((current) => ({ ...current, [type]: copy.duplicatePlaylist }));
      return;
    }
    setValidating(type);
    setErrors((current) => ({ ...current, [type]: '' }));
    try {
      if ((await window.retrotoon.resolvePlaylistVideos(playlistId)).length === 0) {
        setErrors((current) => ({ ...current, [type]: copy.unavailablePlaylist }));
        return;
      }
    } catch {
      setErrors((current) => ({ ...current, [type]: copy.unavailablePlaylist }));
      return;
    } finally {
      setValidating(null);
    }
    const now = new Date().toISOString();
    const record: PlaylistRecord = {
      id: crypto.randomUUID(),
      sourceType: type,
      youtubePlaylistId: playlistId,
      originalUrl: raw,
      displayName: type === 'CARTOON' ? copy.cartoonPlaylistName : copy.lofiPlaylistName,
      enabled: true,
      sortOrder: draft.playlists.filter((item) => item.sourceType === type).length,
      createdAt: now,
      updatedAt: now
    };
    change((current) => ({
      ...current,
      playlists: [...current.playlists, record],
      activeCartoonPlaylistId: type === 'CARTOON' && !current.activeCartoonPlaylistId ? record.id : current.activeCartoonPlaylistId,
      activeLofiPlaylistId: type === 'LOFI' && !current.activeLofiPlaylistId ? record.id : current.activeLofiPlaylistId
    }));
    setNewUrls((current) => ({ ...current, [type]: '' }));
    setErrors((current) => ({ ...current, [type]: '' }));
  };

  const movePlaylist = (type: SourceType, id: string, delta: number) => {
    change((current) => {
      const group = current.playlists.filter((item) => item.sourceType === type).sort((a, b) => a.sortOrder - b.sortOrder);
      const index = group.findIndex((item) => item.id === id);
      const target = Math.max(0, Math.min(group.length - 1, index + delta));
      if (index === target) return current;
      [group[index], group[target]] = [group[target], group[index]];
      const order = new Map(group.map((item, position) => [item.id, position]));
      return { ...current, playlists: current.playlists.map((item) => order.has(item.id) ? { ...item, sortOrder: order.get(item.id)! } : item) };
    });
  };

  const removePlaylist = (item: PlaylistRecord) => {
    if (!window.confirm(copy.removeConfirm(item.displayName))) return;
    change((current) => {
      const playlists = current.playlists.filter((playlist) => playlist.id !== item.id);
      const next = playlists.find((playlist) => playlist.sourceType === item.sourceType && playlist.enabled)?.id;
      return {
        ...current,
        playlists,
        activeCartoonPlaylistId: item.sourceType === 'CARTOON' && current.activeCartoonPlaylistId === item.id ? next : current.activeCartoonPlaylistId,
        activeLofiPlaylistId: item.sourceType === 'LOFI' && current.activeLofiPlaylistId === item.id ? next : current.activeLofiPlaylistId,
        playbackSnapshots: current.playbackSnapshots.filter((snapshot) => snapshot.playlistRecordId !== item.id),
        unavailableItems: current.unavailableItems.filter((entry) => entry.playlistRecordId !== item.id)
      };
    });
  };

  const importSettings = async () => {
    try {
      const preview = await window.retrotoon.importSettings();
      if (!preview) return;
      const replace = window.confirm(copy.importQuestion(preview.cartoonPlaylists, preview.lofiPlaylists));
      if (!replace && !window.confirm(copy.mergeQuestion)) return;
      const imported = await window.retrotoon.applyImport(preview.settings, replace ? 'replace' : 'merge');
      setDraft(imported);
      setDirty(false);
    } catch (error) {
      window.alert(copy.importFailed(error instanceof Error ? error.message : copy.unavailablePlaylist));
    }
  };

  const playlistSection = (type: SourceType, title: string) => {
    const items = draft.playlists.filter((item) => item.sourceType === type).sort((a, b) => a.sortOrder - b.sortOrder);
    const activeId = type === 'CARTOON' ? draft.activeCartoonPlaylistId : draft.activeLofiPlaylistId;
    return (
      <section className="settings-section">
        <div className="section-heading"><span>{title}</span><small>{type === 'CARTOON' ? copy.sequential : copy.shuffle}</small></div>
        <div className="playlist-add">
          <input aria-label={`New ${title} URL`} placeholder="https://youtube.com/playlist?list=…" value={newUrls[type]} onChange={(event) => setNewUrls((current) => ({ ...current, [type]: event.target.value }))} />
          <button type="button" disabled={validating !== null} onClick={() => void addPlaylist(type)}>{validating === type ? copy.checking : copy.add}</button>
        </div>
        {errors[type] && <p className="field-error" role="alert">{errors[type]}</p>}
        <div className="playlist-list">
          {items.length === 0 && <p className="empty-list">{copy.noPlaylists}</p>}
          {items.map((item, index) => (
            <article className={`playlist-row ${activeId === item.id ? 'is-active' : ''}`} key={item.id}>
              <label className="radio-label">
                <input type="radio" name={`active-${type}`} disabled={!item.enabled} checked={activeId === item.id} onChange={() => change((current) => ({ ...current, [type === 'CARTOON' ? 'activeCartoonPlaylistId' : 'activeLofiPlaylistId']: item.id }))} />
                <span className="sr-only">{copy.setActive}</span>
              </label>
              <input className="playlist-name" aria-label="Playlist name" value={item.displayName} onChange={(event) => change((current) => ({ ...current, playlists: current.playlists.map((playlist) => playlist.id === item.id ? { ...playlist, displayName: event.target.value, updatedAt: new Date().toISOString() } : playlist) }))} />
              <label className="toggle-mini"><input type="checkbox" checked={item.enabled} onChange={(event) => change((current) => {
                const enabled = event.target.checked;
                const playlists = current.playlists.map((playlist) => playlist.id === item.id ? { ...playlist, enabled } : playlist);
                const nextActive = playlists.find((playlist) => playlist.sourceType === type && playlist.enabled)?.id;
                return {
                  ...current,
                  playlists,
                  activeCartoonPlaylistId: type === 'CARTOON' && !enabled && current.activeCartoonPlaylistId === item.id ? nextActive : current.activeCartoonPlaylistId,
                  activeLofiPlaylistId: type === 'LOFI' && !enabled && current.activeLofiPlaylistId === item.id ? nextActive : current.activeLofiPlaylistId
                };
              })} /><span>{item.enabled ? 'ON' : 'OFF'}</span></label>
              <button type="button" aria-label={copy.moveUp} disabled={index === 0} onClick={() => movePlaylist(type, item.id, -1)}>↑</button>
              <button type="button" aria-label={copy.moveDown} disabled={index === items.length - 1} onClick={() => movePlaylist(type, item.id, 1)}>↓</button>
              <button type="button" className="danger" aria-label={copy.removePlaylist} onClick={() => removePlaylist(item)}>×</button>
            </article>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="settings-panel" role="dialog" aria-modal="true" aria-label="RetroToon settings">
      <header className="settings-header">
        <div><small>CONTROL DECK / 設定</small><h2>{copy.settings}</h2></div>
        <button type="button" className="close-settings" aria-label={copy.closeSettings} onClick={close}>×</button>
      </header>
      <div className="settings-scroll">
        {playlistSection('CARTOON', copy.cartoonPlaylists)}
        {playlistSection('LOFI', copy.lofiPlaylists)}
        <section className="settings-section two-column">
          <label>{copy.toonVolume} <output>{draft.cartoonVolume}</output><input type="range" min="0" max="100" value={draft.cartoonVolume} onChange={(event) => change((current) => ({ ...current, cartoonVolume: Number(event.target.value) }))} /></label>
          <label>{copy.lofiVolume} <output>{draft.lofiVolume}</output><input type="range" min="0" max="100" value={draft.lofiVolume} onChange={(event) => change((current) => ({ ...current, lofiVolume: Number(event.target.value) }))} /></label>
        </section>
        <section className="settings-section options-grid">
          <label>{copy.windowSize}<select value={draft.windowPreset} onChange={(event) => change((current) => ({ ...current, windowPreset: event.target.value as WindowPreset }))}><option value="SMALL">Small · 420×336</option><option value="MEDIUM">Medium · 600×480</option><option value="LARGE">Large · 840×672</option></select></label>
          <label>{copy.language}<select value={draft.locale ?? 'en'} onChange={(event) => change((current) => ({ ...current, locale: event.target.value as AppLocale }))}><option value="en">{copy.english}</option><option value="es">{copy.spanish}</option></select></label>
          <label className="check-option"><input type="checkbox" checked={draft.alwaysOnTop} onChange={(event) => change((current) => ({ ...current, alwaysOnTop: event.target.checked }))} /> {copy.alwaysOnTop}</label>
          <label className="check-option"><input type="checkbox" checked={draft.crtEffectsEnabled} onChange={(event) => change((current) => ({ ...current, crtEffectsEnabled: event.target.checked }))} /> {copy.crtEffects}</label>
          <button type="button" onClick={() => void window.retrotoon.toggleFullscreen()}>{copy.fullscreen}</button>
        </section>
        {draft.unavailableItems.length > 0 && <section className="settings-section"><div className="section-heading"><span>{copy.unavailableItems}</span><button type="button" onClick={() => change((current) => ({ ...current, unavailableItems: [] }))}>{copy.clearLog}</button></div><ul className="error-log">{draft.unavailableItems.map((entry) => <li key={entry.id}>{entry.errorCategory} · {entry.youtubeVideoId || 'unknown item'} · {entry.occurrenceCount}×</li>)}</ul></section>}
        <section className="settings-section data-actions"><button type="button" onClick={() => void importSettings()}>{copy.importJson}</button><button type="button" onClick={() => void window.retrotoon.exportSettings(draft)}>{copy.exportJson}</button></section>
      </div>
      <footer className="settings-footer"><span>{dirty ? copy.unsavedChanges : copy.allSaved}</span><button type="button" disabled={!dirty || saving} onClick={async () => { setSaving(true); await onSave(draft); setSaving(false); setDirty(false); }}>{saving ? copy.saving : copy.saveSettings}</button></footer>
    </div>
  );
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [booted, setBooted] = useState(false);
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [playersReady, setPlayersReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [status, setStatus] = useState('STANDBY');
  const [error, setError] = useState('');
  const [videoView, setVideoView] = useState<SourceType>('CARTOON');
  const [nowPlaying, setNowPlaying] = useState({ title: '', author: '' });
  const cartoonRef = useRef<YouTubePlayerAdapter | undefined>(undefined);
  const lofiRef = useRef<YouTubePlayerAdapter | undefined>(undefined);
  const audioRef = useRef<AudioController | undefined>(undefined);
  const hoverTimer = useRef<number | undefined>(undefined);
  const settingsRef = useRef<AppSettings | null>(null);

  useEffect(() => {
    void window.retrotoon.loadSettings().then((value) => { setSettings(value); settingsRef.current = value; });
    const timer = window.setTimeout(() => setBooted(true), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 80 : 900);
    const removeListener = window.retrotoon.onOpenSettings(() => setSettingsOpen(true));
    return () => { window.clearTimeout(timer); removeListener(); };
  }, []);

  const persist = useCallback(async (next: AppSettings) => {
    const saved = await window.retrotoon.saveSettings(next);
    settingsRef.current = saved;
    setSettings(saved);
    return saved;
  }, []);

  const handlePlayerError = useCallback((source: SourceType, playlistId: string, code: number, videoId: string) => {
    const current = settingsRef.current;
    if (!current) return;
    const copy = copyFor(current.locale);
    const now = new Date().toISOString();
    const existing = current.unavailableItems.find((item) => item.playlistRecordId === playlistId && item.youtubeVideoId === videoId && item.errorCode === code);
    const unavailableItems = existing
      ? current.unavailableItems.map((item) => item.id === existing.id ? { ...item, lastDetectedAt: now, occurrenceCount: item.occurrenceCount + 1 } : item)
      : [...current.unavailableItems, { id: crypto.randomUUID(), playlistRecordId: playlistId, youtubeVideoId: videoId, errorCategory: ERROR_LABELS[code] ?? 'Unknown playback failure', errorCode: code, firstDetectedAt: now, lastDetectedAt: now, occurrenceCount: 1 }];
    const next = { ...current, unavailableItems };
    settingsRef.current = next;
    setSettings(next);
    void window.retrotoon.saveSettings(next);
    setError(`${source === 'CARTOON' ? copy.cartoon : copy.music}: ${copy.unavailablePlaylist}`);
    if (code !== 153) (source === 'CARTOON' ? cartoonRef.current : lofiRef.current)?.next();
  }, []);

  useEffect(() => {
    if (!settings || started) return;
    const cartoon = activePlaylist(settings, 'CARTOON');
    const lofi = activePlaylist(settings, 'LOFI');
    if (!cartoon || !lofi) return;
    let cancelled = false;
    setPlayersReady(false);
    setError('');
    const prepare = async () => {
      try {
        const [cartoonVideos, lofiVideos] = await Promise.all([
          window.retrotoon.resolvePlaylistVideos(cartoon.youtubePlaylistId),
          window.retrotoon.resolvePlaylistVideos(lofi.youtubePlaylistId)
        ]);
        const copy = copyFor(settings.locale);
        const cartoonAdapter = new YouTubePlayerAdapter('cartoon-player', 'CARTOON', { onError: (code, videoId) => handlePlayerError('CARTOON', cartoon.id, code, videoId) }, copy);
        const lofiAdapter = new YouTubePlayerAdapter('lofi-player', 'LOFI', { onError: (code, videoId) => handlePlayerError('LOFI', lofi.id, code, videoId) }, copy);
        await Promise.all([
          cartoonAdapter.initialize(cartoon.youtubePlaylistId, settings.playbackSnapshots.find((snapshot) => snapshot.sourceType === 'CARTOON' && snapshot.playlistRecordId === cartoon.id), cartoonVideos),
          lofiAdapter.initialize(lofi.youtubePlaylistId, settings.playbackSnapshots.find((snapshot) => snapshot.sourceType === 'LOFI' && snapshot.playlistRecordId === lofi.id), lofiVideos)
        ]);
        if (cancelled) {
          cartoonAdapter.destroy();
          lofiAdapter.destroy();
          return;
        }
        cartoonRef.current = cartoonAdapter;
        lofiRef.current = lofiAdapter;
        cartoonAdapter.mute();
        lofiAdapter.mute();
        setPlayersReady(true);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : copyFor(settings.locale).playersFailed);
      }
    };
    void prepare();
    return () => { cancelled = true; };
  }, [settings?.activeCartoonPlaylistId, settings?.activeLofiPlaylistId, handlePlayerError]);

  const applyAudio = useCallback(async (overrides?: { mode?: AudioMode; hover?: boolean; mute?: boolean; values?: AppSettings }) => {
    const values = overrides?.values ?? settingsRef.current;
    if (!values || !audioRef.current || !started) return;
    const copy = copyFor(values.locale);
    const source = await audioRef.current.apply(overrides?.mode ?? values.audioMode, overrides?.hover ?? hovered, overrides?.mute ?? muted, values.cartoonVolume, values.lofiVolume);
    setStatus(source === 'CARTOON' ? copy.toonAudio : source === 'LOFI' ? copy.lofiAudio : copy.muted);
  }, [hovered, muted, started]);

  const start = async () => {
    if (!settings || !playersReady || !cartoonRef.current || !lofiRef.current) return;
    const cartoon = activePlaylist(settings, 'CARTOON');
    const lofi = activePlaylist(settings, 'LOFI');
    if (!cartoon || !lofi) {
      setError(copyFor(settings.locale).addBothPlaylists);
      setSettingsOpen(true);
      return;
    }
    setStarting(true);
    setError('');
    try {
      const cartoonAdapter = cartoonRef.current;
      const lofiAdapter = lofiRef.current;
      cartoonAdapter.mute();
      lofiAdapter.setVolume(settings.lofiVolume);
      lofiAdapter.mute();
      lofiAdapter.play();
      cartoonAdapter.play();
      await Promise.all([lofiAdapter.waitUntilPlaying(), cartoonAdapter.waitUntilPlaying()]);
      lofiAdapter.shuffle();
      audioRef.current = new AudioController(cartoonAdapter, lofiAdapter);
      setStarted(true);
      setStatus(copyFor(settings.locale).lofiAudio);
      await audioRef.current.apply(settings.audioMode, false, false, settings.cartoonVolume, settings.lofiVolume);
    } catch (reason) {
      cartoonRef.current?.mute();
      lofiRef.current?.mute();
      setError(reason instanceof Error ? reason.message : copyFor(settings.locale).playersFailed);
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (!started || !settings) return;
    const saveSnapshots = () => {
      const cartoon = activePlaylist(settingsRef.current!, 'CARTOON');
      const lofi = activePlaylist(settingsRef.current!, 'LOFI');
      const snapshots = [cartoon && cartoonRef.current?.snapshot(cartoon.id), lofi && lofiRef.current?.snapshot(lofi.id)].filter(Boolean);
      const current = settingsRef.current!;
      const next = { ...current, playbackSnapshots: [...current.playbackSnapshots.filter((item) => !snapshots.some((saved) => saved?.sourceType === item.sourceType)), ...snapshots] as AppSettings['playbackSnapshots'] };
      settingsRef.current = next;
      void window.retrotoon.saveSettings(next);
    };
    const timer = window.setInterval(saveSnapshots, 15000);
    window.addEventListener('beforeunload', saveSnapshots);
    return () => { window.clearInterval(timer); window.removeEventListener('beforeunload', saveSnapshots); };
  }, [settings, started]);

  useEffect(() => {
    if (!playersReady) return;
    const updateNowPlaying = () => {
      const metadata = lofiRef.current?.metadata();
      if (metadata?.title) setNowPlaying({ title: metadata.title, author: metadata.author || copyFor(settingsRef.current?.locale).unknownTransmitter });
    };
    updateNowPlaying();
    const timer = window.setInterval(updateNowPlaying, 1200);
    return () => window.clearInterval(timer);
  }, [playersReady]);

  const transport = useCallback((action: TransportAction) => {
    if (action === 'SEEK_BACK') cartoonRef.current?.seekBy(-30);
    if (action === 'SEEK_FORWARD') cartoonRef.current?.seekBy(30);
    if (action === 'PREVIOUS') cartoonRef.current?.previous();
    if (action === 'NEXT') cartoonRef.current?.next();
  }, []);
  const clicker = useMemo(() => new ClickInterpreter(transport), [transport]);
  useEffect(() => () => clicker.dispose(), [clicker]);

  const changeMode = async () => {
    if (!settings) return;
    const mode = nextAudioMode(settings.audioMode);
    const next = await persist({ ...settings, audioMode: mode });
    await applyAudio({ mode, values: next });
  };

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    await applyAudio({ mute: next });
  };

  const enterScreen = () => {
    if (!started || settingsOpen || settings?.audioMode !== 'AUTO_HOVER') return;
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => { setHovered(true); void applyAudio({ hover: true }); }, 100);
  };
  const leaveScreen = () => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => { setHovered(false); void applyAudio({ hover: false }); }, 150);
  };

  const saveSettings = async (draft: AppSettings) => {
    const previous = settings!;
    const saved = await persist(draft);
    if (saved.windowPreset !== previous.windowPreset) await window.retrotoon.setWindowPreset(saved.windowPreset);
    if (saved.alwaysOnTop !== previous.alwaysOnTop) await window.retrotoon.setAlwaysOnTop(saved.alwaysOnTop);
    if (started) {
      const oldCartoon = activePlaylist(previous, 'CARTOON');
      const oldLofi = activePlaylist(previous, 'LOFI');
      const newCartoon = activePlaylist(saved, 'CARTOON');
      const newLofi = activePlaylist(saved, 'LOFI');
      if (newCartoon && newCartoon.id !== oldCartoon?.id) {
        cartoonRef.current?.loadQueue(await window.retrotoon.resolvePlaylistVideos(newCartoon.youtubePlaylistId));
      }
      if (newLofi && newLofi.id !== oldLofi?.id) {
        lofiRef.current?.loadQueue(await window.retrotoon.resolvePlaylistVideos(newLofi.youtubePlaylistId), 1);
        lofiRef.current?.shuffle();
      }
      await applyAudio({ values: saved, mode: saved.audioMode });
    }
  };

  if (!settings) return <main className="loading-screen">{copyFor().loading}</main>;
  const copy = copyFor(settings.locale);
  const configured = Boolean(activePlaylist(settings, 'CARTOON') && activePlaylist(settings, 'LOFI'));

  return (
    <main className={`app-shell ${settings.crtEffectsEnabled ? 'crt-on' : ''}`} onContextMenu={(event) => { event.preventDefault(); window.retrotoon.showContextMenu(); }}>
      <div className="device" aria-label="RetroToon floating player">
        <div className="top-ridge drag-region"><span>RETROTOON // RT–01</span><div className="vent"><i /><i /><i /><i /><i /></div><button className="minimize-tab no-drag" type="button" onClick={() => void window.retrotoon.minimizeWindow()} aria-label={copy.minimize}>—</button><button className="settings-tab no-drag" type="button" onClick={() => setSettingsOpen(true)} aria-label={copy.openSettings}>設定</button></div>
        <section className="screen-chassis">
          <div className="screen-bezel">
            <div className="screen" onPointerEnter={enterScreen} onPointerLeave={leaveScreen}>
              <div className={`video-layer cartoon-layer ${videoView === 'CARTOON' ? 'is-visible' : ''}`}><div id="cartoon-player" className="player-host" /></div>
              <div className={`video-layer lofi-layer ${videoView === 'LOFI' ? 'is-visible' : ''}`}><div id="lofi-player" className="player-host" /></div>
              {!booted && <div className="boot-sequence" aria-label="RetroToon is starting"><div className="boot-mark">RT</div><div className="boot-line" /></div>}
              {booted && !started && configured && <div className="start-gate"><div className="signal-orbit"><span>RT</span></div><p>CARTOON + LO-FI RECEIVER</p><button type="button" disabled={starting || !playersReady} onClick={() => void start()}>{starting || !playersReady ? copy.tuning : copy.pressToStart}</button><small>{copy.startRequired}</small></div>}
              {started && <div className="screen-hud"><span>{status}</span><span>{hovered && settings.audioMode === 'AUTO_HOVER' ? copy.hoverActive : MODE_LABELS[settings.audioMode]}</span></div>}
              {error && configured && <div className="screen-error" role="alert"><span>!</span><p>{error}</p>{started && <button onClick={() => { setError(''); void applyAudio(); }}>{copy.retry}</button>}</div>}
              <div className="scanlines" aria-hidden="true" />
            </div>
          </div>
          <div className="screen-label"><span>映像受信機</span><span>16:9 · STEREO</span></div>
        </section>
        <aside className="control-deck">
          <button className="view-toggle" type="button" aria-label={copy.showVideo(videoView === 'CARTOON' ? copy.music : copy.cartoon)} aria-pressed={videoView === 'LOFI'} onClick={() => setVideoView((current) => current === 'CARTOON' ? 'LOFI' : 'CARTOON')}>
            <span>{videoView === 'CARTOON' ? 'TV' : 'MV'}</span><i /><small>{copy.view}</small>
          </button>
          <div className="mode-cluster">
            <button className="mode-dial" type="button" aria-label={`${copy.changeAudioMode}. ${MODE_LABELS[settings.audioMode]}`} onClick={() => void changeMode()}><span>音声</span><i /></button>
            <div className="mode-caption"><span className={`status-led ${muted ? 'off' : ''}`} /><strong>{MODE_LABELS[settings.audioMode]}</strong></div>
          </div>
          <div className="rocker" aria-label="Cartoon transport controls">
            <button type="button" aria-label={copy.rewind} onClick={() => clicker.press('back')} onPointerUp={() => clicker.release('back')}><span>«</span><small>戻る</small></button>
            <div />
            <button type="button" aria-label={copy.forward} onClick={() => clicker.press('forward')} onPointerUp={() => clicker.release('forward')}><span>»</span><small>進む</small></button>
          </div>
          <button className={`mute-button ${muted ? 'is-muted' : ''}`} type="button" aria-pressed={muted} onClick={() => void toggleMute()}><span>{muted ? '×' : '♪'}</span><small>消音</small></button>
          <div className="lofi-screen-shell">
            <div className="lofi-screen-header"><span>LO-FI MONITOR</span><i className={muted ? 'off' : ''} /></div>
            <div className="lofi-viewport">
              <div className="track-readout"><strong>{nowPlaying.title || copy.acquiringSignal}</strong><span>{nowPlaying.author || 'LO-FI RECEIVER'}</span></div>
              <div className="pixel-wave" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ animationDelay: `${index * -73}ms` }} />)}</div>
              <div className="mini-scanlines" aria-hidden="true" />
            </div>
          </div>
        </aside>
        {!configured && <OnboardingPanel settings={settings} onComplete={async (next) => { await persist(next); }} onLocale={async (locale) => { await persist({ ...settings, locale }); }} />}
        {settingsOpen && configured && <SettingsPanel initial={settings} onClose={() => setSettingsOpen(false)} onSave={saveSettings} />}
      </div>
    </main>
  );
}
