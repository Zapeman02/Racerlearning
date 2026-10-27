import type { Car } from '../sim/car.ts';

interface Skid {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

const MAX_SKIDS = 2400;
const MAX_PARTICLES = 220;
const REAR = -13;
const TRACK_HALF = 9;

/** Tyre marks and drift smoke, driven by how much each car slides. */
export class Effects {
  private readonly skids: Skid[] = [];
  private readonly particles: Particle[] = [];
  private readonly wheels = new Map<Car, [number, number, number, number]>();

  update(cars: Car[], dt: number): void {
    for (const car of cars) this.trackCar(car);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += dt * 26;
      p.life -= dt;
    }
    while (this.particles.length && this.particles[0].life <= 0) this.particles.shift();
  }

  clear(): void {
    this.skids.length = 0;
    this.particles.length = 0;
    this.wheels.clear();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = 'rgba(5,5,8,0.55)';
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const s of this.skids) {
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }
    ctx.stroke();
    for (const p of this.particles) {
      ctx.fillStyle = `rgba(210,205,230,${Math.max(0, p.life) * 0.22})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private trackCar(car: Car): void {
    const cos = Math.cos(car.heading);
    const sin = Math.sin(car.heading);
    const wheel = (side: number): [number, number] => [car.x + cos * REAR - sin * side, car.y + sin * REAR + cos * side];
    const [lx, ly] = wheel(-TRACK_HALF);
    const [rx, ry] = wheel(TRACK_HALF);
    const previous = this.wheels.get(car);
    this.wheels.set(car, [lx, ly, rx, ry]);
    const sliding = Math.abs(car.lateralSpeed) > 70 && car.forwardSpeed > 120;
    if (!previous || !sliding) return;
    this.skids.push({ x1: previous[0], y1: previous[1], x2: lx, y2: ly }, { x1: previous[2], y1: previous[3], x2: rx, y2: ry });
    if (this.skids.length > MAX_SKIDS) this.skids.splice(0, this.skids.length - MAX_SKIDS);
    if (this.particles.length < MAX_PARTICLES && Math.random() < 0.5) {
      this.particles.push({ x: (lx + rx) / 2, y: (ly + ry) / 2, vx: (Math.random() - 0.5) * 40 - car.vx * 0.1, vy: (Math.random() - 0.5) * 40 - car.vy * 0.1, life: 1, size: 6 });
    }
  }
}
