import { clamp, wrapAngle } from '../core/math.ts';
import { CAR, type Car } from './car.ts';
import type { Track } from './track.ts';

export const RAY_ANGLES = [-Math.PI / 2, -Math.PI / 4, -Math.PI / 9, 0, Math.PI / 9, Math.PI / 4, Math.PI / 2];
export const RAY_LENGTH = 520;
const LOOKAHEAD = [6, 20];
export const INPUT_SIZE = RAY_ANGLES.length + 2 + LOOKAHEAD.length;

/** Turns the car's surroundings into normalized network inputs. */
export class Sensors {
  readonly rays = new Float32Array(RAY_ANGLES.length);
  readonly inputs = new Float32Array(INPUT_SIZE);

  read(car: Car, track: Track, segment: number): Float32Array {
    let i = 0;
    for (let r = 0; r < RAY_ANGLES.length; r++) {
      this.rays[r] = track.raycast(car, car.heading + RAY_ANGLES[r], RAY_LENGTH, segment);
      this.inputs[i++] = this.rays[r] / RAY_LENGTH;
    }
    this.inputs[i++] = car.forwardSpeed / CAR.maxSpeed;
    this.inputs[i++] = clamp(car.lateralSpeed / (CAR.maxSpeed * 0.5), -1, 1);
    for (const ahead of LOOKAHEAD) {
      this.inputs[i++] = Math.sin(wrapAngle(track.angles[track.wrap(segment + ahead)] - car.heading));
    }
    return this.inputs;
  }
}
