import type { Controller } from '../src/sim/agent.ts';
import type { CarInput } from '../src/sim/car.ts';
import { Track } from '../src/sim/track.ts';

/** A circular track: easy to reason about in tests. */
export function circleTrack(radius = 600, segments = 240): Track {
  const points = Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * Math.PI * 2;
    return { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
  });
  return new Track(1, points);
}

export class FixedController implements Controller {
  steer: number;
  throttle: number;
  constructor(steer: number, throttle: number) {
    this.steer = steer;
    this.throttle = throttle;
  }
  decide(_inputs: Float32Array, out: CarInput): void {
    out.steer = this.steer;
    out.throttle = this.throttle;
  }
}
