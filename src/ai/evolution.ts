import type { Random } from '../core/random.ts';
import { NeuralNetwork } from './network.ts';

export type Genome = Float32Array;

export interface EvolutionConfig {
  populationSize: number;
  eliteCount: number;
  tournamentSize: number;
  mutationRate: number;
  mutationStrength: number;
}

export const DEFAULT_EVOLUTION: EvolutionConfig = {
  populationSize: 40,
  eliteCount: 4,
  tournamentSize: 3,
  mutationRate: 0.1,
  mutationStrength: 0.3,
};

/** Neuroevolution: keep the best genomes, breed the rest by tournament, crossover and mutation. */
export class Evolution {
  readonly config: EvolutionConfig;
  private readonly rng: Random;

  constructor(rng: Random, config: EvolutionConfig = DEFAULT_EVOLUTION) {
    this.rng = rng;
    this.config = config;
  }

  seed(base?: ArrayLike<number>): Genome[] {
    const { populationSize } = this.config;
    if (!base) return Array.from({ length: populationSize }, () => NeuralNetwork.random(this.rng).weights);
    const original = Float32Array.from(base);
    return [original, ...Array.from({ length: populationSize - 1 }, () => this.mutate(original))];
  }

  next(population: Genome[], fitness: number[]): Genome[] {
    const ranked = population.map((genome, i) => ({ genome, fitness: fitness[i] })).sort((a, b) => b.fitness - a.fitness);
    const next = ranked.slice(0, this.config.eliteCount).map((r) => r.genome);
    while (next.length < this.config.populationSize) {
      next.push(this.mutate(this.crossover(this.tournament(ranked), this.tournament(ranked))));
    }
    return next;
  }

  mutate(genome: Genome): Genome {
    const child = Float32Array.from(genome);
    for (let i = 0; i < child.length; i++) {
      if (this.rng.chance(this.config.mutationRate)) child[i] += this.rng.gaussian() * this.config.mutationStrength;
    }
    return child;
  }

  private crossover(a: Genome, b: Genome): Genome {
    const child = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) child[i] = this.rng.chance(0.5) ? a[i] : b[i];
    return child;
  }

  private tournament(ranked: { genome: Genome; fitness: number }[]): Genome {
    let best = this.rng.pick(ranked);
    for (let i = 1; i < this.config.tournamentSize; i++) {
      const candidate = this.rng.pick(ranked);
      if (candidate.fitness > best.fitness) best = candidate;
    }
    return best.genome;
  }
}
