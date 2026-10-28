import { writeFileSync } from 'node:fs';
import { Random } from '../src/core/random.ts';
import { Evolution, type EvolutionConfig } from '../src/ai/evolution.ts';
import { controllerFor } from '../src/ai/network.ts';
import { Agent } from '../src/sim/agent.ts';
import { Episode } from '../src/sim/episode.ts';
import { RewardFunction, type RewardWeights } from '../src/sim/reward.ts';
import { TrackFactory } from '../src/sim/track-factory.ts';
import type { Track } from '../src/sim/track.ts';

const GENERATIONS = Number(process.argv[2] ?? 120);
const OUT = new URL('../src/assets/base-model.json', import.meta.url);
const REWARDS: RewardWeights = { progress: 4, speed: 1.5, crash: -3, drift: 0, idle: -2, jerk: -0.5 };
const CONFIG: EvolutionConfig = { populationSize: 60, eliteCount: 5, tournamentSize: 4, mutationRate: 0.1, mutationStrength: 0.3 };

const rng = new Random(2026);
const evolution = new Evolution(rng, CONFIG);
const rewards = new RewardFunction(REWARDS);
const training = TrackFactory.create(TrackFactory.TRAINING_SEED);

// Same start slots as Trainer: the circuit alternates pole and second, the practice tracks take one each.
const evaluate = (genome: Float32Array, tracks: Track[], generation: number) =>
  tracks.reduce((sum, track, i) => {
    const { index, lateral } = track.gridSlot(i === 0 ? generation % 2 : (i - 1) % 2);
    return sum + new Episode(new Agent(controllerFor(genome), track, index, lateral), track, rewards).run();
  }, 0) / tracks.length;
const practiceTrack = () => TrackFactory.create(rng.int(0, 1e9), TrackFactory.randomShape(rng));

let population = evolution.seed();
let best = { genome: population[0], fitness: -Infinity };

for (let generation = 1; generation <= GENERATIONS; generation++) {
  const tracks = [training, practiceTrack(), practiceTrack()];
  const fitness = population.map((genome) => evaluate(genome, tracks, generation));
  const top = fitness.indexOf(Math.max(...fitness));
  best = { genome: population[top], fitness: fitness[top] };
  console.log(`gen ${generation} best ${best.fitness.toFixed(1)} avg ${(fitness.reduce((a, b) => a + b) / fitness.length).toFixed(1)}`);
  population = evolution.next(population, fitness);
}

writeFileSync(
  OUT,
  JSON.stringify({ generation: GENERATIONS, fitness: Math.round(best.fitness), rewards: REWARDS, weights: Array.from(best.genome, (w) => +w.toFixed(4)) }) + '\n',
);
console.log(`Saved base model to ${OUT.pathname}`);
