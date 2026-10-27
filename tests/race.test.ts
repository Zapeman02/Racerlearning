import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Race, type RacerEntry } from '../src/race/race.ts';
import { BASE_MODEL } from '../src/data/models.ts';
import { NeuralNetwork } from '../src/ai/network.ts';
import { Random } from '../src/core/random.ts';
import { TrackFactory } from '../src/sim/track-factory.ts';

const base: RacerEntry = { id: 'base', name: 'Base', color: '#f00', weights: BASE_MODEL.weights! };
const noob: RacerEntry = { id: 'noob', name: 'Noob', color: '#0f0', weights: NeuralNetwork.random(new Random(9)).weights };

test('race starts with a countdown and racers behind the line', () => {
  const race = new Race(TrackFactory.create(5), [base, noob], 1);
  assert.equal(race.phase, 'countdown');
  assert.ok(race.racers.every((r) => r.agent.progress < 0));
  race.tick();
  assert.ok(race.racers.every((r) => r.agent.progress < 0 && r.agent.car.forwardSpeed === 0));
});

test('base model finishes a lap and beats a random network', () => {
  const race = new Race(TrackFactory.create(TrackFactory.TRAINING_SEED), [base, noob], 1);
  const phases: string[] = [];
  race.events.on('phase', (p) => phases.push(p));
  for (let i = 0; i < 60 * 60 && race.phase !== 'finished'; i++) {
    race.tick();
    if (race.racers[0].finishTime !== null) break;
  }
  assert.ok(race.racers[0].finishTime !== null, 'base did not finish');
  assert.equal(race.standings()[0].entry.id, 'base');
  assert.deepEqual(phases, ['running']);
});

test('race finishes when every racer is done', () => {
  const race = new Race(TrackFactory.create(TrackFactory.TRAINING_SEED), [base], 1);
  for (let i = 0; i < 60 * 90 && race.phase !== 'finished'; i++) race.tick();
  assert.equal(race.phase, 'finished');
  assert.equal(race.lapOf(race.racers[0]), 1);
});
