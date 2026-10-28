import type { Agent } from '../sim/agent.ts';
import type { Car } from '../sim/car.ts';
import { RAY_ANGLES } from '../sim/sensors.ts';
import type { Track } from '../sim/track.ts';
import { Camera, type Viewport } from './camera.ts';
import { CarSprites, type Paint } from './car-sprites.ts';
import type { Effects } from './effects.ts';
import { SceneryPainter } from './scenery-painter.ts';
import type { Scenery } from './scenery.ts';
import type { Theme } from './themes.ts';
import { TrackPainter } from './track-painter.ts';

export interface CarView {
  car: Car;
  paint: Paint;
  alpha?: number;
}

export interface SceneView {
  track: Track;
  theme: Theme;
  scenery: Scenery;
  camera: Camera;
  cars: CarView[];
  detail: 'low' | 'high';
  rays?: Agent | null;
  effects?: Effects;
}

/** Composes the painters into one frame. Knows nothing about game rules. */
export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly trackPainter = new TrackPainter();
  private readonly sceneryPainter = new SceneryPainter();
  private readonly sprites = new CarSprites();
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  render(scene: SceneView, view: Viewport): void {
    this.resize(view);
    const { ctx } = this;
    scene.camera.apply(ctx, view, this.dpr);
    const visible = scene.camera.visibleBounds(view);
    this.sceneryPainter.paintGround(ctx, scene.theme, visible, 1 / scene.camera.zoom);
    this.trackPainter.paint(ctx, scene.track, scene.theme);
    scene.effects?.draw(ctx);
    if (scene.rays) this.paintRays(scene.rays);
    for (const view of scene.cars) this.paintCar(view, scene.detail);
    this.sceneryPainter.paintProps(ctx, scene.scenery, scene.camera, visible);
    this.sceneryPainter.paintLamps(ctx, scene.scenery.lamps);
  }

  private resize(view: Viewport): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(view.width * this.dpr);
    const h = Math.round(view.height * this.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  private paintCar({ car, paint, alpha = 1 }: CarView, detail: 'low' | 'high'): void {
    const { ctx } = this;
    const sprite = this.sprites.get(paint);
    const { w, h } = CarSprites.size;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.heading);
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    if (detail === 'high') {
      const beam = ctx.createLinearGradient(20, 0, 170, 0);
      beam.addColorStop(0, 'rgba(230,245,255,0.22)');
      beam.addColorStop(1, 'rgba(230,245,255,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(20, -8);
      ctx.lineTo(170, -55);
      ctx.lineTo(170, 55);
      ctx.lineTo(20, 8);
      ctx.fill();
    }
    ctx.drawImage(sprite.glow, -w * 0.95, -h * 1.1, w * 1.9, h * 2.2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(sprite.body, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  private paintRays(agent: Agent): void {
    const { ctx } = this;
    const { car, sensors } = agent;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(0,240,255,0.55)';
    ctx.fillStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    RAY_ANGLES.forEach((angle, i) => {
      const a = car.heading + angle;
      ctx.moveTo(car.x, car.y);
      ctx.lineTo(car.x + Math.cos(a) * sensors.rays[i], car.y + Math.sin(a) * sensors.rays[i]);
    });
    ctx.stroke();
    RAY_ANGLES.forEach((angle, i) => {
      const a = car.heading + angle;
      ctx.beginPath();
      ctx.arc(car.x + Math.cos(a) * sensors.rays[i], car.y + Math.sin(a) * sensors.rays[i], 5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
}
