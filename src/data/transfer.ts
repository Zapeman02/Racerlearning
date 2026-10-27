import { NeuralNetwork } from '../ai/network.ts';
import { DEFAULT_REWARDS, REWARD_TERMS } from '../sim/reward.ts';
import type { ModelRecord } from './models.ts';

const FORMAT = 'racerlearning-model';
const VERSION = 1;

export function serializeModel(model: ModelRecord): string {
  const { id: _id, builtIn: _builtIn, ...data } = model;
  return JSON.stringify({ format: FORMAT, version: VERSION, model: data }, null, 2);
}

/** Validates an exported file and returns a model ready to be added to the repository. */
export function parseModel(text: string): ModelRecord {
  const file = JSON.parse(text);
  if (file?.format !== FORMAT) throw new Error('Not a Racerlearning model file');
  const m = file.model ?? {};
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
