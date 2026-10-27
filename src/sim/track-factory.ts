import { TAU, wrapAngle, type Vec } from '../core/math.ts';
import { Random } from '../core/random.ts';
import { Track, TRACK_SPACING, TRACK_WIDTH } from './track.ts';

const BASE_RADIUS = 900;
const MAX_ATTEMPTS = 60;
const MIN_TURN_RADIUS = TRACK_WIDTH * 0.8;
const MIN_GAP = TRACK_WIDTH * 1.5;

/** Factory: builds deterministic, valid closed tracks from a seed. */
export class TrackFactory {
  static readonly TRAINING_SEED = 1337;

  static create(seed: number): Track {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const points = TrackFactory.centerline(new Random(seed + attempt * 7919));
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

  private static centerline(rng: Random): Vec[] {
    const count = rng.int(8, 14);
    const stretch = rng.range(1, 1.45);
    const control: Vec[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * TAU + rng.range(-0.3, 0.3) * (TAU / count);
      const radius = BASE_RADIUS * rng.range(0.45, 1);
      control.push({ x: Math.cos(angle) * radius * stretch, y: Math.sin(angle) * radius });
    }
    return TrackFactory.resample(TrackFactory.catmullRom(control, 24), TRACK_SPACING);
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
