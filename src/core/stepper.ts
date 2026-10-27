import { DT } from '../sim/episode.ts';

export type Speed = number | 'max';

const MAX_FRAME = 0.1;

/** Converts variable frame time into fixed simulation ticks, at a chosen speed. */
export class Stepper {
  speed: Speed = 1;
  private accumulator = 0;
  private readonly now: () => number;

  constructor(now: () => number = () => performance.now()) {
    this.now = now;
  }

  advance(frameSeconds: number, tick: () => void, budgetMs = 12): number {
    let ticks = 0;
    if (this.speed === 'max') {
      const end = this.now() + budgetMs;
      do {
        tick();
        ticks++;
      } while (this.now() < end);
      return ticks;
    }
    this.accumulator += Math.min(frameSeconds, MAX_FRAME) * this.speed;
    while (this.accumulator >= DT) {
      tick();
      ticks++;
      this.accumulator -= DT;
    }
    return ticks;
  }
}
