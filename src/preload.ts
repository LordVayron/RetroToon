import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings, RetroToonAPI, WindowPreset } from './shared/types';

const api: RetroToonAPI = {
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings),
  setWindowPreset: (preset: WindowPreset) => ipcRenderer.invoke('window:preset', preset),
  setAlwaysOnTop: (value: boolean) => ipcRenderer.invoke('window:alwaysOnTop', value),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  resolvePlaylistVideos: (playlistId: string) => ipcRenderer.invoke('youtube:playlistVideos', playlistId),
  toggleFullscreen: () => ipcRenderer.invoke('window:fullscreen'),
  importSettings: () => ipcRenderer.invoke('settings:import'),
  applyImport: (settings, mode) => ipcRenderer.invoke('settings:applyImport', settings, mode),
  exportSettings: (settings) => ipcRenderer.invoke('settings:export', settings),
  showContextMenu: () => ipcRenderer.send('app:contextMenu'),
  onOpenSettings: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('app:openSettings', listener);
    return () => ipcRenderer.removeListener('app:openSettings', listener);
  }
};

contextBridge.exposeInMainWorld('retrotoon', api);
