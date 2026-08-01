import { z } from 'zod';
import type { AppLocale, AppSettings } from './types';

const playlistSchema = z.object({
  id: z.string().uuid(),
  sourceType: z.enum(['CARTOON', 'LOFI']),
  youtubePlaylistId: z.string().min(1).max(128),
  originalUrl: z.string().url().refine((url) => ['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be'].includes(new URL(url).hostname)),
  displayName: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

const snapshotSchema = z.object({
  sourceType: z.enum(['CARTOON', 'LOFI']),
  playlistRecordId: z.string().uuid(),
  youtubeVideoId: z.string(),
  playlistIndex: z.number().int().nonnegative(),
  currentTimeSeconds: z.number().nonnegative(),
  savedAt: z.string().datetime()
});

const unavailableSchema = z.object({
  id: z.string().uuid(),
  playlistRecordId: z.string().uuid(),
  youtubeVideoId: z.string(),
  errorCategory: z.string(),
  errorCode: z.number().int(),
  firstDetectedAt: z.string().datetime(),
  lastDetectedAt: z.string().datetime(),
  occurrenceCount: z.number().int().positive()
});

export const settingsSchema = z.object({
  schemaVersion: z.literal(1),
  audioMode: z.enum(['AUTO_HOVER', 'LOFI_LOCKED', 'CARTOON_LOCKED']),
  cartoonVolume: z.number().int().min(0).max(100),
  lofiVolume: z.number().int().min(0).max(100),
  crtEffectsEnabled: z.boolean(),
  alwaysOnTop: z.boolean(),
  windowPreset: z.enum(['SMALL', 'MEDIUM', 'LARGE']),
  windowPosition: z.object({ x: z.number(), y: z.number() }).optional(),
  windowSize: z.object({ width: z.number().int().min(360), height: z.number().int().min(288) }).optional(),
  locale: z.enum(['en', 'es']).optional(),
  activeCartoonPlaylistId: z.string().uuid().optional(),
  activeLofiPlaylistId: z.string().uuid().optional(),
  playlists: z.array(playlistSchema),
  playbackSnapshots: z.array(snapshotSchema),
  unavailableItems: z.array(unavailableSchema),
  updatedAt: z.string().datetime()
}).strict();

export const createDefaultSettings = (locale: AppLocale = 'en'): AppSettings => ({
  schemaVersion: 1,
  audioMode: 'AUTO_HOVER',
  cartoonVolume: 70,
  lofiVolume: 45,
  crtEffectsEnabled: true,
  alwaysOnTop: true,
  windowPreset: 'MEDIUM',
  playlists: [],
  playbackSnapshots: [],
  unavailableItems: [],
  locale,
  updatedAt: new Date().toISOString()
});

export function parseSettings(value: unknown): AppSettings {
  return settingsSchema.parse(value) as AppSettings;
}

export function ensureLocale(settings: AppSettings, locale: AppLocale): AppSettings {
  return settings.locale ? settings : { ...settings, locale };
}
