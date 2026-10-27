import type { Bounds, Vec } from '../core/math.ts';
import { Random } from '../core/random.ts';
import type { Lamp, Prop, Scenery } from './scenery.ts';
import type { Theme } from './themes.ts';

const GRID = 150;

/** Ground grid, pseudo-3D buildings/containers/trees (roofs lean away from the camera) and lamp glows. */
export class SceneryPainter {
  private readonly windows = new WeakMap<Prop, Vec[]>();
  private readonly glows = new Map<string, HTMLCanvasElement>();

  paintGround(ctx: CanvasRenderingContext2D, theme: Theme, view: Bounds, lineWidth: number): void {
    ctx.fillStyle = theme.ground;
    ctx.fillRect(view.minX, view.minY, view.maxX - view.minX, view.maxY - view.minY);
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (let x = Math.floor(view.minX / GRID) * GRID; x < view.maxX; x += GRID) {
      ctx.moveTo(x, view.minY);
      ctx.lineTo(x, view.maxY);
    }
    for (let y = Math.floor(view.minY / GRID) * GRID; y < view.maxY; y += GRID) {
      ctx.moveTo(view.minX, y);
      ctx.lineTo(view.maxX, y);
    }
    ctx.stroke();
  }

  paintProps(ctx: CanvasRenderingContext2D, scenery: Scenery, eye: Vec, view: Bounds): void {
    for (const prop of scenery.props) {
      const r = Math.max(prop.w, prop.h);
      if (prop.x + r < view.minX - 200 || prop.x - r > view.maxX + 200 || prop.y + r < view.minY - 200 || prop.y - r > view.maxY + 200) continue;
      const lean = { x: (prop.x - eye.x) * prop.height, y: (prop.y - eye.y) * prop.height };
      if (prop.kind === 'tree') this.tree(ctx, prop, lean);
      else this.block(ctx, prop, lean);
    }
  }

  paintLamps(ctx: CanvasRenderingContext2D, lamps: Lamp[]): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const lamp of lamps) ctx.drawImage(this.glow(lamp.color), lamp.x - 45, lamp.y - 45, 90, 90);
    ctx.restore();
    ctx.fillStyle = '#fff';
    for (const lamp of lamps) ctx.fillRect(lamp.x - 2.5, lamp.y - 2.5, 5, 5);
  }

  private block(ctx: CanvasRenderingContext2D, prop: Prop, lean: Vec): void {
    const x0 = prop.x - prop.w / 2;
    const y0 = prop.y - prop.h / 2;
    const corners: Vec[] = [
      { x: x0, y: y0 },
      { x: x0 + prop.w, y: y0 },
      { x: x0 + prop.w, y: y0 + prop.h },
      { x: x0, y: y0 + prop.h },
    ];
    ctx.fillStyle = prop.kind === 'container' ? shadeOf(prop.color, 0.25) : '#0e0a18';
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x + lean.x, b.y + lean.y);
      ctx.lineTo(a.x + lean.x, a.y + lean.y);
      ctx.fill();
    }
    const rx = x0 + lean.x;
    const ry = y0 + lean.y;
    ctx.fillStyle = prop.kind === 'container' ? shadeOf(prop.color, 0.45) : '#161126';
    ctx.fillRect(rx, ry, prop.w, prop.h);
    if (prop.kind === 'container') {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const horizontal = prop.w > prop.h;
      for (let k = 8; k < (horizontal ? prop.w : prop.h); k += 8) {
        if (horizontal) {
          ctx.moveTo(rx + k, ry);
          ctx.lineTo(rx + k, ry + prop.h);
        } else {
          ctx.moveTo(rx, ry + k);
          ctx.lineTo(rx + prop.w, ry + k);
        }
      }
      ctx.stroke();
      return;
    }
    ctx.fillStyle = prop.color;
    ctx.globalAlpha = 0.75;
    for (const w of this.windowsOf(prop)) ctx.fillRect(rx + w.x, ry + w.y, 5, 5);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = prop.color;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 10;
    ctx.strokeRect(rx, ry, prop.w, prop.h);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, prop.w, prop.h);
    ctx.restore();
  }

  private tree(ctx: CanvasRenderingContext2D, prop: Prop, lean: Vec): void {
    ctx.fillStyle = '#04140a';
    ctx.beginPath();
    ctx.arc(prop.x, prop.y, prop.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b2a14';
    ctx.beginPath();
    ctx.arc(prop.x + lean.x, prop.y + lean.y, prop.w / 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(124,255,79,0.08)';
    ctx.beginPath();
    ctx.arc(prop.x + lean.x * 1.3, prop.y + lean.y * 1.3, prop.w / 4, 0, Math.PI * 2);
    ctx.fill();
  }

  private windowsOf(prop: Prop): Vec[] {
    let list = this.windows.get(prop);
    if (!list) {
      const rng = new Random(prop.lights + 1);
      list = [];
      for (let x = 8; x < prop.w - 10; x += 11) for (let y = 8; y < prop.h - 10; y += 11) if (rng.chance(0.28)) list.push({ x, y });
      this.windows.set(prop, list);
    }
    return list;
  }

  private glow(color: string): HTMLCanvasElement {
    let c = this.glows.get(color);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.5;
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      this.glows.set(color, c);
    }
    return c;
  }
}

function shadeOf(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round((n >> 16) * factor)},${Math.round(((n >> 8) & 255) * factor)},${Math.round((n & 255) * factor)})`;
}
