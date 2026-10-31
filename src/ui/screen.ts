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

  /** Rebuilds the DOM while keeping scrolled containers where they were. */
  protected render(): void {
    const scrolled = scrollPositions(this.root);
    this.root.replaceChildren(...this.build());
    for (const { path, top } of scrolled) {
      const el = elementAt(this.root, path);
      if (el) el.scrollTop = top;
    }
  }

  protected onDispose(dispose: () => void): void {
    this.disposers.push(dispose);
  }

  protected abstract build(): Node[];
  abstract update(dt: number, view: Viewport): void;
  abstract scene(): SceneView | null;
}

interface ScrollPosition {
  path: number[];
  top: number;
}

/** Scrolled elements under root, addressed by child-index path so they can be found again after a rebuild. */
function scrollPositions(root: Element): ScrollPosition[] {
  const found: ScrollPosition[] = [];
  const visit = (el: Element, path: number[]) => {
    if (el.scrollTop > 0) found.push({ path, top: el.scrollTop });
    Array.from(el.children).forEach((child, i) => visit(child, [...path, i]));
  };
  visit(root, []);
  return found;
}

function elementAt(root: Element, path: number[]): Element | undefined {
  let el: Element | undefined = root;
  for (const i of path) el = el?.children[i];
  return el;
}
