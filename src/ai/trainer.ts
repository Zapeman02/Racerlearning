import { Emitter } from '../core/emitter.ts';
import type { Random } from '../core/random.ts';
import { Agent } from '../sim/agent.ts';
import { Episode } from '../sim/episode.ts';
import { RewardFunction, type RewardWeights } from '../sim/reward.ts';
import type { Track } from '../sim/track.ts';
import { TrackFactory } from '../sim/track-factory.ts';
import { Evolution, type Genome } from './evolution.ts';
import { controllerFor } from './network.ts';

export interface GenerationStats {
  generation: number;
  best: number;
  average: number;
  bestGenome: Genome;
}

interface TrainerEvents {
  generation: GenerationStats;
}

const PRACTICE_TRACKS = 2;

/**
 * Runs a whole population side by side on the main track plus random practice tracks, and evolves it
 * on the average fitness so it learns to drive rather than memorise one circuit.
 */
export class Trainer {
  readonly events = new Emitter<TrainerEvents>();
  readonly track: Track;
  readonly rewards: RewardFunction;
  generation: number;
  /** One track per run: the main track first, then this generation's practice tracks. */
  tracks: Track[] = [];
  runs: Episode[][] = [];
  private population: Genome[];
  private readonly evolution: Evolution;
  private readonly rng: Random;

  constructor(track: Track, rewards: RewardWeights, rng: Random, base?: ArrayLike<number>, generation = 0) {
    this.track = track;
    this.rewards = new RewardFunction(rewards);
    this.rng = rng;
    this.evolution = new Evolution(rng);
    this.population = this.evolution.seed(base);
    this.generation = generation;
    this.startGeneration();
  }

  alive(run: number): number {
    return this.runs[run].filter((e) => !e.done).length;
  }

  /** The best still-running episode on a run, falling back to the best finished one. */
  leader(run: number): Episode {
    return this.runs[run].reduce((best, e) => {
      if (best.done !== e.done) return e.done ? best : e;
      return e.fitness > best.fitness ? e : best;
    });
  }

  tick(): void {
    for (const run of this.runs) for (const episode of run) episode.step();
    if (this.runs.every((run) => run.every((e) => e.done))) this.finishGeneration();
  }

  /** Start slots alternate between pole and second so neither side of the grid is favoured. */
  private startGeneration(): void {
    const practice = Array.from({ length: PRACTICE_TRACKS }, () => TrackFactory.create(this.rng.int(0, 1e9), TrackFactory.randomShape(this.rng)));
    this.tracks = [this.track, ...practice];
    this.runs = this.tracks.map((track, i) => this.runOn(track, i === 0 ? this.generation % 2 : (i - 1) % 2));
  }

  private runOn(track: Track, slot: number): Episode[] {
    const { index, lateral } = track.gridSlot(slot);
    return this.population.map((genome) => new Episode(new Agent(controllerFor(genome), track, index, lateral), track, this.rewards));
  }

  private finishGeneration(): void {
    const fitness = this.population.map((_, i) => this.runs.reduce((sum, run) => sum + run[i].fitness, 0) / this.runs.length);
    const bestIndex = fitness.indexOf(Math.max(...fitness));
    this.generation++;
    this.events.emit('generation', {
      generation: this.generation,
      best: fitness[bestIndex],
      average: fitness.reduce((a, b) => a + b, 0) / fitness.length,
      bestGenome: this.population[bestIndex],
    });
    this.population = this.evolution.next(this.population, fitness);
    this.startGeneration();
  }
}
