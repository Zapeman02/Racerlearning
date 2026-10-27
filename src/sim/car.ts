import { clamp, lerp, type Pose } from '../core/math.ts';

export interface CarInput {
  steer: number;
  throttle: number;
}

export const CAR = {
  length: 44,
  width: 22,
  maxSpeed: 560,
  reverseSpeed: 120,
  engine: 460,
  brake: 900,
  drag: 0.55,
  turnRate: 3,
  steerResponse: 12,
  grip: 11,
  driftGrip: 2.2,
} as const;

/** Arcade top-down car: heading turns first, momentum follows through grip, which creates drift. */
export class Car {
  x = 0;
  y = 0;
  heading = 0;
  vx = 0;
  vy = 0;
  steer = 0;

  constructor(pose: Pose) {
    this.reset(pose);
  }

  reset(pose: Pose): void {
    this.x = pose.x;
    this.y = pose.y;
    this.heading = pose.heading;
    this.vx = 0;
    this.vy = 0;
    this.steer = 0;
  }

  get forwardSpeed(): number {
    return this.vx * Math.cos(this.heading) + this.vy * Math.sin(this.heading);
  }

  get lateralSpeed(): number {
    return -this.vx * Math.sin(this.heading) + this.vy * Math.cos(this.heading);
  }

  step(input: CarInput, dt: number): void {
    this.steer += (clamp(input.steer, -1, 1) - this.steer) * Math.min(1, dt * CAR.steerResponse);
    const turnFactor = clamp(this.forwardSpeed / 150, -1, 1);
    this.heading += this.steer * CAR.turnRate * turnFactor * dt;

    let forward = this.forwardSpeed;
    let lateral = this.lateralSpeed;
    const throttle = clamp(input.throttle, -1, 1);
    if (throttle >= 0) forward += throttle * CAR.engine * dt;
    else forward += throttle * (forward > 0 ? CAR.brake : CAR.engine * 0.5) * dt;
    forward -= forward * CAR.drag * dt;
    forward = clamp(forward, -CAR.reverseSpeed, CAR.maxSpeed);

    const slip = clamp((Math.abs(forward) / CAR.maxSpeed) * Math.abs(this.steer), 0, 1);
    lateral *= Math.exp(-lerp(CAR.grip, CAR.driftGrip, slip * slip) * dt);

    const cos = Math.cos(this.heading);
    const sin = Math.sin(this.heading);
    this.vx = cos * forward - sin * lateral;
    this.vy = sin * forward + cos * lateral;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
}
