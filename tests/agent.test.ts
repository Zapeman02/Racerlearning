import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Agent } from '../src/sim/agent.ts';
import { DT, Episode } from '../src/sim/episode.ts';
import { RewardFunction, DEFAULT_REWARDS, type RewardWeights } from '../src/sim/reward.ts';
import { RAY_LENGTH } from '../src/sim/sensors.ts';
import { circleTrack, FixedController } from './helpers.ts';

const only = (key: keyof RewardWeights, value = 1): RewardWeights => ({ progress: 0, speed: 0, crash: 0, drift: 0, idle: 0, jerk: 0, [key]: value });

test('progress increases when driving forward and wraps laps', () => {
  const track = circleTrack(2000, 800);
  const agent = new Agent(new FixedController(0.06, 1), track);
  for (let i = 0; i < 60 * 3; i++) agent.step(track, DT);
  assert.ok(agent.progress > 10);
  assert.equal(agent.lap, 0);
});

test('driving straight off a circle leaves the track', () => {
  const track = circleTrack(600);
  const agent = new Agent(new FixedController(0, 1), track);
  for (let i = 0; i < 120 && !agent.offTrack; i++) agent.step(track, DT);
  assert.ok(agent.offTrack);
});

test('sensors produce normalized inputs', () => {
  const track = circleTrack(600);
  const agent = new Agent(new FixedController(0, 0), track);
  const inputs = agent.sensors.read(agent.car, track, agent.segment);
  for (const v of inputs) assert.ok(v >= -1 && v <= 1, `input ${v}`);
  assert.ok(agent.sensors.rays.every((r) => r > 0 && r <= RAY_LENGTH));
});

test('agents starting behind the line have negative progress', () => {
  const track = circleTrack();
  assert.equal(new Agent(new FixedController(0, 0), track, track.length - 4).progress, -4);
});

test('respawn puts the agent back on the centerline', () => {
  const track = circleTrack(600);
  const agent = new Agent(new FixedController(0, 1), track);
  for (let i = 0; i < 120 && !agent.offTrack; i++) agent.step(track, DT);
  agent.respawn(track);
  assert.equal(agent.offTrack, false);
  assert.ok(track.locate(agent.car, agent.segment).distance < 1);
});

test('crash reward fires only when off track', () => {
  const track = circleTrack(600);
  const agent = new Agent(new FixedController(0, 0), track);
  const rewards = new RewardFunction(only('crash', -2));
  assert.equal(rewards.evaluate(agent, DT, track.length), 0);
  agent.offTrack = true;
  assert.equal(rewards.evaluate(agent, DT, track.length), -100);
});

test('idle reward punishes standing still', () => {
  const track = circleTrack(600);
  const agent = new Agent(new FixedController(0, 0), track);
  assert.ok(new RewardFunction(only('idle', -1)).evaluate(agent, DT, track.length) < 0);
});

test('episode ends when the agent stalls', () => {
  const track = circleTrack(600);
  const episode = new Episode(new Agent(new FixedController(0, 0), track), track, new RewardFunction(DEFAULT_REWARDS));
  episode.run();
  assert.ok(episode.done);
  assert.ok(episode.time < 4);
  assert.ok(episode.fitness < 0);
});

test('episode rewards a car that follows the track', () => {
  const track = circleTrack(2000, 800);
  const rewards = new RewardFunction(only('progress'));
  const steady = new Episode(new Agent(new FixedController(0.06, 0.6), track), track, rewards).run();
  const crashing = new Episode(new Agent(new FixedController(-1, 1), track), track, rewards).run();
  assert.ok(steady > crashing, `${steady} vs ${crashing}`);
});
