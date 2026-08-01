import type { RetroToonAPI } from '../shared/types';

declare global {
  interface Window {
    retrotoon: RetroToonAPI;
    YT: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }

  namespace YT {
    class Player {
      constructor(element: string | HTMLElement, options: PlayerOptions);
      loadPlaylist(options: { listType: 'playlist'; list: string; index?: number; startSeconds?: number }): void;
      loadVideoById(videoId: string, startSeconds?: number): void;
      playVideo(): void;
      pauseVideo(): void;
      mute(): void;
      unMute(): void;
      isMuted(): boolean;
      setVolume(volume: number): void;
      getVolume(): number;
      seekTo(seconds: number, allowSeekAhead: boolean): void;
      nextVideo(): void;
      previousVideo(): void;
      playVideoAt(index: number): void;
      setLoop(loop: boolean): void;
      setShuffle(shuffle: boolean): void;
      getPlaylist(): string[] | null;
      getPlaylistIndex(): number;
      getCurrentTime(): number;
      getDuration(): number;
      getVideoUrl(): string;
      getVideoData(): { title?: string; author?: string; video_id?: string };
      getPlayerState(): number;
      destroy(): void;
    }
    interface PlayerOptions {
      videoId?: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: PlayerEvent) => void;
        onStateChange?: (event: OnStateChangeEvent) => void;
        onError?: (event: OnErrorEvent) => void;
        onAutoplayBlocked?: () => void;
      };
    }
    interface PlayerEvent { target: Player }
    interface OnStateChangeEvent extends PlayerEvent { data: number }
    interface OnErrorEvent extends PlayerEvent { data: number }
  }
}

export {};
