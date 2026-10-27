import { Emitter } from '../core/emitter.ts';
import { controllerFor } from '../ai/network.ts';
import { Agent } from '../sim/agent.ts';
import { DT } from '../sim/episode.ts';
import type { Track } from '../sim/track.ts';

export interface RacerEntry {
  id: string;
  name: string;
  color: string;
  weights: ArrayLike<number>;
}

export interface Racer {
  entry: RacerEntry;
  agent: Agent;
  finishTime: number | null;
  frozen: number;
}

export type RacePhase = 'countdown' | 'running' | 'finished';

interface RaceEvents {
  phase: RacePhase;
}

const COUNTDOWN = 3;
const RESPAWN_FREEZE = 0.8;
const STALL_TIME = 4;
const GRID_GAP = 4;

/** A race between neural drivers: countdown, laps, crash respawns and standings. */
export class Race {
  readonly events = new Emitter<RaceEvents>();
  readonly track: Track;
  readonly laps: number;
  readonly racers: Racer[];
  phase: RacePhase = 'countdown';
  countdown = COUNTDOWN;
  time = 0;
  private readonly lastProgress = new Map<Racer, { progress: number; time: number }>();

  constructor(track: Track, entries: RacerEntry[], laps: number) {
    this.track = track;
    this.laps = laps;
    this.racers = entries.map((entry, i) => {
      const row = Math.floor(i / 2) + 1;
      const lateral = (i % 2 === 0 ? -1 : 1) * track.width * 0.22;
      const agent = new Agent(controllerFor(entry.weights), track, track.length - row * GRID_GAP, lateral);
      return { entry, agent, finishTime: null, frozen: 0 };
    });
    this.racers.forEach((r) => this.lastProgress.set(r, { progress: r.agent.progress, time: 0 }));
  }

  get distance(): number {
    return this.laps * this.track.length;
  }

  lapOf(racer: Racer): number {
    return Math.min(this.laps, Math.max(1, racer.agent.lap + 1));
  }

  standings(): Racer[] {
    return [...this.racers].sort((a, b) => {
      if (a.finishTime !== null || b.finishTime !== null) return (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity);
      return b.agent.progress - a.agent.progress;
    });
  }

  tick(dt = DT): void {
    if (this.phase === 'finished') return;
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) this.setPhase('running');
      return;
    }
    this.time += dt;
    for (const racer of this.racers) this.stepRacer(racer, dt);
    if (this.racers.every((r) => r.finishTime !== null)) this.setPhase('finished');
  }

  private stepRacer(racer: Racer, dt: number): void {
    if (racer.finishTime !== null) return;
    if (racer.frozen > 0) {
      racer.frozen -= dt;
      return;
    }
    racer.agent.step(this.track, dt);
    const last = this.lastProgress.get(racer)!;
    if (racer.agent.progress > last.progress + 1) this.lastProgress.set(racer, { progress: racer.agent.progress, time: this.time });
    if (racer.agent.offTrack || this.time - last.time > STALL_TIME) {
      racer.agent.respawn(this.track);
      racer.frozen = RESPAWN_FREEZE;
      this.lastProgress.set(racer, { progress: racer.agent.progress, time: this.time });
    }
    if (racer.agent.progress >= this.distance) racer.finishTime = this.time;
  }

  private setPhase(phase: RacePhase): void {
    this.phase = phase;
    this.events.emit('phase', phase);
  }
}
