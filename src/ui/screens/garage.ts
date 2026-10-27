import { isTrained, MODEL_COLORS, type ModelRecord } from '../../data/models.ts';
import { TRAINING_TRACK } from '../../data/tracks.ts';
import { parseModel, serializeModel } from '../../data/transfer.ts';
import { Camera, type Viewport } from '../../render/camera.ts';
import type { SceneView } from '../../render/renderer.ts';
import { carPreview, downloadText, modelMeta, pickFile, segmented } from '../components.ts';
import { DemoDrive } from '../demo-drive.ts';
import { h } from '../dom.ts';
import { BaseScreen } from '../screen.ts';
import { worldFor } from '../world.ts';

export class GarageScreen extends BaseScreen {
  private readonly world = worldFor(TRAINING_TRACK);
  private readonly camera = new Camera();
  private demo = new DemoDrive(this.world.track, this.ctx.models.all());
  private creating = false;
  private placed = false;

  protected build(): Node[] {
    const models = this.ctx.models.all();
    return [
      h('section', { class: 'hero' },
        h('p', { class: 'eyebrow' }, 'ニューラル・ドリフト'),
        h('h1', {}, 'Train your', h('br'), h('span', { class: 'neon' }, 'street racer')),
        h('p', { class: 'lede' }, 'Pull the reward sliders, watch your AI learn to drift, then race it against KAMI-01.'),
      ),
      h('aside', { class: 'panel', 'data-obstruct': true },
        h('div', { class: 'panel-head' },
          h('h2', {}, 'Garage'),
          h('div', { class: 'row' },
            h('button', { class: 'btn ghost small', type: 'button', onclick: () => this.importModel() }, 'Import'),
            h('button', { class: 'btn primary small', type: 'button', 'data-testid': 'new-model', onclick: () => this.toggleCreate() }, this.creating ? 'Cancel' : '+ New racer'),
          ),
        ),
        this.creating ? this.createForm() : null,
        h('div', { class: 'cards', 'data-testid': 'model-list' }, ...models.map((m) => this.card(m))),
      ),
    ];
  }

  update(dt: number, view: Viewport): void {
    this.demo.update(dt);
    const zoom = Math.min(view.width, view.height) / 1100;
    if (!this.placed) this.camera.jumpTo(this.demo.leader, zoom);
    this.placed = true;
    this.camera.follow(this.demo.leader, zoom, dt * 0.6);
  }

  scene(): SceneView {
    return { ...this.world, camera: this.camera, cars: this.demo.cars, detail: 'high' };
  }

  private card(model: ModelRecord): HTMLElement {
    const name = h('input', { class: 'name-input', value: model.name, maxlength: 24, 'aria-label': 'Model name', disabled: model.builtIn });
    name.addEventListener('change', () => {
      this.ctx.models.rename(model.id, name.value);
      this.refresh();
    });
    return h('article', { class: `card ${model.id === this.ctx.activeModelId ? 'selected' : ''}`, 'data-model': model.id, style: `--accent:${model.color}` },
      carPreview(model.color),
      h('div', { class: 'card-body' },
        h('div', { class: 'row' }, name, model.builtIn ? h('span', { class: 'tag' }, 'BASE') : null),
        h('p', { class: 'meta' }, modelMeta(model)),
        h('div', { class: 'row actions' },
          model.builtIn
            ? h('button', { class: 'btn small', type: 'button', onclick: () => this.fork(model) }, 'Fork')
            : h('button', { class: 'btn small primary', type: 'button', 'data-testid': 'train-model', onclick: () => this.train(model) }, 'Train'),
          isTrained(model) ? h('button', { class: 'btn small ghost', type: 'button', onclick: () => this.export(model) }, 'Export') : null,
          model.builtIn ? null : h('button', { class: 'btn small ghost danger', type: 'button', 'aria-label': `Delete ${model.name}`, onclick: () => this.remove(model) }, 'Delete'),
        ),
      ),
    );
  }

  private createForm(): HTMLElement {
    let color = MODEL_COLORS[this.ctx.models.all().length % MODEL_COLORS.length];
    let fromBase = false;
    const name = h('input', { class: 'text-input', placeholder: 'Name your racer', maxlength: 24, 'data-testid': 'new-name' });
    const swatches = h('div', { class: 'swatches' },
      ...MODEL_COLORS.map((c) => {
        const swatch = h('button', { class: `swatch ${c === color ? 'active' : ''}`, type: 'button', style: `--c:${c}`, 'aria-label': `Colour ${c}` });
        swatch.addEventListener('click', () => {
          color = c;
          swatches.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('active', s === swatch));
        });
        return swatch;
      }),
    );
    return h('form', { class: 'create', onsubmit: (e: Event) => {
      e.preventDefault();
      const model = this.ctx.models.create(name.value, color, fromBase);
      this.ctx.activeModelId = model.id;
      this.creating = false;
      this.ctx.go('train');
    } },
      name,
      swatches,
      segmented([{ value: 'scratch', label: 'From scratch' }, { value: 'base', label: 'Fork KAMI-01' }], 'scratch', (v) => (fromBase = v === 'base')),
      h('button', { class: 'btn primary wide', type: 'submit', 'data-testid': 'create-model' }, 'Create & train'),
    );
  }

  private toggleCreate(): void {
    this.creating = !this.creating;
    this.render();
    this.root.querySelector<HTMLInputElement>('[data-testid="new-name"]')?.focus();
  }

  private train(model: ModelRecord): void {
    this.ctx.activeModelId = model.id;
    this.ctx.go('train');
  }

  private fork(model: ModelRecord): void {
    const created = this.ctx.models.create(`${model.name} Fork`, MODEL_COLORS[this.ctx.models.all().length % MODEL_COLORS.length], true);
    this.ctx.activeModelId = created.id;
    this.ctx.toast(`Forked ${model.name}`);
    this.refresh();
  }

  private export(model: ModelRecord): void {
    downloadText(`${model.name.replace(/[^\w-]+/g, '_')}.racer.json`, serializeModel(model));
  }

  private remove(model: ModelRecord): void {
    if (!confirm(`Delete ${model.name}? This cannot be undone.`)) return;
    this.ctx.models.remove(model.id);
    if (this.ctx.activeModelId === model.id) this.ctx.activeModelId = null;
    this.refresh();
  }

  private async importModel(): Promise<void> {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      const model = this.ctx.models.add(parseModel(await file.text()));
      this.ctx.toast(`Imported ${model.name}`);
      this.refresh();
    } catch (error) {
      this.ctx.toast(error instanceof Error ? error.message : 'Import failed');
    }
  }

  private refresh(): void {
    this.demo = new DemoDrive(this.world.track, this.ctx.models.all());
    this.render();
  }
}
