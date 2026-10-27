import type { Track } from '../sim/track.ts';
import type { Theme } from './themes.ts';

const CURB_WIDTH = 9;
const CURB_STRIPE = 2;

interface TrackPaths {
  asphalt: Path2D;
  edges: Path2D;
  center: Path2D;
  curbRed: Path2D;
  curbWhite: Path2D;
  start: { dark: Path2D; light: Path2D };
}

/** Draws asphalt, red/white curbs, neon edge glow and the start grid. Paths are cached per track. */
export class TrackPainter {
  private readonly cache = new WeakMap<Track, TrackPaths>();
  private noise: CanvasPattern | null = null;

  paint(ctx: CanvasRenderingContext2D, track: Track, theme: Theme): void {
    const p = this.paths(track);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = theme.neon[0];
    ctx.globalAlpha = 0.14;
    ctx.lineWidth = 34;
    ctx.stroke(p.edges);
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 3;
    ctx.stroke(p.edges);
    ctx.restore();

    ctx.fillStyle = theme.asphalt;
    ctx.fill(p.asphalt, 'evenodd');
    ctx.fillStyle = this.pattern(ctx) ?? theme.asphalt;
    ctx.fill(p.asphalt, 'evenodd');

    ctx.fillStyle = '#e8222f';
    ctx.fill(p.curbRed);
    ctx.fillStyle = '#f2f2f2';
    ctx.fill(p.curbWhite);

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([22, 26]);
    ctx.stroke(p.center);
    ctx.restore();

    ctx.fillStyle = '#111';
    ctx.fill(p.start.dark);
    ctx.fillStyle = '#f5f5f5';
    ctx.fill(p.start.light);
  }

  private paths(track: Track): TrackPaths {
    let paths = this.cache.get(track);
    if (!paths) {
      paths = buildPaths(track);
      this.cache.set(track, paths);
    }
    return paths;
  }

  private pattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
    if (!this.noise) {
      const c = document.createElement('canvas');
      c.width = c.height = 96;
      const n = c.getContext('2d')!;
      for (let i = 0; i < 1400; i++) {
        const v = Math.random() < 0.5 ? 255 : 0;
        n.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.07})`;
        n.fillRect(Math.random() * 96, Math.random() * 96, 1.5, 1.5);
      }
      this.noise = ctx.createPattern(c, 'repeat');
    }
    return this.noise;
  }
}

function loop(path: Path2D, points: { x: number; y: number }[]): void {
  path.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) path.lineTo(points[i].x, points[i].y);
  path.closePath();
}

function buildPaths(track: Track): TrackPaths {
  const asphalt = new Path2D();
  loop(asphalt, track.left);
  loop(asphalt, track.right);
  const edges = new Path2D();
  loop(edges, track.left);
  loop(edges, track.right);
  const center = new Path2D();
  loop(center, track.points);

  const curbRed = new Path2D();
  const curbWhite = new Path2D();
  const inset = CURB_WIDTH / (track.width / 2);
  for (const edge of [track.left, track.right]) {
    for (let i = 0; i < track.length; i++) {
      const j = track.wrap(i + 1);
      const inner = (k: number) => ({
        x: edge[k].x + (track.points[k].x - edge[k].x) * inset,
        y: edge[k].y + (track.points[k].y - edge[k].y) * inset,
      });
      const a = inner(i);
      const b = inner(j);
      const path = Math.floor(i / CURB_STRIPE) % 2 === 0 ? curbRed : curbWhite;
      path.moveTo(edge[i].x, edge[i].y);
      path.lineTo(edge[j].x, edge[j].y);
      path.lineTo(b.x, b.y);
      path.lineTo(a.x, a.y);
      path.closePath();
    }
  }
  return { asphalt, edges, center, curbRed, curbWhite, start: startLine(track) };
}

function startLine(track: Track): { dark: Path2D; light: Path2D } {
  const dark = new Path2D();
  const light = new Path2D();
  const { x, y, heading } = track.poseAt(0);
  const cols = 10;
  const size = (track.width - CURB_WIDTH * 2) / cols;
  const fx = Math.cos(heading);
  const fy = Math.sin(heading);
  const nx = -fy;
  const ny = fx;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < cols; col++) {
      const along = (row - 1) * size;
      const side = -track.width / 2 + CURB_WIDTH + col * size;
      const cx = x + fx * along + nx * side;
      const cy = y + fy * along + ny * side;
      const path = (row + col) % 2 === 0 ? dark : light;
      path.moveTo(cx, cy);
      path.lineTo(cx + fx * size, cy + fy * size);
      path.lineTo(cx + fx * size + nx * size, cy + fy * size + ny * size);
      path.lineTo(cx + nx * size, cy + ny * size);
      path.closePath();
    }
  }
  return { dark, light };
}
