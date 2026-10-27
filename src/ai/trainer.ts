import { Emitter } from '../core/emitter.ts';
import type { Random } from '../core/random.ts';
import { Agent } from '../sim/agent.ts';
import { Episode } from '../sim/episode.ts';
import { RewardFunction, type RewardWeights } from '../sim/reward.ts';
import type { Track } from '../sim/track.ts';
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

/** Runs a whole population side by side on one track and evolves it between generations. */
export class Trainer {
  readonly events = new Emitter<TrainerEvents>();
  readonly track: Track;
  readonly rewards: RewardFunction;
  generation: number;
  episodes: Episode[] = [];
  private population: Genome[];
  private readonly evolution: Evolution;

  constructor(track: Track, rewards: RewardWeights, rng: Random, base?: ArrayLike<number>, generation = 0) {
    this.track = track;
    this.rewards = new RewardFunction(rewards);
    this.evolution = new Evolution(rng);
    this.population = this.evolution.seed(base);
    this.generation = generation;
    this.startGeneration();
  }

  get alive(): number {
    return this.episodes.filter((e) => !e.done).length;
  }

  /** The best still-running episode, falling back to the best finished one. */
  get leader(): Episode {
    return this.episodes.reduce((best, e) => {
      if (best.done !== e.done) return e.done ? best : e;
      return e.fitness > best.fitness ? e : best;
    });
  }

  tick(): void {
    for (const episode of this.episodes) episode.step();
    if (this.episodes.every((e) => e.done)) this.finishGeneration();
  }

  private startGeneration(): void {
    this.episodes = this.population.map((genome) => new Episode(new Agent(controllerFor(genome), this.track), this.track, this.rewards));
  }

  private finishGeneration(): void {
    const fitness = this.episodes.map((e) => e.fitness);
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
