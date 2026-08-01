import type { AppLocale } from '../shared/types';

export interface AppCopy {
  loading: string;
  settings: string;
  closeSettings: string;
  discardChanges: string;
  cartoonPlaylists: string;
  lofiPlaylists: string;
  sequential: string;
  shuffle: string;
  add: string;
  checking: string;
  playlistPlaceholder: string;
  invalidPlaylist: string;
  duplicatePlaylist: string;
  unavailablePlaylist: string;
  noPlaylists: string;
  cartoonPlaylistName: string;
  lofiPlaylistName: string;
  setActive: string;
  moveUp: string;
  moveDown: string;
  removePlaylist: string;
  removeConfirm: (name: string) => string;
  toonVolume: string;
  lofiVolume: string;
  windowSize: string;
  alwaysOnTop: string;
  crtEffects: string;
  fullscreen: string;
  language: string;
  english: string;
  spanish: string;
  unavailableItems: string;
  clearLog: string;
  importJson: string;
  exportJson: string;
  unsavedChanges: string;
  allSaved: string;
  saveSettings: string;
  saving: string;
  importFailed: (message: string) => string;
  importQuestion: (cartoons: number, lofi: number) => string;
  mergeQuestion: string;
  onboardingEyebrow: string;
  onboardingTitle: string;
  onboardingBody: string;
  cartoonUrl: string;
  musicUrl: string;
  onboardingPrivacy: string;
  connectPlaylists: string;
  connecting: string;
  connected: string;
  startRequired: string;
  pressToStart: string;
  tuning: string;
  addBothPlaylists: string;
  playbackBlocked: string;
  playersFailed: string;
  playlistDidNotStart: (source: string, state: number) => string;
  cartoon: string;
  music: string;
  muted: string;
  toonAudio: string;
  lofiAudio: string;
  hoverActive: string;
  retry: string;
  minimize: string;
  openSettings: string;
  changeAudioMode: string;
  showVideo: (source: string) => string;
  rewind: string;
  forward: string;
  view: string;
  unknownTransmitter: string;
  acquiringSignal: string;
}

const en: AppCopy = {
  loading: 'LOADING RETROTOON…', settings: 'SETTINGS', closeSettings: 'Close settings', discardChanges: 'Discard unsaved settings?',
  cartoonPlaylists: 'CARTOON PLAYLISTS', lofiPlaylists: 'LO-FI PLAYLISTS', sequential: 'SEQUENTIAL', shuffle: 'SHUFFLE', add: 'ADD', checking: 'CHECKING…',
  playlistPlaceholder: 'https://youtube.com/playlist?list=…', invalidPlaylist: 'Paste a valid YouTube playlist URL.', duplicatePlaylist: 'That playlist is already saved in this collection.', unavailablePlaylist: 'The playlist is empty, private, unavailable, or could not be reached.', noPlaylists: 'No playlists saved yet.',
  cartoonPlaylistName: 'My cartoons', lofiPlaylistName: 'My music', setActive: 'Set active playlist', moveUp: 'Move playlist up', moveDown: 'Move playlist down', removePlaylist: 'Remove playlist', removeConfirm: (name) => `Remove “${name}”?`,
  toonVolume: 'TOON VOLUME', lofiVolume: 'LO-FI VOLUME', windowSize: 'WINDOW SIZE', alwaysOnTop: 'ALWAYS ON TOP', crtEffects: 'CRT EFFECTS', fullscreen: 'TOGGLE FULLSCREEN', language: 'LANGUAGE', english: 'English', spanish: 'Español',
  unavailableItems: 'UNAVAILABLE ITEMS', clearLog: 'CLEAR LOG', importJson: 'IMPORT JSON', exportJson: 'EXPORT JSON', unsavedChanges: '● UNSAVED CHANGES', allSaved: 'ALL CHANGES SAVED', saveSettings: 'SAVE SETTINGS', saving: 'SAVING…',
  importFailed: (message) => `Import failed: ${message}`, importQuestion: (cartoons, lofi) => `Import ${cartoons} cartoon and ${lofi} lo-fi playlists?\n\nOK replaces existing settings. Cancel offers merge.`, mergeQuestion: 'Merge imported playlists with existing settings?',
  onboardingEyebrow: 'FIRST SIGNAL / SETUP', onboardingTitle: 'TUNE YOUR RECEIVER', onboardingBody: 'Connect one cartoon playlist and one music playlist. Public and unlisted YouTube playlists are supported.', cartoonUrl: 'CARTOON PLAYLIST URL', musicUrl: 'MUSIC PLAYLIST URL', onboardingPrivacy: 'Links and preferences stay on this device. No account, telemetry, or API key.', connectPlaylists: 'CONNECT PLAYLISTS', connecting: 'CHECKING SIGNALS…', connected: 'CONNECTED',
  startRequired: 'AUDIO REQUIRES ONE MANUAL START', pressToStart: 'PRESS ● TO START', tuning: 'TUNING…', addBothPlaylists: 'Add and activate one cartoon and one lo-fi playlist to begin.', playbackBlocked: 'Playback was blocked. Press start again.', playersFailed: 'The players could not start.', playlistDidNotStart: (source, state) => `${source} playlist did not begin playing (player state ${state}). Check that it is public and allows embedding.`,
  cartoon: 'cartoon', music: 'music video', muted: 'MUTED', toonAudio: 'TOON AUDIO', lofiAudio: 'LO-FI AUDIO', hoverActive: 'HOVER ACTIVE', retry: 'RETRY', minimize: 'Minimize RetroToon', openSettings: 'Open settings', changeAudioMode: 'Change audio mode', showVideo: (source) => `Show ${source} on the main screen`, rewind: 'Rewind 30 seconds; triple click previous video', forward: 'Forward 30 seconds; triple click next video', view: 'VIEW', unknownTransmitter: 'UNKNOWN TRANSMITTER', acquiringSignal: 'SIGNAL ACQUIRING…'
};

const es: AppCopy = {
  loading: 'CARGANDO RETROTOON…', settings: 'AJUSTES', closeSettings: 'Cerrar ajustes', discardChanges: '¿Descartar los cambios sin guardar?',
  cartoonPlaylists: 'PLAYLISTS DE CARICATURAS', lofiPlaylists: 'PLAYLISTS DE MÚSICA', sequential: 'SECUENCIAL', shuffle: 'ALEATORIO', add: 'AÑADIR', checking: 'COMPROBANDO…',
  playlistPlaceholder: 'https://youtube.com/playlist?list=…', invalidPlaylist: 'Pega un enlace válido de una playlist de YouTube.', duplicatePlaylist: 'Esa playlist ya está guardada en esta colección.', unavailablePlaylist: 'La playlist está vacía, es privada, no está disponible o no se pudo abrir.', noPlaylists: 'Todavía no hay playlists guardadas.',
  cartoonPlaylistName: 'Mis caricaturas', lofiPlaylistName: 'Mi música', setActive: 'Seleccionar playlist activa', moveUp: 'Mover playlist hacia arriba', moveDown: 'Mover playlist hacia abajo', removePlaylist: 'Eliminar playlist', removeConfirm: (name) => `¿Eliminar “${name}”?`,
  toonVolume: 'VOLUMEN DE CARICATURAS', lofiVolume: 'VOLUMEN DE MÚSICA', windowSize: 'TAMAÑO DE VENTANA', alwaysOnTop: 'SIEMPRE VISIBLE', crtEffects: 'EFECTOS CRT', fullscreen: 'PANTALLA COMPLETA', language: 'IDIOMA', english: 'English', spanish: 'Español',
  unavailableItems: 'ELEMENTOS NO DISPONIBLES', clearLog: 'LIMPIAR REGISTRO', importJson: 'IMPORTAR JSON', exportJson: 'EXPORTAR JSON', unsavedChanges: '● CAMBIOS SIN GUARDAR', allSaved: 'CAMBIOS GUARDADOS', saveSettings: 'GUARDAR AJUSTES', saving: 'GUARDANDO…',
  importFailed: (message) => `Error al importar: ${message}`, importQuestion: (cartoons, lofi) => `¿Importar ${cartoons} playlists de caricaturas y ${lofi} de música?\n\nAceptar reemplaza los ajustes. Cancelar permite combinarlos.`, mergeQuestion: '¿Combinar las playlists importadas con las existentes?',
  onboardingEyebrow: 'PRIMERA SEÑAL / CONFIGURACIÓN', onboardingTitle: 'SINTONIZA TU RECEPTOR', onboardingBody: 'Conecta una playlist de caricaturas y otra de música. Se admiten playlists públicas y no listadas de YouTube.', cartoonUrl: 'ENLACE DE PLAYLIST DE CARICATURAS', musicUrl: 'ENLACE DE PLAYLIST DE MÚSICA', onboardingPrivacy: 'Los enlaces y preferencias permanecen en este dispositivo. Sin cuenta, telemetría ni API key.', connectPlaylists: 'CONECTAR PLAYLISTS', connecting: 'COMPROBANDO SEÑALES…', connected: 'CONECTADA',
  startRequired: 'EL AUDIO REQUIERE UN INICIO MANUAL', pressToStart: 'PRESIONA ● PARA INICIAR', tuning: 'SINTONIZANDO…', addBothPlaylists: 'Añade y activa una playlist de caricaturas y otra de música para comenzar.', playbackBlocked: 'La reproducción fue bloqueada. Presiona iniciar nuevamente.', playersFailed: 'No se pudieron iniciar los reproductores.', playlistDidNotStart: (source, state) => `La playlist de ${source} no comenzó (estado ${state}). Comprueba que sea pública y permita reproducción insertada.`,
  cartoon: 'caricaturas', music: 'video musical', muted: 'SILENCIO', toonAudio: 'AUDIO CARTOON', lofiAudio: 'AUDIO LO-FI', hoverActive: 'HOVER ACTIVO', retry: 'REINTENTAR', minimize: 'Minimizar RetroToon', openSettings: 'Abrir ajustes', changeAudioMode: 'Cambiar modo de audio', showVideo: (source) => `Mostrar ${source} en la pantalla principal`, rewind: 'Retroceder 30 segundos; triple clic para video anterior', forward: 'Avanzar 30 segundos; triple clic para video siguiente', view: 'VISTA', unknownTransmitter: 'TRANSMISOR DESCONOCIDO', acquiringSignal: 'BUSCANDO SEÑAL…'
};

export const copyFor = (locale?: AppLocale): AppCopy => locale === 'es' ? es : en;
