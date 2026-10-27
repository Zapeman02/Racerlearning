import { boundsOf, type Bounds, type Pose, type Vec } from '../core/math.ts';

export const TRACK_WIDTH = 120;
export const TRACK_SPACING = 16;

export interface TrackHit {
  index: number;
  t: number;
  distance: number;
}

export class Track {
  readonly seed: number;
  readonly width: number;
  readonly points: Vec[];
  readonly left: Vec[];
  readonly right: Vec[];
  readonly angles: number[];
  readonly bounds: Bounds;

  constructor(seed: number, points: Vec[], width = TRACK_WIDTH) {
    this.seed = seed;
    this.width = width;
    this.points = points;
    const n = points.length;
    this.angles = points.map((p, i) => {
      const next = points[(i + 1) % n];
      return Math.atan2(next.y - p.y, next.x - p.x);
    });
    this.left = [];
    this.right = [];
    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n];
      const next = points[(i + 1) % n];
      const len = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
      const nx = -(next.y - prev.y) / len;
      const ny = (next.x - prev.x) / len;
      const half = width / 2;
      this.left.push({ x: points[i].x + nx * half, y: points[i].y + ny * half });
      this.right.push({ x: points[i].x - nx * half, y: points[i].y - ny * half });
    }
    this.bounds = boundsOf([...this.left, ...this.right]);
  }

  get length(): number {
    return this.points.length;
  }

  wrap(index: number): number {
    const n = this.points.length;
    return ((index % n) + n) % n;
  }

  /** Nearest point on the centerline. hint < 0 searches the whole track. */
  locate(p: Vec, hint = -1, window = 12): TrackHit {
    const from = hint < 0 ? 0 : hint - window;
    const to = hint < 0 ? this.length - 1 : hint + window;
    let best: TrackHit = { index: 0, t: 0, distance: Infinity };
    for (let k = from; k <= to; k++) {
      const i = this.wrap(k);
      const a = this.points[i];
      const b = this.points[this.wrap(i + 1)];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
      const d = Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
      if (d < best.distance) best = { index: i, t, distance: d };
    }
    return best;
  }

  /** Distance along a ray to the nearest track edge, capped at maxLength. */
  raycast(origin: Vec, angle: number, maxLength: number, hint: number): number {
    const rx = Math.cos(angle);
    const ry = Math.sin(angle);
    const window = Math.ceil(maxLength / TRACK_SPACING) + 4;
    let best = maxLength;
    for (const edge of [this.left, this.right]) {
      for (let k = hint - window; k <= hint + window; k++) {
        const a = edge[this.wrap(k)];
        const b = edge[this.wrap(k + 1)];
        const sx = b.x - a.x;
        const sy = b.y - a.y;
        const denom = rx * sy - ry * sx;
        if (Math.abs(denom) < 1e-9) continue;
        const qx = a.x - origin.x;
        const qy = a.y - origin.y;
        const s = (qx * sy - qy * sx) / denom;
        const u = (qx * ry - qy * rx) / denom;
        if (s >= 0 && s < best && u >= 0 && u <= 1) best = s;
      }
    }
    return best;
  }

  /** Signed shortest difference between two positions along the track. */
  delta(from: number, to: number): number {
    const n = this.length;
    let d = to - from;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  }

  poseAt(index: number, lateral = 0): Pose {
    const i = this.wrap(index);
    const heading = this.angles[i];
    const p = this.points[i];
    return { x: p.x - Math.sin(heading) * lateral, y: p.y + Math.cos(heading) * lateral, heading };
  }
}
