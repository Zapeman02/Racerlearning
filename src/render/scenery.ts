import { Random } from '../core/random.ts';
import type { Track } from '../sim/track.ts';
import type { Theme } from './themes.ts';

export interface Prop {
  kind: 'building' | 'container' | 'tree';
  x: number;
  y: number;
  w: number;
  h: number;
  height: number;
  color: string;
  lights: number;
}

export interface Lamp {
  x: number;
  y: number;
  color: string;
}

export interface Scenery {
  props: Prop[];
  lamps: Lamp[];
}

const CELL = 150;
const MARGIN = 500;
const CLEARANCE = 40;
const LAMP_EVERY = 14;

/** Places theme props around the track without touching the asphalt. Deterministic per track + theme. */
export function generateScenery(track: Track, theme: Theme): Scenery {
  const rng = new Random(track.seed ^ hash(theme.id));
  const props: Prop[] = [];
  const { minX, minY, maxX, maxY } = track.bounds;
  for (let x = minX - MARGIN; x < maxX + MARGIN; x += CELL) {
    for (let y = minY - MARGIN; y < maxY + MARGIN; y += CELL) {
      const prop = makeProp(rng, theme, x + CELL / 2, y + CELL / 2);
      if (!prop) continue;
      const radius = Math.hypot(prop.w, prop.h) / 2;
      if (track.locate(prop, -1).distance - radius > track.width / 2 + CLEARANCE) props.push(prop);
    }
  }
  const lamps: Lamp[] = [];
  for (let i = 0; i < track.length; i += LAMP_EVERY) {
    const side = (i / LAMP_EVERY) % 2 === 0 ? track.left : track.right;
    const p = track.points[i];
    const e = side[i];
    const k = 1 + 26 / (track.width / 2);
    lamps.push({ x: p.x + (e.x - p.x) * k, y: p.y + (e.y - p.y) * k, color: theme.neon[(i / LAMP_EVERY) % theme.neon.length] });
  }
  return { props, lamps };
}

function makeProp(rng: Random, theme: Theme, cx: number, cy: number): Prop | null {
  const jitter = () => rng.range(-25, 25);
  const color = rng.pick(theme.neon);
  switch (theme.scenery) {
    case 'forest': {
      if (!rng.chance(0.75)) return null;
      const size = rng.range(50, 110);
      return { kind: 'tree', x: cx + jitter(), y: cy + jitter(), w: size, h: size, height: rng.range(0.02, 0.05), color, lights: 0 };
    }
    case 'harbor': {
      if (!rng.chance(0.6)) return null;
      const horizontal = rng.chance(0.5);
      const long = rng.range(90, 130);
      const short = rng.range(34, 44);
      return { kind: 'container', x: cx + jitter(), y: cy + jitter(), w: horizontal ? long : short, h: horizontal ? short : long, height: rng.range(0.015, 0.04), color, lights: 0 };
    }
    default: {
      if (!rng.chance(0.8)) return null;
      return { kind: 'building', x: cx + jitter(), y: cy + jitter(), w: rng.range(70, 120), h: rng.range(70, 120), height: rng.range(0.04, 0.14), color, lights: rng.int(0, 1e6) };
    }
  }
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
