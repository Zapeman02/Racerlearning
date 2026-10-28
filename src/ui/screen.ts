import type { ModelRepository } from '../data/models.ts';
import type { TrackRepository } from '../data/tracks.ts';
import type { SceneView } from '../render/renderer.ts';
import type { Viewport } from '../render/camera.ts';

export type ScreenId = 'garage' | 'train' | 'tracks' | 'race' | 'how';

export interface AppContext {
  models: ModelRepository;
  tracks: TrackRepository;
  activeModelId: string | null;
  go(screen: ScreenId): void;
  toast(message: string): void;
}

/** State pattern: the app delegates input, simulation and scene to the active screen. */
export interface Screen {
  mount(root: HTMLElement): void;
  unmount(): void;
  update(dt: number, view: Viewport): void;
  scene(): SceneView | null;
}

/** Template method: subclasses build their DOM; mounting and cleanup are shared. */
export abstract class BaseScreen implements Screen {
  protected readonly ctx: AppContext;
  protected root!: HTMLElement;
  private mounted = false;
  private readonly disposers: (() => void)[] = [];

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  mount(root: HTMLElement): void {
    this.root = root;
    this.mounted = true;
    this.render();
  }

  unmount(): void {
    if (!this.mounted) return;
    this.mounted = false;
    this.disposers.splice(0).forEach((dispose) => dispose());
    this.root.replaceChildren();
  }

  protected render(): void {
    this.root.replaceChildren(...this.build());
  }

  protected onDispose(dispose: () => void): void {
    this.disposers.push(dispose);
  }

  protected abstract build(): Node[];
  abstract update(dt: number, view: Viewport): void;
  abstract scene(): SceneView | null;
}
