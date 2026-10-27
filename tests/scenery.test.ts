import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateScenery } from '../src/render/scenery.ts';
import { THEMES, themeById } from '../src/render/themes.ts';
import { TrackFactory } from '../src/sim/track-factory.ts';

test('scenery never overlaps the asphalt', () => {
  for (const theme of THEMES) {
    const track = TrackFactory.create(77);
    const { props, lamps } = generateScenery(track, theme);
    assert.ok(props.length > 20, `${theme.id} has ${props.length} props`);
    assert.ok(lamps.length > 5);
    for (const p of props) assert.ok(track.locate(p, -1).distance > track.width / 2, `${theme.id} prop on track`);
    for (const l of lamps) assert.ok(track.locate(l, -1).distance > track.width / 2, `${theme.id} lamp on track`);
  }
});

test('scenery is deterministic per track and theme', () => {
  const track = TrackFactory.create(3);
  assert.deepEqual(generateScenery(track, THEMES[0]), generateScenery(track, THEMES[0]));
  assert.notDeepEqual(generateScenery(track, THEMES[0]).props, generateScenery(track, THEMES[1]).props);
});

test('unknown theme falls back to the first theme', () => {
  assert.equal(themeById('nope').id, THEMES[0].id);
});
