import { CAR } from './car.ts';
import type { Agent } from './agent.ts';

export type RewardKey = 'progress' | 'speed' | 'crash' | 'drift' | 'idle' | 'jerk';
export type RewardWeights = Record<RewardKey, number>;

export const REWARD_RANGE = 5;

/** Strategy: one measurable behaviour. The player's slider is its weight. */
export interface RewardTerm {
  key: RewardKey;
  label: string;
  hint: string;
  measure(agent: Agent, dt: number, trackLength: number): number;
}

export const REWARD_TERMS: readonly RewardTerm[] = [
  {
    key: 'progress',
    label: 'Progress',
    hint: 'Moving forward along the track',
    measure: (agent, _dt, n) => (agent.lastDelta / n) * 100,
  },
  {
    key: 'speed',
    label: 'Speed',
    hint: 'Driving fast',
    measure: (agent, dt) => (Math.max(0, agent.car.forwardSpeed) / CAR.maxSpeed) * dt * 10,
  },
  {
    key: 'crash',
    label: 'Crash',
    hint: 'Leaving the asphalt',
    measure: (agent) => (agent.offTrack ? 50 : 0),
  },
  {
    key: 'drift',
    label: 'Drift',
    hint: 'Sliding sideways at speed',
    measure: (agent, dt) =>
      agent.car.forwardSpeed > 100 ? Math.min(Math.abs(agent.car.lateralSpeed) / 150, 1) * dt * 10 : 0,
  },
  {
    key: 'idle',
    label: 'Standing still',
    hint: 'Barely moving',
    measure: (agent, dt) => (agent.car.forwardSpeed < 40 ? dt * 10 : 0),
  },
  {
    key: 'jerk',
    label: 'Jerky steering',
    hint: 'Sudden steering changes',
    measure: (agent) => agent.steerChange * 0.5,
  },
];

export const DEFAULT_REWARDS: RewardWeights = { progress: 3, speed: 1, crash: -3, drift: 0, idle: -2, jerk: 0 };

export class RewardFunction {
  weights: RewardWeights;

  constructor(weights: RewardWeights) {
    this.weights = { ...weights };
  }

  evaluate(agent: Agent, dt: number, trackLength: number): number {
    let total = 0;
    for (const term of REWARD_TERMS) {
      const weight = this.weights[term.key];
      if (weight !== 0) total += weight * term.measure(agent, dt, trackLength);
    }
    return total;
  }
}
