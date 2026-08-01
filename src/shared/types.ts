export type AudioMode = 'AUTO_HOVER' | 'LOFI_LOCKED' | 'CARTOON_LOCKED';
export type SourceType = 'CARTOON' | 'LOFI';
export type WindowPreset = 'SMALL' | 'MEDIUM' | 'LARGE';
export type AppLocale = 'en' | 'es';

export interface PlaylistRecord {
  id: string;
  sourceType: SourceType;
  youtubePlaylistId: string;
  originalUrl: string;
  displayName: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlaybackSnapshot {
  sourceType: SourceType;
  playlistRecordId: string;
  youtubeVideoId: string;
  playlistIndex: number;
  currentTimeSeconds: number;
  savedAt: string;
}

export interface UnavailableItem {
  id: string;
  playlistRecordId: string;
  youtubeVideoId: string;
  errorCategory: string;
  errorCode: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  occurrenceCount: number;
}

export interface AppSettings {
  schemaVersion: 1;
  audioMode: AudioMode;
  cartoonVolume: number;
  lofiVolume: number;
  crtEffectsEnabled: boolean;
  alwaysOnTop: boolean;
  windowPreset: WindowPreset;
  windowPosition?: { x: number; y: number };
  windowSize?: { width: number; height: number };
  locale?: AppLocale;
  activeCartoonPlaylistId?: string;
  activeLofiPlaylistId?: string;
  playlists: PlaylistRecord[];
  playbackSnapshots: PlaybackSnapshot[];
  unavailableItems: UnavailableItem[];
  updatedAt: string;
}

export interface ImportPreview {
  settings: AppSettings;
  cartoonPlaylists: number;
  lofiPlaylists: number;
}

export interface RetroToonAPI {
  loadSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<AppSettings>;
  setWindowPreset(preset: WindowPreset): Promise<void>;
  setAlwaysOnTop(value: boolean): Promise<void>;
  minimizeWindow(): Promise<void>;
  resolvePlaylistVideos(playlistId: string): Promise<string[]>;
  toggleFullscreen(): Promise<boolean>;
  importSettings(): Promise<ImportPreview | null>;
  applyImport(settings: AppSettings, mode: 'replace' | 'merge'): Promise<AppSettings>;
  exportSettings(settings: AppSettings): Promise<boolean>;
  showContextMenu(): void;
  onOpenSettings(callback: () => void): () => void;
}
