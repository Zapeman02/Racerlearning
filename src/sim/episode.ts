import type { Agent } from './agent.ts';
import type { RewardFunction } from './reward.ts';
import type { Track } from './track.ts';

export const DT = 1 / 60;
export const EPISODE = { maxTime: 45, stallTime: 3, laps: 3 } as const;

/** One training run of an agent: accumulates fitness and decides when the run is over. */
export class Episode {
  readonly agent: Agent;
  fitness = 0;
  time = 0;
  done = false;
  private readonly track: Track;
  private readonly rewards: RewardFunction;
  private bestProgress: number;
  private lastImprovement = 0;

  constructor(agent: Agent, track: Track, rewards: RewardFunction) {
    this.agent = agent;
    this.track = track;
    this.rewards = rewards;
    this.bestProgress = agent.progress;
  }

  step(dt = DT): void {
    if (this.done) return;
    this.agent.step(this.track, dt);
    this.time += dt;
    this.fitness += this.rewards.evaluate(this.agent, dt, this.track.length);
    if (this.agent.progress > this.bestProgress + 1) {
      this.bestProgress = this.agent.progress;
      this.lastImprovement = this.time;
    }
    this.done =
      this.agent.offTrack ||
      this.time - this.lastImprovement > EPISODE.stallTime ||
      this.time >= EPISODE.maxTime ||
      this.agent.lap >= EPISODE.laps;
  }

  run(): number {
    while (!this.done) this.step();
    return this.fitness;
  }
}
