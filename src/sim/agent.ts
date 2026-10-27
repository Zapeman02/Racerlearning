import { Car, type CarInput } from './car.ts';
import { Sensors } from './sensors.ts';
import type { Track } from './track.ts';

/** Strategy: anything that can turn sensor inputs into driving commands. */
export interface Controller {
  decide(inputs: Float32Array, out: CarInput): void;
}

/** A car driven by a controller, with its position along the track tracked. */
export class Agent {
  readonly car: Car;
  readonly sensors = new Sensors();
  readonly controller: Controller;
  readonly input: CarInput = { steer: 0, throttle: 0 };
  segment: number;
  progress: number;
  lastDelta = 0;
  steerChange = 0;
  offTrack = false;
  private position: number;
  private readonly trackLength: number;

  constructor(controller: Controller, track: Track, startIndex = 0, lateral = 0) {
    this.controller = controller;
    this.car = new Car(track.poseAt(startIndex, lateral));
    this.trackLength = track.length;
    this.segment = track.wrap(startIndex);
    this.position = this.segment;
    this.progress = this.segment > track.length / 2 ? this.segment - track.length : this.segment;
  }

  get lap(): number {
    return Math.floor(this.progress / this.trackLength);
  }

  step(track: Track, dt: number): void {
    const previousSteer = this.input.steer;
    this.controller.decide(this.sensors.read(this.car, track, this.segment), this.input);
    this.steerChange = Math.abs(this.input.steer - previousSteer);
    this.car.step(this.input, dt);

    const hit = track.locate(this.car, this.segment);
    const position = hit.index + hit.t;
    this.lastDelta = track.delta(this.position, position);
    this.progress += this.lastDelta;
    this.position = position;
    this.segment = hit.index;
    this.offTrack = hit.distance > track.width / 2;
  }

  respawn(track: Track): void {
    this.car.reset(track.poseAt(this.segment));
    this.position = this.segment;
    this.offTrack = false;
  }
}
