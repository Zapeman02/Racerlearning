import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Car, CAR } from '../src/sim/car.ts';
import { DT } from '../src/sim/episode.ts';

const run = (car: Car, steer: number, throttle: number, seconds: number) => {
  for (let i = 0; i < seconds / DT; i++) car.step({ steer, throttle }, DT);
};

test('throttle accelerates up to max speed', () => {
  const car = new Car({ x: 0, y: 0, heading: 0 });
  run(car, 0, 1, 10);
  assert.ok(car.forwardSpeed <= CAR.maxSpeed + 1e-6);
  assert.ok(car.forwardSpeed > CAR.maxSpeed * 0.9);
  assert.ok(car.x > 1000 && Math.abs(car.y) < 1e-6);
});

test('braking slows the car down', () => {
  const car = new Car({ x: 0, y: 0, heading: 0 });
  run(car, 0, 1, 3);
  const fast = car.forwardSpeed;
  run(car, 0, -1, 0.3);
  assert.ok(car.forwardSpeed < fast * 0.7);
});

test('cannot turn while standing still', () => {
  const car = new Car({ x: 0, y: 0, heading: 0 });
  run(car, 1, 0, 1);
  assert.equal(car.heading, 0);
});

test('hard steering at speed makes the car drift', () => {
  const car = new Car({ x: 0, y: 0, heading: 0 });
  run(car, 0, 1, 4);
  run(car, 1, 1, 0.4);
  assert.ok(Math.abs(car.lateralSpeed) > 60, `lateral ${car.lateralSpeed}`);
});

test('reset restores pose and stops the car', () => {
  const car = new Car({ x: 0, y: 0, heading: 0 });
  run(car, 0.3, 1, 2);
  car.reset({ x: 5, y: 6, heading: 1 });
  assert.deepEqual([car.x, car.y, car.heading, car.forwardSpeed], [5, 6, 1, 0]);
});
