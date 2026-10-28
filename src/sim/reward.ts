import { CAR } from './car.ts';
import type { Agent } from './agent.ts';
import { EPISODE } from './episode.ts';

export type RewardKey = 'progress' | 'speed' | 'finish' | 'crash' | 'drift' | 'idle' | 'jerk';
export type RewardWeights = Record<RewardKey, number>;

export const REWARD_RANGE = 5;

/** Strategy: one measurable behaviour. The player's slider is its weight. */
export interface RewardTerm {
  key: RewardKey;
  label: string;
  hint: string;
  measure(agent: Agent, dt: number, trackLength: number, time: number): number;
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
    key: 'finish',
    label: 'Finish time',
    hint: 'Crossing the line early',
    // Paid once, on the step the last lap completes, so finishers are ranked by time and not just distance.
    measure: (agent, _dt, _n, time) => (agent.lap >= EPISODE.laps ? Math.max(0, EPISODE.maxTime - time) * 10 : 0),
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

export const DEFAULT_REWARDS: RewardWeights = { progress: 3, speed: 1, finish: 1, crash: -3, drift: 0, idle: -2, jerk: 0 };

export class RewardFunction {
  weights: RewardWeights;

  constructor(weights: RewardWeights) {
    // Models saved before the finish reward existed have no weight for it.
    this.weights = { ...weights, finish: weights.finish ?? 0 };
  }

  evaluate(agent: Agent, dt: number, trackLength: number, time: number): number {
    let total = 0;
    for (const term of REWARD_TERMS) {
      const weight = this.weights[term.key];
      if (weight !== 0) total += weight * term.measure(agent, dt, trackLength, time);
    }
    return total;
  }
}
