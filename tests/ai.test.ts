import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Random } from '../src/core/random.ts';
import { Evolution } from '../src/ai/evolution.ts';
import { NeuralNetwork } from '../src/ai/network.ts';
import { Trainer } from '../src/ai/trainer.ts';
import { DEFAULT_REWARDS } from '../src/sim/reward.ts';
import { INPUT_SIZE } from '../src/sim/sensors.ts';
import { circleTrack } from './helpers.ts';

test('network rejects wrong weight count', () => {
  assert.throws(() => new NeuralNetwork([1, 2, 3]));
});

test('network outputs are bounded and deterministic', () => {
  const net = NeuralNetwork.random(new Random(1));
  const inputs = new Float32Array(INPUT_SIZE).fill(0.5);
  const a = new Float32Array(2);
  const b = new Float32Array(2);
  net.forward(inputs, a);
  new NeuralNetwork(net.weights).forward(inputs, b);
  assert.deepEqual(a, b);
  assert.ok(a.every((v) => v >= -1 && v <= 1));
});

test('evolution seeds from a base genome and keeps it intact', () => {
  const evo = new Evolution(new Random(2));
  const base = NeuralNetwork.random(new Random(3)).weights;
  const population = evo.seed(base);
  assert.equal(population.length, evo.config.populationSize);
  assert.deepEqual(population[0], base);
  assert.notDeepEqual(population[1], base);
});

test('evolution keeps the elite in fitness order', () => {
  const evo = new Evolution(new Random(4));
  const population = evo.seed();
  const fitness = population.map((_, i) => i);
  const next = evo.next(population, fitness);
  assert.equal(next.length, population.length);
  for (let e = 0; e < evo.config.eliteCount; e++) assert.equal(next[e], population[population.length - 1 - e]);
});

test('trainer emits generation stats and improves over generations', () => {
  const trainer = new Trainer(circleTrack(900, 360), DEFAULT_REWARDS, new Random(5));
  const bests: number[] = [];
  trainer.events.on('generation', (s) => bests.push(s.best));
  while (bests.length < 8) trainer.tick();
  assert.equal(trainer.generation, 8);
  assert.ok(Math.max(...bests.slice(-3)) >= bests[0], bests.join(', '));
});
