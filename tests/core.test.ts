import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Emitter } from '../src/core/emitter.ts';
import { clamp, wrapAngle } from '../src/core/math.ts';
import { Random } from '../src/core/random.ts';

test('Random is deterministic per seed', () => {
  const a = new Random(42);
  const b = new Random(42);
  const c = new Random(43);
  const seqA = [a.next(), a.next(), a.next()];
  assert.deepEqual(seqA, [b.next(), b.next(), b.next()]);
  assert.notDeepEqual(seqA, [c.next(), c.next(), c.next()]);
});

test('Random.int stays within range', () => {
  const rng = new Random(7);
  for (let i = 0; i < 1000; i++) {
    const v = rng.int(3, 9);
    assert.ok(v >= 3 && v < 9 && Number.isInteger(v));
  }
});

test('wrapAngle and clamp', () => {
  assert.ok(Math.abs(wrapAngle(Math.PI * 3) - Math.PI) < 1e-9 || Math.abs(wrapAngle(Math.PI * 3) + Math.PI) < 1e-9);
  assert.ok(Math.abs(wrapAngle(-0.5 - Math.PI * 4) + 0.5) < 1e-9);
  assert.equal(clamp(5, 0, 2), 2);
  assert.equal(clamp(-1, 0, 2), 0);
});

test('Emitter notifies subscribers and supports unsubscribe', () => {
  const emitter = new Emitter<{ ping: number }>();
  const received: number[] = [];
  const off = emitter.on('ping', (n) => received.push(n));
  emitter.emit('ping', 1);
  off();
  emitter.emit('ping', 2);
  assert.deepEqual(received, [1]);
});
