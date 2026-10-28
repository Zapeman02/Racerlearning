import { NeuralNetwork } from '../ai/network.ts';
import { DEFAULT_REWARDS, REWARD_TERMS } from '../sim/reward.ts';
import type { ModelRecord } from './models.ts';
import type { TrackRecord } from './tracks.ts';

const VERSION = 1;

function wrap(kind: 'model' | 'track', record: { id: string; builtIn?: boolean }): string {
  const { id: _id, builtIn: _builtIn, ...data } = record;
  return JSON.stringify({ format: `racerlearning-${kind}`, version: VERSION, [kind]: data }, null, 2);
}

function unwrap(kind: 'model' | 'track', text: string) {
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON');
  }
  if (file?.format !== `racerlearning-${kind}`) throw new Error(`Not a Racerlearning ${kind} file`);
  return file[kind] ?? {};
}

export function serializeModel(model: ModelRecord): string {
  return wrap('model', model);
}

export function serializeTrack(track: TrackRecord): string {
  return wrap('track', track);
}

/** Validates an exported file and returns a track ready to be added to the repository. */
export function parseTrack(text: string): TrackRecord {
  const t = unwrap('track', text);
  if (!Number.isInteger(t.seed)) throw new Error('Track file has an invalid seed');
  return {
    id: '',
    name: typeof t.name === 'string' ? t.name : 'Imported track',
    seed: t.seed,
    themeId: typeof t.themeId === 'string' ? t.themeId : 'shibuya',
  };
}

/** Validates an exported file and returns a model ready to be added to the repository. */
export function parseModel(text: string): ModelRecord {
  const m = unwrap('model', text);
  if (!Array.isArray(m.weights) || m.weights.length !== NeuralNetwork.weightCount || !m.weights.every(Number.isFinite)) {
    throw new Error('Model file has invalid weights');
  }
  const rewards = { ...DEFAULT_REWARDS };
  for (const term of REWARD_TERMS) if (Number.isFinite(m.rewards?.[term.key])) rewards[term.key] = m.rewards[term.key];
  return {
    id: '',
    name: typeof m.name === 'string' ? m.name : 'Imported',
    color: typeof m.color === 'string' && /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#ffffff',
    weights: m.weights,
    rewards,
    generation: Number.isInteger(m.generation) ? m.generation : 0,
    bestFitness: Number.isFinite(m.bestFitness) ? m.bestFitness : null,
    history: Array.isArray(m.history) ? m.history.filter(Number.isFinite) : [],
    createdAt: Date.now(),
  };
}
