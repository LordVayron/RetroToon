import type { AudioMode } from '../shared/types';
import { desiredSource, type ActiveSource } from './domain';
import type { YouTubePlayerAdapter } from './youtube';

export class AudioController {
  private transition = 0;
  private active: ActiveSource = 'NONE';

  constructor(private readonly cartoon: YouTubePlayerAdapter, private readonly lofi: YouTubePlayerAdapter) {}

  async apply(mode: AudioMode, hovered: boolean, muted: boolean, cartoonVolume: number, lofiVolume: number): Promise<ActiveSource> {
    const command = ++this.transition;
    const desired = desiredSource(mode, hovered, muted);

    this.cartoon.mute();
    if (desired !== 'LOFI') this.lofi.pause();
    else this.lofi.mute();
    await Promise.resolve();
    if (command !== this.transition) return this.active;

    if (desired === 'CARTOON') {
      this.cartoon.setVolume(cartoonVolume);
      this.cartoon.unmute();
    } else if (desired === 'LOFI') {
      this.lofi.setVolume(lofiVolume);
      this.lofi.unmute();
      this.lofi.play();
    }
    this.active = desired;
    return desired;
  }

  silence(): void {
    this.transition += 1;
    this.cartoon.mute();
    this.lofi.mute();
    this.active = 'NONE';
  }
}
