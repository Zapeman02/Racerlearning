import { TrackFactory } from '../sim/track-factory.ts';
import { cleanName, LocalCollection, newId, type KeyValueStore } from './storage.ts';

export interface TrackRecord {
  id: string;
  name: string;
  seed: number;
  themeId: string;
  builtIn?: boolean;
}

export const TRAINING_TRACK: TrackRecord = Object.freeze({
  id: 'training',
  name: 'Training Circuit',
  seed: TrackFactory.TRAINING_SEED,
  themeId: 'shibuya',
  builtIn: true,
});

export class TrackRepository {
  private readonly collection: LocalCollection<TrackRecord>;

  constructor(store: KeyValueStore) {
    this.collection = new LocalCollection('racerlearning.tracks', store);
  }

  all(): TrackRecord[] {
    return [TRAINING_TRACK, ...this.collection.all()];
  }

  get(id: string): TrackRecord | undefined {
    return this.all().find((t) => t.id === id);
  }

  create(name: string, seed: number, themeId: string): TrackRecord {
    return this.collection.upsert({ id: newId(), name: cleanName(name, `Track ${seed % 1000}`), seed, themeId });
  }

  add(track: TrackRecord): TrackRecord {
    return this.create(track.name, track.seed, track.themeId);
  }

  remove(id: string): void {
    if (id === TRAINING_TRACK.id) throw new Error('The training track is built in');
    this.collection.remove(id);
  }
}
