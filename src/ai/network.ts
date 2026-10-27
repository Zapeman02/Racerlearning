import type { Random } from '../core/random.ts';
import type { CarInput } from '../sim/car.ts';
import type { Controller } from '../sim/agent.ts';
import { INPUT_SIZE } from '../sim/sensors.ts';

const HIDDEN = 16;
const OUTPUTS = 2;

/** Tiny MLP: inputs -> tanh hidden layer -> tanh outputs (steer, throttle). */
export class NeuralNetwork {
  static readonly weightCount = INPUT_SIZE * HIDDEN + HIDDEN + HIDDEN * OUTPUTS + OUTPUTS;

  readonly weights: Float32Array;
  private readonly hidden = new Float32Array(HIDDEN);

  constructor(weights: ArrayLike<number>) {
    if (weights.length !== NeuralNetwork.weightCount) {
      throw new Error(`Expected ${NeuralNetwork.weightCount} weights, got ${weights.length}`);
    }
    this.weights = Float32Array.from(weights);
  }

  static random(rng: Random): NeuralNetwork {
    const weights = new Float32Array(NeuralNetwork.weightCount);
    for (let i = 0; i < weights.length; i++) weights[i] = rng.gaussian() * 0.5;
    return new NeuralNetwork(weights);
  }

  forward(inputs: Float32Array, out: Float32Array): void {
    const w = this.weights;
    let k = 0;
    for (let h = 0; h < HIDDEN; h++) {
      let sum = 0;
      for (let i = 0; i < INPUT_SIZE; i++) sum += inputs[i] * w[k++];
      this.hidden[h] = Math.tanh(sum + w[k++]);
    }
    for (let o = 0; o < OUTPUTS; o++) {
      let sum = 0;
      for (let h = 0; h < HIDDEN; h++) sum += this.hidden[h] * w[k++];
      out[o] = Math.tanh(sum + w[k++]);
    }
  }
}

export class NeuralController implements Controller {
  private readonly network: NeuralNetwork;
  private readonly output = new Float32Array(OUTPUTS);

  constructor(network: NeuralNetwork) {
    this.network = network;
  }

  decide(inputs: Float32Array, out: CarInput): void {
    this.network.forward(inputs, this.output);
    out.steer = this.output[0];
    out.throttle = this.output[1];
  }
}

export function controllerFor(weights: ArrayLike<number>): NeuralController {
  return new NeuralController(new NeuralNetwork(weights));
}
