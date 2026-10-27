import { CAR } from '../sim/car.ts';

const SCALE = 4;
const PAD = 6;

export interface CarSprite {
  body: HTMLCanvasElement;
  glow: HTMLCanvasElement;
}

/** Flyweight: one pre-rendered sprite per colour, shared by every car that uses it. */
export class CarSprites {
  private readonly cache = new Map<string, CarSprite>();

  get(color: string): CarSprite {
    let sprite = this.cache.get(color);
    if (!sprite) {
      sprite = { body: drawBody(color), glow: drawGlow(color) };
      this.cache.set(color, sprite);
    }
    return sprite;
  }

  static get size() {
    return { w: CAR.length + PAD * 2, h: CAR.width + PAD * 2 };
  }
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * SCALE);
  c.height = Math.ceil(h * SCALE);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(SCALE, 0, 0, SCALE, (w / 2) * SCALE, (h / 2) * SCALE);
  return [c, ctx];
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(Math.min(255, Math.max(0, amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** Top-down JDM-style coupe pointing +x: widebody fenders, twin stripes, GT wing. */
function drawBody(color: string): HTMLCanvasElement {
  const { w, h } = CarSprites.size;
  const [c, ctx] = canvas(w, h);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 6 * SCALE;
  ctx.shadowOffsetY = 1.5 * SCALE;
  ctx.fillStyle = '#000';
  ctx.fillRect(-21, -10, 42, 20);
  ctx.restore();

  ctx.fillStyle = '#0a0a0c';
  for (const x of [13, -13]) for (const y of [-11.2, 11.2]) ctx.fillRect(x - 4.5, y - 2.2, 9, 4.4);

  const body = new Path2D();
  body.moveTo(-20, -10);
  body.lineTo(12, -10.6);
  body.quadraticCurveTo(21, -10.2, 22.5, -5);
  body.quadraticCurveTo(23.5, 0, 22.5, 5);
  body.quadraticCurveTo(21, 10.2, 12, 10.6);
  body.lineTo(-20, 10);
  body.quadraticCurveTo(-22.5, 10, -22.5, 6);
  body.lineTo(-22.5, -6);
  body.quadraticCurveTo(-22.5, -10, -20, -10);
  const paint = ctx.createLinearGradient(0, -11, 0, 11);
  paint.addColorStop(0, shade(color, -0.45));
  paint.addColorStop(0.5, shade(color, 0.25));
  paint.addColorStop(1, shade(color, -0.45));
  ctx.fillStyle = paint;
  ctx.fill(body);

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(-22, -3, 44.5, 1.5);
  ctx.fillRect(-22, 1.5, 44.5, 1.5);

  const glass = ctx.createLinearGradient(8, 0, -14, 0);
  glass.addColorStop(0, '#1b2733');
  glass.addColorStop(1, '#05080c');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.moveTo(8, -8.2);
  ctx.lineTo(8, 8.2);
  ctx.lineTo(1, 7.6);
  ctx.lineTo(-10, 7.2);
  ctx.lineTo(-14, 6.4);
  ctx.lineTo(-14, -6.4);
  ctx.lineTo(-10, -7.2);
  ctx.lineTo(1, -7.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(color, 0.1);
  ctx.fillRect(-9.5, -6.8, 10, 13.6);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(5, -7, 1.2, 14);

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(13, -5, 4, 1);
  ctx.fillRect(13, 4, 4, 1);

  ctx.fillStyle = '#e8f6ff';
  ctx.beginPath();
  ctx.moveTo(19.5, -9.2);
  ctx.lineTo(22.2, -5.2);
  ctx.lineTo(21, -4.6);
  ctx.lineTo(18.5, -8.4);
  ctx.moveTo(19.5, 9.2);
  ctx.lineTo(22.2, 5.2);
  ctx.lineTo(21, 4.6);
  ctx.lineTo(18.5, 8.4);
  ctx.fill();

  ctx.fillStyle = '#ff1e3c';
  ctx.fillRect(-22.8, -9, 1.4, 3.6);
  ctx.fillRect(-22.8, 5.4, 1.4, 3.6);

  ctx.fillStyle = '#0d0d10';
  ctx.fillRect(-21.5, -11.5, 3.4, 23);
  ctx.fillStyle = color;
  ctx.fillRect(-21.5, -11.5, 0.9, 23);

  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 0.5;
  ctx.stroke(body);
  return c;
}

function drawGlow(color: string): HTMLCanvasElement {
  const w = CAR.length * 1.9;
  const h = CAR.width * 2.6;
  const [c, ctx] = canvas(w, h);
  ctx.scale(1, h / w);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = g;
  ctx.fillRect(-w / 2, -w / 2, w, w);
  return c;
}
