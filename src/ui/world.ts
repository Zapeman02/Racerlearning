import type { TrackRecord } from '../data/tracks.ts';
import { TrackFactory } from '../sim/track-factory.ts';
import type { Track } from '../sim/track.ts';
import { generateScenery, type Scenery } from '../render/scenery.ts';
import { themeById, type Theme } from '../render/themes.ts';

export interface World {
  track: Track;
  theme: Theme;
  scenery: Scenery;
}

const cache = new Map<string, World>();

export function worldFor(record: Pick<TrackRecord, 'seed' | 'themeId' | 'shape'>): World {
  const key = `${record.seed}:${record.themeId}:${JSON.stringify(record.shape ?? null)}`;
  let world = cache.get(key);
  if (!world) {
    world = worldOf(TrackFactory.create(record.seed, record.shape), themeById(record.themeId));
    cache.set(key, world);
  }
  return world;
}

/** Uncached, for throwaway tracks such as training's practice tracks. */
export function worldOf(track: Track, theme: Theme): World {
  return { track, theme, scenery: generateScenery(track, theme) };
}
