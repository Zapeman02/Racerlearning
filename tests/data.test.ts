import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BASE_MODEL, BASE_MODEL_ID, isTrained, ModelRepository } from '../src/data/models.ts';
import { memoryStore, LocalCollection } from '../src/data/storage.ts';
import { TRAINING_TRACK, TrackRepository } from '../src/data/tracks.ts';
import { parseModel, serializeModel } from '../src/data/transfer.ts';
import { NeuralNetwork } from '../src/ai/network.ts';
import { DEFAULT_REWARDS } from '../src/sim/reward.ts';

test('LocalCollection upserts, removes and survives corrupt data', () => {
  const store = memoryStore();
  const c = new LocalCollection<{ id: string; v: number }>('k', store);
  c.upsert({ id: 'a', v: 1 });
  c.upsert({ id: 'a', v: 2 });
  c.upsert({ id: 'b', v: 3 });
  assert.deepEqual(c.all(), [{ id: 'a', v: 2 }, { id: 'b', v: 3 }]);
  c.remove('a');
  assert.deepEqual(c.all().map((i) => i.id), ['b']);
  store.setItem('k', '{broken');
  assert.deepEqual(c.all(), []);
});

test('base model is bundled, trained and read-only', () => {
  const repo = new ModelRepository(memoryStore());
  assert.equal(repo.all()[0].id, BASE_MODEL_ID);
  assert.ok(isTrained(BASE_MODEL));
  assert.throws(() => repo.rename(BASE_MODEL_ID, 'x'));
  assert.throws(() => repo.remove(BASE_MODEL_ID));
});

test('models can be created from scratch or from base', () => {
  const store = memoryStore();
  const repo = new ModelRepository(store);
  const scratch = repo.create('  Drifty  ', '#00f0ff', false);
  const fork = repo.create('', '#ff2bd6', true);
  assert.equal(scratch.name, 'Drifty');
  assert.equal(isTrained(scratch), false);
  assert.equal(fork.name, 'Racer');
  assert.deepEqual(fork.weights, BASE_MODEL.weights);
  assert.equal(new ModelRepository(store).all().length, 3);
});

test('recordGeneration stores weights, fitness and history', () => {
  const repo = new ModelRepository(memoryStore());
  const m = repo.create('A', '#fff', false);
  const weights = new Float32Array(NeuralNetwork.weightCount).fill(0.123456);
  repo.recordGeneration(m.id, weights, 10.6, 1, DEFAULT_REWARDS);
  const saved = repo.recordGeneration(m.id, weights, 20.2, 2, { ...DEFAULT_REWARDS, drift: 5 });
  assert.equal(saved.generation, 2);
  assert.deepEqual(saved.history, [11, 20]);
  assert.equal(saved.rewards.drift, 5);
  assert.equal(saved.weights![0], 0.1235);
  assert.ok(isTrained(saved));
});

test('rename and remove user models', () => {
  const repo = new ModelRepository(memoryStore());
  const m = repo.create('A', '#fff', false);
  assert.equal(repo.rename(m.id, 'Tokyo').name, 'Tokyo');
  assert.equal(repo.rename(m.id, '   ').name, 'Tokyo');
  repo.remove(m.id);
  assert.equal(repo.get(m.id), undefined);
});

test('export and import round-trip a model', () => {
  const repo = new ModelRepository(memoryStore());
  const original = repo.create('Export me', '#7cff4f', true);
  const imported = repo.add(parseModel(serializeModel(original)));
  assert.notEqual(imported.id, original.id);
  assert.equal(imported.name, 'Export me');
  assert.deepEqual(imported.weights, original.weights);
});

test('import rejects invalid files', () => {
  assert.throws(() => parseModel('{"format":"other"}'), /Not a Racerlearning/);
  assert.throws(() => parseModel(JSON.stringify({ format: 'racerlearning-model', model: { weights: [1, 2] } })), /invalid weights/);
  assert.throws(() => parseModel('not json'));
});

test('tracks: training track is built in, saved tracks persist', () => {
  const store = memoryStore();
  const repo = new TrackRepository(store);
  const t = repo.create('Night Loop', 42, 'harbor');
  assert.deepEqual(new TrackRepository(store).all().map((x) => x.id), [TRAINING_TRACK.id, t.id]);
  assert.throws(() => repo.remove(TRAINING_TRACK.id));
  repo.remove(t.id);
  assert.equal(repo.all().length, 1);
});
