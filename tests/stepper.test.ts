import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Stepper } from '../src/core/stepper.ts';
import { DT } from '../src/sim/episode.ts';

test('long frames are capped so the sim cannot spiral', () => {
  let ticks = 0;
  new Stepper().advance(5, () => ticks++);
  assert.ok(ticks >= 5 && ticks <= 6, `ticks ${ticks}`);
});

test('fixed speeds run frame time * speed worth of ticks', () => {
  const stepper = new Stepper();
  let ticks = 0;
  stepper.speed = 4;
  stepper.advance(DT * 10, () => ticks++);
  assert.ok(ticks >= 39 && ticks <= 40, `ticks ${ticks}`);
});

test('max speed runs until the time budget is used', () => {
  let clock = 0;
  const stepper = new Stepper(() => clock);
  stepper.speed = 'max';
  const ticks = stepper.advance(DT, () => (clock += 1), 10);
  assert.equal(ticks, 10);
});
