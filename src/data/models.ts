import baseModel from '../assets/base-model.json' with { type: 'json' };
import { NeuralNetwork } from '../ai/network.ts';
import type { Paint } from '../render/car-sprites.ts';
import { DEFAULT_REWARDS, type RewardWeights } from '../sim/reward.ts';
import { cleanName, LocalCollection, newId, type KeyValueStore } from './storage.ts';

export interface ModelRecord extends Paint {
  id: string;
  name: string;
  weights: number[] | null;
  rewards: RewardWeights;
  generation: number;
  bestFitness: number | null;
  history: number[];
  createdAt: number;
  builtIn?: boolean;
}

export const MODEL_COLORS = ['#ff2bd6', '#00f0ff', '#ffe600', '#ff7a1a', '#7cff4f', '#9d6bff', '#ffffff'];
export const ACCENT_COLORS = [...MODEL_COLORS, '#14141a'];
export const BASE_MODEL_ID = 'base';
const HISTORY_LIMIT = 300;

export const BASE_MODEL: ModelRecord = Object.freeze({
  id: BASE_MODEL_ID,
  name: 'KAMI-01',
  color: '#ff3355',
  weights: baseModel.weights,
  rewards: baseModel.rewards,
  generation: baseModel.generation,
  bestFitness: baseModel.fitness,
  history: [],
  createdAt: 0,
  builtIn: true,
});

export function isTrained(model: ModelRecord): model is ModelRecord & { weights: number[] } {
  return model.weights?.length === NeuralNetwork.weightCount;
}

export class ModelRepository {
  private readonly collection: LocalCollection<ModelRecord>;

  constructor(store: KeyValueStore) {
    this.collection = new LocalCollection('racerlearning.models', store);
  }

  all(): ModelRecord[] {
    return [BASE_MODEL, ...this.collection.all().sort((a, b) => a.createdAt - b.createdAt)];
  }

  get(id: string): ModelRecord | undefined {
    return id === BASE_MODEL_ID ? BASE_MODEL : this.collection.get(id);
  }

  create(name: string, color: string, fromBase: boolean): ModelRecord {
    return this.collection.upsert({
      id: newId(),
      name: cleanName(name, 'Racer'),
      color,
      weights: fromBase ? [...BASE_MODEL.weights!] : null,
      rewards: { ...(fromBase ? BASE_MODEL.rewards : DEFAULT_REWARDS) },
      generation: 0,
      bestFitness: null,
      history: [],
      createdAt: Date.now(),
    });
  }

  /** Stores the outcome of one training generation. */
  recordGeneration(id: string, weights: ArrayLike<number>, fitness: number, generation: number, rewards: RewardWeights): ModelRecord {
    const model = this.editable(id);
    return this.collection.upsert({
      ...model,
      weights: Array.from(weights, (w) => +w.toFixed(4)),
      rewards: { ...rewards },
      generation,
      bestFitness: Math.round(fitness),
      history: [...model.history, Math.round(fitness)].slice(-HISTORY_LIMIT),
    });
  }

  saveRewards(id: string, rewards: RewardWeights): void {
    this.collection.upsert({ ...this.editable(id), rewards: { ...rewards } });
  }

  rename(id: string, name: string): ModelRecord {
    const model = this.editable(id);
    return this.collection.upsert({ ...model, name: cleanName(name, model.name) });
  }

  repaint(id: string, paint: Partial<Paint>): ModelRecord {
    return this.collection.upsert({ ...this.editable(id), ...paint });
  }

  add(model: ModelRecord): ModelRecord {
    return this.collection.upsert({ ...model, id: newId(), builtIn: undefined, createdAt: Date.now() });
  }

  remove(id: string): void {
    this.editable(id);
    this.collection.remove(id);
  }

  private editable(id: string): ModelRecord {
    const model = this.collection.get(id);
    if (!model) throw new Error(id === BASE_MODEL_ID ? 'The base model is read-only' : `Unknown model ${id}`);
    return model;
  }
}
