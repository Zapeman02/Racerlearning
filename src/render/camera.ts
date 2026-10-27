import type { Bounds, Vec } from '../core/math.ts';

export interface Viewport {
  width: number;
  height: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;

  /** Centre of the unobstructed part of the screen, in screen pixels. */
  static focus(view: Viewport): Vec {
    return { x: view.left + (view.width - view.left - view.right) / 2, y: view.top + (view.height - view.top - view.bottom) / 2 };
  }

  fit(bounds: Bounds, view: Viewport, padding = 40): void {
    const w = Math.max(1, view.width - view.left - view.right - padding * 2);
    const h = Math.max(1, view.height - view.top - view.bottom - padding * 2);
    this.zoom = Math.min(w / (bounds.maxX - bounds.minX), h / (bounds.maxY - bounds.minY));
    this.x = (bounds.minX + bounds.maxX) / 2;
    this.y = (bounds.minY + bounds.maxY) / 2;
  }

  follow(target: Vec, zoom: number, dt: number): void {
    const k = 1 - Math.exp(-dt * 4);
    this.x += (target.x - this.x) * k;
    this.y += (target.y - this.y) * k;
    this.zoom += (zoom - this.zoom) * k;
  }

  jumpTo(target: Vec, zoom: number): void {
    this.x = target.x;
    this.y = target.y;
    this.zoom = zoom;
  }

  apply(ctx: CanvasRenderingContext2D, view: Viewport, dpr: number): void {
    const f = Camera.focus(view);
    const s = this.zoom * dpr;
    ctx.setTransform(s, 0, 0, s, (f.x - this.x * this.zoom) * dpr, (f.y - this.y * this.zoom) * dpr);
  }

  visibleBounds(view: Viewport): Bounds {
    const f = Camera.focus(view);
    return {
      minX: this.x - f.x / this.zoom,
      minY: this.y - f.y / this.zoom,
      maxX: this.x + (view.width - f.x) / this.zoom,
      maxY: this.y + (view.height - f.y) / this.zoom,
    };
  }
}
