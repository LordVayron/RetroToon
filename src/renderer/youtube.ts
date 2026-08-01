import type { PlaybackSnapshot, SourceType } from '../shared/types';
import type { AppCopy } from './i18n';

let apiPromise: Promise<void> | null = null;

export function loadYouTubeAPI(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('YouTube API timed out.')), 15000);
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => reject(new Error('Unable to load the YouTube API.'));
    document.head.appendChild(script);
  });
  return apiPromise;
}

export interface PlayerCallbacks {
  onError(errorCode: number, videoId: string): void;
  onStateChange?(): void;
}

export class YouTubePlayerAdapter {
  private player?: YT.Player;
  private sourceType: SourceType;
  private fatalError?: number;
  private playlistRequested = false;
  private queue: string[] = [];
  private queueIndex = 0;

  constructor(private readonly elementId: string, sourceType: SourceType, private readonly callbacks: PlayerCallbacks, private readonly copy: AppCopy) {
    this.sourceType = sourceType;
  }

  async initialize(playlistId: string, snapshot?: PlaybackSnapshot, videoIds: string[] = []): Promise<void> {
    await loadYouTubeAPI();
    this.queue = [...videoIds];
    const defaultIndex = this.sourceType === 'LOFI' && this.queue.length > 1 ? 1 : 0;
    this.queueIndex = Math.max(0, Math.min(this.queue.length - 1, snapshot?.playlistIndex ?? defaultIndex));
    const initialVideoId = this.queue[this.queueIndex] ?? null;
    this.fatalError = undefined;
    this.playlistRequested = Boolean(initialVideoId);
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error(this.copy.playersFailed)), 15000);
      this.player = new window.YT.Player(this.elementId, {
        videoId: initialVideoId ?? undefined,
        width: this.sourceType === 'LOFI' ? '320' : '100%',
        height: this.sourceType === 'LOFI' ? '200' : '100%',
        playerVars: {
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          rel: 0,
          start: Math.floor(snapshot?.currentTimeSeconds ?? 0)
        },
        events: {
          onReady: () => {
            window.clearTimeout(timeout);
            if (!initialVideoId) {
              this.fatalError = undefined;
              this.playlistRequested = true;
              this.player?.loadPlaylist({ listType: 'playlist', list: playlistId, index: snapshot?.playlistIndex ?? 0, startSeconds: snapshot?.currentTimeSeconds ?? 0 });
            }
            this.player?.setLoop(true);
            resolve();
          },
          onStateChange: (event) => {
            if (event.data === 0) this.next();
            this.callbacks.onStateChange?.();
          },
          onError: (event) => {
            if (!this.playlistRequested) return;
            if ([2, 5, 153].includes(event.data)) this.fatalError = event.data;
            this.callbacks.onError(event.data, this.videoId());
          },
          onAutoplayBlocked: () => reject(new Error(this.copy.playbackBlocked))
        }
      });
    });
  }

  loadPlaylist(playlistId: string): void {
    this.fatalError = undefined;
    this.playlistRequested = true;
    this.player?.loadPlaylist({ listType: 'playlist', list: playlistId });
    this.player?.setLoop(true);
  }

  loadQueue(videoIds: string[], startIndex = 0): void {
    if (videoIds.length === 0) return;
    this.queue = [...videoIds];
    this.queueIndex = Math.max(0, Math.min(this.queue.length - 1, startIndex));
    this.fatalError = undefined;
    this.playlistRequested = true;
    this.player?.loadVideoById(this.queue[this.queueIndex]);
  }

  play(): void {
    if (!this.player) return;
    if (this.player.getPlayerState() === -1 && this.queue.length > 0) {
      this.player.loadVideoById(this.queue[this.queueIndex]);
      return;
    }
    this.player.playVideo();
  }
  pause(): void { this.player?.pauseVideo(); }
  mute(): void { this.player?.mute(); }
  unmute(): void { this.player?.unMute(); }
  setVolume(value: number): void { this.player?.setVolume(value); }
  next(): void {
    if (this.queue.length === 0) { this.player?.nextVideo(); return; }
    this.queueIndex = (this.queueIndex + 1) % this.queue.length;
    this.fatalError = undefined;
    this.player?.loadVideoById(this.queue[this.queueIndex]);
  }
  previous(): void {
    if (this.queue.length === 0) { this.player?.previousVideo(); return; }
    this.queueIndex = (this.queueIndex - 1 + this.queue.length) % this.queue.length;
    this.fatalError = undefined;
    this.player?.loadVideoById(this.queue[this.queueIndex]);
  }
  shuffle(): void {
    if (this.queue.length < 2) return;
    const current = this.queue[this.queueIndex];
    const rest = this.queue.filter((_, index) => index !== this.queueIndex);
    for (let index = rest.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [rest[index], rest[target]] = [rest[target], rest[index]];
    }
    this.queue = [current, ...rest];
    this.queueIndex = 0;
  }
  state(): number { return this.player?.getPlayerState() ?? -1; }
  metadata(): { title: string; author: string } {
    const data = this.player?.getVideoData();
    return { title: data?.title ?? '', author: data?.author ?? '' };
  }

  async waitUntilPlaying(timeoutMs = 12000): Promise<void> {
    const startedAt = Date.now();
    let lastRetry = 0;
    while (Date.now() - startedAt < timeoutMs) {
      if (this.fatalError) throw new Error(`${this.sourceType === 'CARTOON' ? 'Cartoon' : 'Lo-fi'} player failed with YouTube error ${this.fatalError}.`);
      if (this.state() === 1) return;
      if (Date.now() - lastRetry >= 1000) {
        this.play();
        lastRetry = Date.now();
      }
      await new Promise((resolve) => window.setTimeout(resolve, 200));
    }
    throw new Error(this.copy.playlistDidNotStart(this.sourceType === 'CARTOON' ? this.copy.cartoon : this.copy.music, this.state()));
  }

  seekBy(delta: number): void {
    if (!this.player) return;
    const target = Math.max(0, Math.min(this.player.getDuration() || Number.POSITIVE_INFINITY, this.player.getCurrentTime() + delta));
    this.player.seekTo(target, true);
  }

  snapshot(playlistRecordId: string): PlaybackSnapshot | null {
    if (!this.player) return null;
    return {
      sourceType: this.sourceType,
      playlistRecordId,
      youtubeVideoId: this.videoId(),
      playlistIndex: this.queue.length > 0 ? this.queueIndex : Math.max(0, this.player.getPlaylistIndex()),
      currentTimeSeconds: Math.max(0, this.player.getCurrentTime()),
      savedAt: new Date().toISOString()
    };
  }

  destroy(): void { this.player?.destroy(); }

  private videoId(): string {
    try { return new URL(this.player?.getVideoUrl() ?? '').searchParams.get('v') ?? ''; }
    catch { return ''; }
  }
}
