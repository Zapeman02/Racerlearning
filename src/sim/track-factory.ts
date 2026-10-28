import { TAU, wrapAngle, type Vec } from '../core/math.ts';
import { Random } from '../core/random.ts';
import { Track, TRACK_SPACING, TRACK_WIDTH } from './track.ts';

const BASE_RADIUS = 900;
const MAX_ATTEMPTS = 60;
const MAX_FEATURE_ATTEMPTS = 150;
const MIN_TURN_RADIUS = TRACK_WIDTH * 0.8;
const MIN_GAP = TRACK_WIDTH * 1.5;

/** Advanced generation options. `corners` is the number of control points, `sharpness` is 0 (gentle) to 1 (tight). */
export interface TrackShape {
  corners: number;
  sharpness: number;
  features?: TrackFeature[];
}

export const TRACK_FEATURES = ['straight', 'chicane', 'hairpin', 'esses', 'parabolica'] as const;
export type TrackFeature = (typeof TRACK_FEATURES)[number];

/** Each feature claims `size` of the loop and lays control points along that chord as [distance along, outward offset]. */
const FEATURE_SHAPES: Record<TrackFeature, { size: number; points: (chord: number) => [number, number][] }> = {
  straight: { size: 0.28, points: (c) => [[0, 0], [c / 3, 0], [(2 * c) / 3, 0], [c, 0]] },
  chicane: { size: 0.2, points: (c) => centered(c, [[-360, 0], [-180, 75], [0, 0], [180, -75], [360, 0]]) },
  hairpin: { size: 0.24, points: (c) => centered(c, [[-340, 0], [-170, 90], [-135, 300], [-95, 395], [0, 435], [95, 395], [135, 300], [170, 90], [340, 0]]) },
  esses: { size: 0.26, points: (c) => centered(c, [[-510, 0], [-340, 75], [-170, 0], [0, -75], [170, 0], [340, 75], [510, 0]]) },
  parabolica: { size: 0.22, points: (c) => [0, 0.2, 0.4, 0.6, 0.8, 1].map((u) => [u * c, c * 0.5 * Math.sin(Math.PI * u ** 1.4)]) },
};

function centered(chord: number, points: [number, number][]): [number, number][] {
  return [[0, 0], ...points.map(([u, v]): [number, number] => [chord / 2 + u, v]), [chord, 0]];
}

const MAX_FEATURE_SHARE = 0.55;

export const CORNER_RANGE = { min: 5, max: 18 } as const;

/** Factory: builds deterministic, valid closed tracks from a seed. */
export class TrackFactory {
  static readonly TRAINING_SEED = 1337;

  /** A random shape with up to two features, for varied practice tracks. */
  static randomShape(rng: Random): TrackShape {
    const features = Array.from({ length: rng.int(0, 3) }, () => rng.pick(TRACK_FEATURES));
    return { corners: rng.int(8, 14), sharpness: rng.range(0.3, 0.8), features: [...new Set(features)] };
  }

  static create(seed: number, shape?: TrackShape): Track {
    const attempts = shape?.features?.length ? MAX_FEATURE_ATTEMPTS : MAX_ATTEMPTS;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const points = TrackFactory.centerline(new Random(seed + attempt * 7919), shape);
      if (TrackFactory.isValid(points)) return new Track(seed, points);
    }
    return new Track(seed, TrackFactory.oval());
  }

  static isValid(points: Vec[]): boolean {
    const n = points.length;
    const angle = (i: number) => {
      const a = points[(i + n) % n];
      const b = points[(i + 1 + n) % n];
      return Math.atan2(b.y - a.y, b.x - a.x);
    };
    for (let i = 0; i < n; i++) {
      const turn = Math.abs(wrapAngle(angle(i + 2) - angle(i - 1)));
      if (turn > 0 && (3 * TRACK_SPACING) / turn < MIN_TURN_RADIUS) return false;
    }
    const neighbourhood = Math.ceil((MIN_GAP * 2) / TRACK_SPACING);
    for (let i = 0; i < n; i++) {
      for (let j = i + neighbourhood; j < n; j++) {
        if (n - (j - i) < neighbourhood) continue;
        if (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) < MIN_GAP) return false;
      }
    }
    return true;
  }

  private static centerline(rng: Random, shape?: TrackShape): Vec[] {
    const count = shape ? shape.corners : rng.int(8, 14);
    // Dense control points can't swing as far without breaking MIN_TURN_RADIUS, so the radius spread shrinks with count.
    const minRadius = shape ? 1 - (0.1 + 0.6 * shape.sharpness) * Math.min(1, (10 / count) ** 2) : 0.45;
    const stretch = rng.range(1, 1.45);
    const point = (angle: number, radius: number): Vec => ({ x: Math.cos(angle) * radius * stretch, y: Math.sin(angle) * radius });
    const corner = (angle: number, base = BASE_RADIUS, min = minRadius) => point(angle, base * rng.range(min, 1));
    const features = shape?.features ?? [];
    const control: Vec[] = [];
    if (!features.length) {
      for (let i = 0; i < count; i++) control.push(corner((i / count) * TAU + rng.range(-0.3, 0.3) * (TAU / count)));
    } else {
      const sizes = features.map((f) => FEATURE_SHAPES[f].size * TAU);
      const total = sizes.reduce((a, b) => a + b, 0);
      // Many features would crowd out the corners, so grow the loop instead and keep each feature's chord length.
      const grow = Math.max(1, total / (MAX_FEATURE_SHARE * TAU));
      const radius = BASE_RADIUS * grow;
      const gap = (TAU - total / grow) / features.length;
      const corners = Math.max(1, Math.round((count * gap) / TAU));
      let angle = rng.range(0, TAU);
      features.forEach((feature, i) => {
        const end = angle + sizes[i] / grow;
        control.push(...TrackFactory.feature(feature, point(angle, radius * 0.9), point(end, radius * 0.9)));
        for (let j = 0; j < corners; j++) control.push(corner(end + ((j + 0.5 + rng.range(-0.2, 0.2)) / corners) * gap, radius, Math.max(minRadius, 0.65)));
        angle = end + gap;
      });
    }
    const dense = features.length ? TrackFactory.centripetal(control, 32) : TrackFactory.catmullRom(control, 24);
    return TrackFactory.resample(dense, TRACK_SPACING);
  }

  private static feature(feature: TrackFeature, from: Vec, to: Vec): Vec[] {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const chord = Math.hypot(dx, dy);
    const ux = dx / chord;
    const uy = dy / chord;
    return FEATURE_SHAPES[feature].points(chord).map(([u, v]) => ({ x: from.x + ux * u + uy * v, y: from.y + uy * u - ux * v }));
  }

  private static catmullRom(control: Vec[], steps: number): Vec[] {
    const n = control.length;
    const out: Vec[] = [];
    for (let i = 0; i < n; i++) {
      const p0 = control[(i - 1 + n) % n];
      const p1 = control[i];
      const p2 = control[(i + 1) % n];
      const p3 = control[(i + 2) % n];
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        const f = (a: number, b: number, c: number, d: number) =>
          0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
      }
    }
    return out;
  }

  /** Centripetal Catmull-Rom (Barry-Goldman): no kinks where dense feature points meet sparse corners. */
  private static centripetal(control: Vec[], steps: number): Vec[] {
    const n = control.length;
    const out: Vec[] = [];
    const mix = (a: Vec, b: Vec, ta: number, tb: number, t: number): Vec => {
      const k = (t - ta) / (tb - ta);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    };
    for (let i = 0; i < n; i++) {
      const p0 = control[(i - 1 + n) % n];
      const p1 = control[i];
      const p2 = control[(i + 1) % n];
      const p3 = control[(i + 2) % n];
      const t1 = Math.sqrt(Math.hypot(p1.x - p0.x, p1.y - p0.y));
      const t2 = t1 + Math.sqrt(Math.hypot(p2.x - p1.x, p2.y - p1.y));
      const t3 = t2 + Math.sqrt(Math.hypot(p3.x - p2.x, p3.y - p2.y));
      for (let s = 0; s < steps; s++) {
        const t = t1 + ((t2 - t1) * s) / steps;
        const b1 = mix(mix(p0, p1, 0, t1, t), mix(p1, p2, t1, t2, t), 0, t2, t);
        const b2 = mix(mix(p1, p2, t1, t2, t), mix(p2, p3, t2, t3, t), t1, t3, t);
        out.push(mix(b1, b2, t1, t2, t));
      }
    }
    return out;
  }

  private static resample(dense: Vec[], spacing: number): Vec[] {
    const closed = [...dense, dense[0]];
    const out: Vec[] = [dense[0]];
    let carry = 0;
    for (let i = 1; i < closed.length; i++) {
      const a = closed[i - 1];
      const b = closed[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      let d = spacing - carry;
      while (d <= len) {
        out.push({ x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len });
        d += spacing;
      }
      carry = len - (d - spacing);
    }
    const last = out[out.length - 1];
    if (Math.hypot(last.x - out[0].x, last.y - out[0].y) < spacing * 0.5) out.pop();
    return out;
  }

  private static oval(): Vec[] {
    const points: Vec[] = [];
    const count = Math.round((TAU * BASE_RADIUS) / TRACK_SPACING);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      points.push({ x: Math.cos(a) * BASE_RADIUS * 1.3, y: Math.sin(a) * BASE_RADIUS * 0.8 });
    }
    return points;
  }
}
