import type { AudioMode, SourceType } from '../shared/types';

export type ActiveSource = SourceType | 'NONE';
export type TransportAction = 'SEEK_BACK' | 'SEEK_FORWARD' | 'PREVIOUS' | 'NEXT';

export function extractPlaylistId(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)) return null;
    const id = url.searchParams.get('list');
    return id && /^[A-Za-z0-9_-]{10,128}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function desiredSource(mode: AudioMode, hovered: boolean, muted: boolean): ActiveSource {
  if (muted) return 'NONE';
  if (mode === 'CARTOON_LOCKED') return 'CARTOON';
  if (mode === 'LOFI_LOCKED') return 'LOFI';
  return hovered ? 'CARTOON' : 'LOFI';
}

export function nextAudioMode(mode: AudioMode): AudioMode {
  if (mode === 'AUTO_HOVER') return 'LOFI_LOCKED';
  if (mode === 'LOFI_LOCKED') return 'CARTOON_LOCKED';
  return 'AUTO_HOVER';
}

export class ClickInterpreter {
  private counts = { back: 0, forward: 0 };
  private timers: Partial<Record<'back' | 'forward', ReturnType<typeof setTimeout>>> = {};
  private locked = { back: false, forward: false };

  constructor(private readonly emit: (action: TransportAction) => void, private readonly delay = 700) {}

  press(direction: 'back' | 'forward'): void {
    if (this.locked[direction]) return;
    this.counts[direction] += 1;
    if (this.counts[direction] === 1) {
      this.timers[direction] = setTimeout(() => {
        this.emit(direction === 'back' ? 'SEEK_BACK' : 'SEEK_FORWARD');
        this.reset(direction);
      }, this.delay);
    }
    if (this.counts[direction] === 3) {
      clearTimeout(this.timers[direction]);
      this.emit(direction === 'back' ? 'PREVIOUS' : 'NEXT');
      this.counts[direction] = 0;
      this.locked[direction] = true;
      this.timers[direction] = setTimeout(() => {
        this.locked[direction] = false;
        delete this.timers[direction];
      }, this.delay);
    }
  }

  release(_direction: 'back' | 'forward'): void {}

  dispose(): void {
    clearTimeout(this.timers.back);
    clearTimeout(this.timers.forward);
  }

  private reset(direction: 'back' | 'forward'): void {
    this.counts[direction] = 0;
    delete this.timers[direction];
  }
}
