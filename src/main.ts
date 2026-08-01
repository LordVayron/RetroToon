import { app, BrowserWindow, dialog, ipcMain, Menu, screen, session } from 'electron';
import { promises as fs } from 'node:fs';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultSettings, ensureLocale, parseSettings } from './shared/schema';
import type { AppLocale, AppSettings, PlaylistRecord, WindowPreset } from './shared/types';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

const APP_ID = 'com.retrotoon.app';
const WINDOW_SIZES: Record<WindowPreset, [number, number]> = {
  SMALL: [420, 336],
  MEDIUM: [600, 480],
  LARGE: [840, 672]
};

let mainWindow: BrowserWindow | null = null;
const playlistStarts: Record<string, string | null> = {};
let rendererServer: Server | null = null;
let rendererUrl = MAIN_WINDOW_WEBPACK_ENTRY;

const smokeUserData = process.env.RETROTOON_SMOKE_USER_DATA;
if (smokeUserData && path.isAbsolute(smokeUserData)) app.setPath('userData', smokeUserData);
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

async function writeSettings(value: AppSettings): Promise<AppSettings> {
  const validated = ensureLocale(parseSettings({ ...value, updatedAt: new Date().toISOString() }), detectedLocale());
  const target = settingsPath();
  const temp = `${target}.tmp`;
  const backup = `${target}.bak`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  try {
    await fs.copyFile(target, backup);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await fs.writeFile(temp, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');
  await fs.rename(temp, target);
  return validated;
}

async function loadSettings(): Promise<AppSettings> {
  const target = settingsPath();
  try {
    const parsed = parseSettings(JSON.parse(await fs.readFile(target, 'utf8')));
    const migrated = ensureLocale(parsed, detectedLocale());
    return parsed.locale ? migrated : writeSettings(migrated);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return createDefaultSettings(detectedLocale());
    try {
      await fs.copyFile(target, `${target}.corrupt-${Date.now()}`);
      return ensureLocale(parseSettings(JSON.parse(await fs.readFile(`${target}.bak`, 'utf8'))), detectedLocale());
    } catch {
      return createDefaultSettings(detectedLocale());
    }
  }
}

function detectedLocale(): AppLocale {
  return app.getLocale().toLowerCase().startsWith('es') ? 'es' : 'en';
}

async function prepareRendererOrigin(): Promise<void> {
  if (!MAIN_WINDOW_WEBPACK_ENTRY.startsWith('file:')) return;
  const root = path.dirname(path.dirname(fileURLToPath(MAIN_WINDOW_WEBPACK_ENTRY)));
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.woff2': 'font/woff2',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
  };
  rendererServer = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const target = path.resolve(root, relative);
      if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end();
        return;
      }
      response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(target)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(await fs.readFile(target));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    rendererServer?.once('error', reject);
    rendererServer?.listen(0, '127.0.0.1', () => resolve());
  });
  const address = rendererServer.address();
  if (!address || typeof address === 'string') throw new Error('Unable to start the local renderer.');
  rendererUrl = `http://localhost:${address.port}/main_window/index.html`;
}

function mergeSettings(current: AppSettings, incoming: AppSettings): AppSettings {
  const keys = new Set(current.playlists.map((item) => `${item.sourceType}:${item.youtubePlaylistId}`));
  const appended = incoming.playlists.filter((item) => !keys.has(`${item.sourceType}:${item.youtubePlaylistId}`));
  const playlists = [...current.playlists, ...appended].map((item, index) => ({ ...item, sortOrder: index }));
  const incomingActive = (type: 'CARTOON' | 'LOFI', id?: string) =>
    id && playlists.some((item) => item.id === id && item.sourceType === type) ? id : undefined;
  return {
    ...current,
    audioMode: incoming.audioMode,
    cartoonVolume: incoming.cartoonVolume,
    lofiVolume: incoming.lofiVolume,
    crtEffectsEnabled: incoming.crtEffectsEnabled,
    alwaysOnTop: incoming.alwaysOnTop,
    windowPreset: incoming.windowPreset,
    playlists,
    activeCartoonPlaylistId: incomingActive('CARTOON', incoming.activeCartoonPlaylistId) ?? current.activeCartoonPlaylistId,
    activeLofiPlaylistId: incomingActive('LOFI', incoming.activeLofiPlaylistId) ?? current.activeLofiPlaylistId,
    updatedAt: new Date().toISOString()
  };
}

function safePosition(settings: AppSettings, width: number, height: number): { x?: number; y?: number } {
  if (!settings.windowPosition) return {};
  const point = settings.windowPosition;
  const display = screen.getDisplayNearestPoint(point);
  const bounds = display.workArea;
  const x = Math.min(Math.max(point.x, bounds.x), bounds.x + bounds.width - width);
  const y = Math.min(Math.max(point.y, bounds.y), bounds.y + bounds.height - height);
  return { x, y };
}

async function createWindow(): Promise<void> {
  const settings = await loadSettings();
  const [presetWidth, presetHeight] = WINDOW_SIZES[settings.windowPreset];
  const width = settings.windowSize?.width ?? presetWidth;
  const height = settings.windowSize?.height ?? presetHeight;
  mainWindow = new BrowserWindow({
    width,
    height,
    ...safePosition(settings, width, height),
    minWidth: 360,
    minHeight: 288,
    frame: false,
    transparent: true,
    resizable: true,
    fullscreenable: true,
    alwaysOnTop: settings.alwaysOnTop,
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  mainWindow.setAspectRatio(1.25);

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== rendererUrl) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('move', () => {
    if (!mainWindow || mainWindow.isFullScreen()) return;
    const [x, y] = mainWindow.getPosition();
    void loadSettings().then((current) => writeSettings({ ...current, windowPosition: { x, y } }));
  });
  let resizeTimer: NodeJS.Timeout | undefined;
  mainWindow.on('resize', () => {
    if (!mainWindow || mainWindow.isFullScreen()) return;
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!mainWindow) return;
      const [nextWidth, nextHeight] = mainWindow.getSize();
      void loadSettings().then((current) => writeSettings({ ...current, windowSize: { width: nextWidth, height: nextHeight } }));
    }, 300);
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  await mainWindow.loadURL(rendererUrl);
}

async function runSmokeTest(): Promise<void> {
  const resultPath = process.env.RETROTOON_SMOKE_RESULT;
  if (!resultPath || !path.isAbsolute(resultPath) || !mainWindow) return;
  const startedAt = Date.now();
  let observation: { ready: boolean; error: string; button: string; minimizeButton: boolean; cartoonSrc: string; lofiSrc: string; toggleButton: boolean; lofiVisible: boolean; nowPlaying: string; resizable: boolean; size: number[] } = {
    ready: false,
    error: '',
    button: '',
    minimizeButton: false,
    cartoonSrc: '',
    lofiSrc: '',
    toggleButton: false,
    lofiVisible: false,
    nowPlaying: '',
    resizable: false,
    size: []
  };
  try {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const onboardingVisible = await mainWindow.webContents.executeJavaScript("Boolean(document.querySelector('.onboarding-panel'))", true);
    if (onboardingVisible) {
      const cartoonUrl = process.env.RETROTOON_SMOKE_CARTOON_URL;
      const musicUrl = process.env.RETROTOON_SMOKE_MUSIC_URL;
      if (!cartoonUrl || !musicUrl) throw new Error('Clean-profile smoke test requires playlist URL environment variables.');
      await mainWindow.webContents.executeJavaScript(`(() => {
        const values = ${JSON.stringify([cartoonUrl, musicUrl])};
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        document.querySelectorAll('.onboarding-field input').forEach((input, index) => {
          setter.call(input, values[index]);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        document.querySelector('.onboarding-panel footer button')?.click();
      })()`, true);
    }
    let startPoint: { x: number; y: number } | null = null;
    while (!startPoint && Date.now() - startedAt < 20000) {
      startPoint = await mainWindow.webContents.executeJavaScript(`(() => {
        const button = document.querySelector('.start-gate button');
        const rect = button?.getBoundingClientRect();
        return rect && !button.disabled ? { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) } : null;
      })()`, true);
      if (!startPoint) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!startPoint) throw new Error('Start button was not found.');
    mainWindow.webContents.sendInputEvent({ type: 'mouseDown', ...startPoint, button: 'left', clickCount: 1 });
    mainWindow.webContents.sendInputEvent({ type: 'mouseUp', ...startPoint, button: 'left', clickCount: 1 });
    while (Date.now() - startedAt < 45000) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      observation = await mainWindow.webContents.executeJavaScript(`(() => ({
        ready: Boolean(document.querySelector('.screen-hud')),
        error: document.querySelector('.screen-error p')?.textContent ?? '',
        button: document.querySelector('.start-gate button')?.textContent ?? '',
        minimizeButton: Boolean(document.querySelector('.minimize-tab')),
        cartoonSrc: document.querySelector('#cartoon-player')?.src ?? '',
        lofiSrc: document.querySelector('#lofi-player')?.src ?? '',
        toggleButton: Boolean(document.querySelector('.view-toggle')),
        lofiVisible: document.querySelector('.lofi-layer')?.classList.contains('is-visible') ?? false,
        nowPlaying: document.querySelector('.track-readout strong')?.textContent ?? '',
        resizable: false,
        size: []
      }))()`, true);
      if (observation.ready || (observation.error && !observation.button.includes('TUNING'))) break;
    }
    if (observation.ready) {
      mainWindow.setSize(720, 576);
      const togglePoint = await mainWindow.webContents.executeJavaScript(`(() => {
        const rect = document.querySelector('.view-toggle')?.getBoundingClientRect();
        return rect ? { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) } : null;
      })()`, true);
      if (togglePoint) {
        mainWindow.webContents.sendInputEvent({ type: 'mouseDown', ...togglePoint, button: 'left', clickCount: 1 });
        mainWindow.webContents.sendInputEvent({ type: 'mouseUp', ...togglePoint, button: 'left', clickCount: 1 });
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
      observation = {
        ...observation,
        ...(await mainWindow.webContents.executeJavaScript(`(() => ({
          toggleButton: Boolean(document.querySelector('.view-toggle')),
          lofiVisible: document.querySelector('.lofi-layer')?.classList.contains('is-visible') ?? false,
          nowPlaying: document.querySelector('.track-readout strong')?.textContent ?? ''
        }))()`, true)),
        resizable: mainWindow.isResizable(),
        size: mainWindow.getSize()
      };
    }
    const success = observation.ready && observation.minimizeButton && observation.toggleButton && observation.lofiVisible && observation.nowPlaying.length > 0 && observation.resizable && observation.size[0] === 720 && observation.size[1] === 576;
    const screenshotPath = process.env.RETROTOON_SMOKE_SCREENSHOT;
    if (screenshotPath && path.isAbsolute(screenshotPath)) {
      await fs.writeFile(screenshotPath, (await mainWindow.webContents.capturePage()).toPNG());
    }
    await fs.writeFile(resultPath, `${JSON.stringify({ success, elapsedMs: Date.now() - startedAt, ...observation, playlistStarts }, null, 2)}\n`, 'utf8');
    app.exit(success ? 0 : 1);
  } catch (error) {
    await fs.writeFile(resultPath, `${JSON.stringify({ success: false, elapsedMs: Date.now() - startedAt, ...observation, harnessError: error instanceof Error ? error.message : String(error) }, null, 2)}\n`, 'utf8');
    app.exit(1);
  }
}

function validSender(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent): boolean {
  return Boolean(mainWindow && event.sender.id === mainWindow.webContents.id);
}

function registerIPC(): void {
  ipcMain.handle('settings:load', (event) => {
    if (!validSender(event)) throw new Error('Invalid IPC sender');
    return loadSettings();
  });
  ipcMain.handle('settings:save', async (event, value: unknown) => {
    if (!validSender(event)) throw new Error('Invalid IPC sender');
    return writeSettings(parseSettings(value));
  });
  ipcMain.handle('window:preset', async (event, preset: WindowPreset) => {
    if (!validSender(event) || !(preset in WINDOW_SIZES)) throw new Error('Invalid window preset');
    mainWindow?.setSize(...WINDOW_SIZES[preset], true);
  });
  ipcMain.handle('window:alwaysOnTop', (event, enabled: boolean) => {
    if (!validSender(event) || typeof enabled !== 'boolean') throw new Error('Invalid always-on-top value');
    mainWindow?.setAlwaysOnTop(enabled, 'floating');
  });
  ipcMain.handle('window:minimize', (event) => {
    if (!validSender(event)) throw new Error('Invalid IPC sender');
    mainWindow?.minimize();
  });
  ipcMain.handle('youtube:playlistVideos', async (event, playlistId: string) => {
    if (!validSender(event) || typeof playlistId !== 'string' || !/^[A-Za-z0-9_-]{10,128}$/.test(playlistId)) throw new Error('Invalid playlist request');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await session.defaultSession.fetch(`https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) return [];
    const html = await response.text();
    const playlistVideo = new RegExp(`"watchEndpoint":\\{"videoId":"([A-Za-z0-9_-]{11})","playlistId":"${playlistId}"`, 'g');
    const candidates = [...html.matchAll(playlistVideo)].map((match) => match[1]);
    const videos = [...new Set(candidates)];
    playlistStarts[playlistId] = videos[0] ?? null;
    return videos;
  });
  ipcMain.handle('window:fullscreen', (event) => {
    if (!validSender(event)) throw new Error('Invalid IPC sender');
    const next = !mainWindow?.isFullScreen();
    mainWindow?.setFullScreen(next);
    return next;
  });
  ipcMain.handle('settings:import', async (event) => {
    if (!validSender(event) || !mainWindow) throw new Error('Invalid IPC sender');
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'RetroToon settings', extensions: ['json'] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    const settings = ensureLocale(parseSettings(JSON.parse(await fs.readFile(result.filePaths[0], 'utf8'))), detectedLocale());
    return {
      settings,
      cartoonPlaylists: settings.playlists.filter((item) => item.sourceType === 'CARTOON').length,
      lofiPlaylists: settings.playlists.filter((item) => item.sourceType === 'LOFI').length
    };
  });
  ipcMain.handle('settings:applyImport', async (event, value: unknown, mode: 'replace' | 'merge') => {
    if (!validSender(event) || !['replace', 'merge'].includes(mode)) throw new Error('Invalid import');
    const incoming = ensureLocale(parseSettings(value), detectedLocale());
    return writeSettings(mode === 'replace' ? incoming : mergeSettings(await loadSettings(), incoming));
  });
  ipcMain.handle('settings:export', async (event, value: unknown) => {
    if (!validSender(event) || !mainWindow) throw new Error('Invalid IPC sender');
    const settings = parseSettings(value);
    const result = await dialog.showSaveDialog(mainWindow, { defaultPath: 'retrotoon-settings.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return false;
    await fs.writeFile(result.filePath, `${JSON.stringify({ ...settings, unavailableItems: [] }, null, 2)}\n`, 'utf8');
    return true;
  });
  ipcMain.on('app:contextMenu', (event) => {
    if (!validSender(event)) return;
    void loadSettings().then((settings) => {
      const spanish = settings.locale === 'es';
      Menu.buildFromTemplate([
        { label: spanish ? 'Ajustes' : 'Settings', click: () => mainWindow?.webContents.send('app:openSettings') },
        { label: mainWindow?.isAlwaysOnTop() ? (spanish ? 'Desactivar siempre visible' : 'Disable Always on Top') : (spanish ? 'Activar siempre visible' : 'Enable Always on Top'), click: () => mainWindow?.setAlwaysOnTop(!mainWindow.isAlwaysOnTop(), 'floating') },
        { label: mainWindow?.isFullScreen() ? (spanish ? 'Salir de pantalla completa' : 'Exit Fullscreen') : (spanish ? 'Entrar en pantalla completa' : 'Enter Fullscreen'), click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()) },
        { type: 'separator' },
        { role: 'quit', label: spanish ? 'Salir' : 'Quit' }
      ]).popup({ window: mainWindow ?? undefined });
    });
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.setAppUserModelId(APP_ID);
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(async () => {
    await prepareRendererOrigin();
    session.defaultSession.webRequest.onBeforeSendHeaders(
      { urls: ['https://www.youtube.com/*', 'https://*.youtube.com/*'] },
      (details, callback) => callback({ requestHeaders: { ...details.requestHeaders, Referer: rendererUrl } })
    );
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    registerIPC();
    await createWindow();
    await runSmokeTest();
  });
  app.on('activate', () => { if (!mainWindow) void createWindow(); });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => rendererServer?.close());
}
