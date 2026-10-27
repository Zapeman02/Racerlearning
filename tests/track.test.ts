import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TrackFactory } from '../src/sim/track-factory.ts';
import { TRACK_WIDTH } from '../src/sim/track.ts';
import { circleTrack } from './helpers.ts';

test('TrackFactory is deterministic for a seed', () => {
  const a = TrackFactory.create(123);
  const b = TrackFactory.create(123);
  assert.deepEqual(a.points, b.points);
  assert.notDeepEqual(a.points, TrackFactory.create(124).points);
});

test('generated tracks are valid closed loops', () => {
  for (let seed = 0; seed < 25; seed++) {
    const track = TrackFactory.create(seed);
    assert.ok(track.length > 150, `seed ${seed} too short`);
    assert.ok(TrackFactory.isValid(track.points), `seed ${seed} invalid`);
  }
});

test('edges are half a track width from the centerline', () => {
  const track = TrackFactory.create(TrackFactory.TRAINING_SEED);
  for (let i = 0; i < track.length; i += 17) {
    const p = track.points[i];
    assert.ok(Math.abs(Math.hypot(track.left[i].x - p.x, track.left[i].y - p.y) - TRACK_WIDTH / 2) < 1e-6);
  }
});

test('locate finds the nearest segment and distance', () => {
  const track = circleTrack(600);
  const a = (60.5 / 240) * Math.PI * 2;
  const p = { x: Math.cos(a) * 650, y: Math.sin(a) * 650 };
  const hit = track.locate(p);
  assert.equal(hit.index, 60);
  assert.ok(Math.abs(hit.distance - 50) < 1);
  assert.equal(track.locate(p, 55).index, 60);
});

test('raycast hits the edge at the expected distance', () => {
  const track = circleTrack(600);
  const outward = track.raycast({ x: 600, y: 0 }, 0, 500, 0);
  assert.ok(Math.abs(outward - TRACK_WIDTH / 2) < 1, `got ${outward}`);
  const inward = track.raycast({ x: 600, y: 0 }, Math.PI, 500, 0);
  assert.ok(Math.abs(inward - TRACK_WIDTH / 2) < 1, `got ${inward}`);
});

test('delta wraps across the start line', () => {
  const track = circleTrack();
  assert.equal(track.delta(239, 1), 2);
  assert.equal(track.delta(1, 239), -2);
  assert.equal(track.delta(10, 15), 5);
});

test('poseAt offsets sideways from the centerline', () => {
  const track = circleTrack(600);
  const pose = track.poseAt(0, 30);
  assert.ok(Math.abs(Math.hypot(pose.x, pose.y) - 630) < 1 || Math.abs(Math.hypot(pose.x, pose.y) - 570) < 1);
});
