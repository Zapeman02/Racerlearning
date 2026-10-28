import { ModelRepository } from '../data/models.ts';
import { TrackRepository } from '../data/tracks.ts';
import type { KeyValueStore } from '../data/storage.ts';
import type { Viewport } from '../render/camera.ts';
import { Renderer } from '../render/renderer.ts';
import { h } from './dom.ts';
import type { AppContext, Screen, ScreenId } from './screen.ts';
import { GarageScreen } from './screens/garage.ts';
import { HowScreen } from './screens/how.ts';
import { RaceScreen } from './screens/race.ts';
import { TrainScreen } from './screens/train.ts';
import { TracksScreen } from './screens/tracks.ts';

const NAV: { id: ScreenId; label: string; jp: string }[] = [
  { id: 'garage', label: 'Garage', jp: 'ガレージ' },
  { id: 'train', label: 'Train', jp: '訓練' },
  { id: 'tracks', label: 'Tracks', jp: 'コース' },
  { id: 'race', label: 'Race', jp: 'レース' },
];

/** Owns the frame loop and switches between screens (State pattern context). */
export class App {
  private readonly renderer: Renderer;
  private readonly context: AppContext;
  private readonly screens: Record<ScreenId, Screen>;
  private readonly content: HTMLElement;
  private readonly nav: HTMLElement;
  private readonly toastEl: HTMLElement;
  private current: Screen;
  private last = performance.now();
  private toastTimer = 0;

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement, store: KeyValueStore) {
    this.renderer = new Renderer(canvas);
    this.context = {
      models: new ModelRepository(store),
      tracks: new TrackRepository(store),
      activeModelId: null,
      go: (id) => this.go(id),
      toast: (message) => this.toast(message),
    };
    this.screens = {
      garage: new GarageScreen(this.context),
      train: new TrainScreen(this.context),
      tracks: new TracksScreen(this.context),
      race: new RaceScreen(this.context),
      how: new HowScreen(this.context),
    };
    this.nav = h('nav', { class: 'tabs', 'data-obstruct': true, 'aria-label': 'Main' },
      ...NAV.map((item) => h('button', { type: 'button', 'data-screen': item.id, onclick: () => this.go(item.id) }, h('span', { class: 'tab-jp' }, item.jp), h('span', {}, item.label))),
    );
    this.content = h('main', { class: 'screen' });
    this.toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    ui.append(
      h('header', { class: 'topbar', 'data-obstruct': true },
        h('div', { class: 'logo' }, h('span', { class: 'logo-mark' }, 'R'), h('span', {}, 'RACER', h('em', {}, 'LEARNING'))),
        h('button', { class: 'how-btn', type: 'button', 'data-screen': 'how', 'aria-label': 'How it works', onclick: () => this.go('how') }, h('span', { class: 'how-icon' }, '?'), h('span', { class: 'how-label' }, 'How it works')),
      ),
      this.nav,
      this.content,
      this.toastEl,
    );
    this.current = this.screens.garage;
    this.go('garage');
    requestAnimationFrame((t) => this.frame(t));
  }

  go(id: ScreenId): void {
    this.current.unmount();
    this.current = this.screens[id];
    document.querySelectorAll<HTMLElement>('#ui [data-screen]').forEach((b) => b.classList.toggle('active', b.dataset.screen === id));
    document.body.dataset.screen = id;
    this.current.mount(this.content);
  }

  private frame(time: number): void {
    const dt = Math.min((time - this.last) / 1000, 0.1);
    this.last = time;
    const view = this.viewport();
    this.current.update(dt, view);
    const scene = this.current.scene();
    if (scene) this.renderer.render(scene, view);
    requestAnimationFrame((t) => this.frame(t));
  }

  /** Screen area not covered by UI, so the camera centres the track in the free space. */
  private viewport(): Viewport {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const view: Viewport = { width, height, left: 0, top: 0, right: 0, bottom: 0 };
    document.querySelectorAll<HTMLElement>('[data-obstruct]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const horizontal = r.width > width * 0.8 || r.height < height * 0.25;
      if (horizontal && r.top + r.height / 2 < height / 2) view.top = Math.max(view.top, r.bottom);
      else if (horizontal) view.bottom = Math.max(view.bottom, height - r.top);
      else if (r.left + r.width / 2 > width / 2) view.right = Math.max(view.right, width - r.left);
      else view.left = Math.max(view.left, r.right);
    });
    return view;
  }

  private toast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('visible'), 2400);
  }
}
