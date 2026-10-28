import { randomSeed } from '../../core/random.ts';
import { BASE_MODEL } from '../../data/models.ts';
import { TRAINING_TRACK, type TrackRecord } from '../../data/tracks.ts';
import { Camera, type Viewport } from '../../render/camera.ts';
import type { SceneView } from '../../render/renderer.ts';
import { THEMES, themeById } from '../../render/themes.ts';
import { CORNER_RANGE, TRACK_FEATURES, type TrackFeature, type TrackShape } from '../../sim/track-factory.ts';
import { parseTrack, serializeTrack } from '../../data/transfer.ts';
import { downloadText, pickFile, segmented } from '../components.ts';
import { DemoDrive } from '../demo-drive.ts';
import { h } from '../dom.ts';
import { BaseScreen } from '../screen.ts';
import { worldFor } from '../world.ts';

const FEATURE_LABELS: Record<TrackFeature, string> = {
  straight: 'Long straight',
  chicane: 'Chicane',
  hairpin: 'Hairpin',
  esses: 'Esses',
  parabolica: 'Parabolica',
};

type Preview = Pick<TrackRecord, 'seed' | 'themeId' | 'shape'> & { id?: string };

export class TracksScreen extends BaseScreen {
  private readonly camera = new Camera();
  private preview: Preview = TRAINING_TRACK;
  private themeId = THEMES[1].id;
  private advanced = false;
  private readonly shape: TrackShape = { corners: 10, sharpness: 0.5 };
  private readonly features = new Set<TrackFeature>();
  private demo = this.demoFor(this.preview);

  protected build(): Node[] {
    const unsaved = !this.preview.id;
    return [
      h('aside', { class: 'panel', 'data-obstruct': true },
        h('div', { class: 'panel-head' },
          h('h2', {}, 'Tracks ', h('span', { class: 'jp' }, 'コース')),
          h('button', { class: 'btn ghost small', type: 'button', 'data-testid': 'import-track', onclick: () => this.importTrack() }, 'Import'),
        ),
        h('h3', {}, 'Generate'),
        segmented(THEMES.map((t) => ({ value: t.id, label: t.name })), this.themeId, (id) => (this.themeId = id), 'theme'),
        this.advancedForm(),
        h('button', { class: 'btn primary wide', type: 'button', 'data-testid': 'generate', onclick: () => this.generate() }, 'Generate new track'),
        unsaved ? this.saveForm() : null,
        h('h3', {}, 'Saved'),
        h('div', { class: 'list', 'data-testid': 'track-list' }, ...this.ctx.tracks.all().map((t) => this.item(t))),
      ),
    ];
  }

  update(dt: number, view: Viewport): void {
    this.camera.fit(worldFor(this.preview).track.bounds, view, 24);
    this.demo.update(dt);
  }

  scene(): SceneView {
    return { ...worldFor(this.preview), camera: this.camera, cars: this.demo.cars, detail: 'high' };
  }

  private item(track: TrackRecord): HTMLElement {
    const theme = themeById(track.themeId);
    return h('div', { class: `list-item ${track.id === this.preview.id ? 'selected' : ''}`, style: `--accent:${theme.neon[0]}`, 'data-track': track.id },
      h('button', { class: 'list-main', type: 'button', onclick: () => this.show(track) },
        h('strong', {}, track.name),
        h('span', { class: 'meta' }, `${theme.jp} · ${theme.name}`),
      ),
      h('button', { class: 'btn small ghost', type: 'button', 'aria-label': `Export ${track.name}`, onclick: () => this.export(track) }, 'Export'),
      track.builtIn ? h('span', { class: 'tag' }, 'TRAINING') : h('button', { class: 'btn small ghost danger', type: 'button', 'aria-label': `Delete ${track.name}`, onclick: () => this.remove(track) }, 'Delete'),
    );
  }

  private advancedForm(): HTMLElement {
    const toggle = h('input', { type: 'checkbox', checked: this.advanced, 'data-testid': 'advanced' });
    const sliders = h('div', { class: 'sliders', hidden: !this.advanced },
      this.slider('Corners', 'Fewer ← → more', CORNER_RANGE.min, CORNER_RANGE.max, 1, 'corners'),
      this.slider('Sharpness', 'Gentle ← → tight', 0, 1, 0.05, 'sharpness'),
      h('div', { class: 'chips', 'data-testid': 'features' }, ...TRACK_FEATURES.map((f) => this.chip(f))),
    );
    toggle.addEventListener('change', () => {
      this.advanced = toggle.checked;
      sliders.hidden = !this.advanced;
    });
    return h('div', { class: 'advanced' }, h('label', { class: 'check' }, toggle, 'Advanced mode'), sliders);
  }

  private chip(feature: TrackFeature): HTMLElement {
    const on = () => this.features.has(feature);
    const button = h('button', { class: `chip ${on() ? 'active' : ''}`, type: 'button', 'aria-pressed': on(), 'data-feature': feature }, FEATURE_LABELS[feature]);
    button.addEventListener('click', () => {
      if (on()) this.features.delete(feature);
      else this.features.add(feature);
      button.classList.toggle('active', on());
      button.setAttribute('aria-pressed', String(on()));
    });
    return button;
  }

  private slider(label: string, hint: string, min: number, max: number, step: number, key: 'corners' | 'sharpness'): HTMLElement {
    const format = () => (key === 'corners' ? String(this.shape.corners) : `${Math.round(this.shape.sharpness * 100)}%`);
    const output = h('output', {}, format());
    const input = h('input', { type: 'range', class: 'fill', min, max, step, value: this.shape[key], 'aria-label': label, 'data-shape': key });
    const paint = () => input.style.setProperty('--fill', String((Number(input.value) - min) / (max - min)));
    paint();
    input.addEventListener('input', () => {
      this.shape[key] = Number(input.value);
      output.textContent = format();
      paint();
    });
    return h('label', { class: 'slider' }, h('span', { class: 'slider-top' }, h('span', {}, label), output), input, h('small', {}, hint));
  }

  private saveForm(): HTMLElement {
    const name = h('input', { class: 'text-input', placeholder: 'Name this track', maxlength: 24, 'data-testid': 'track-name' });
    return h('form', { class: 'create', onsubmit: (e: Event) => {
      e.preventDefault();
      const saved = this.ctx.tracks.create(name.value, this.preview.seed, this.preview.themeId, this.preview.shape);
      this.ctx.toast(`Saved ${saved.name}`);
      this.preview = saved;
      this.render();
    } },
      h('p', { class: 'muted' }, 'Like it? Save it to race on later.'),
      h('div', { class: 'row' }, name, h('button', { class: 'btn primary', type: 'submit', 'data-testid': 'save-track' }, 'Save')),
    );
  }

  private generate(): void {
    this.show({ seed: randomSeed(), themeId: this.themeId, ...(this.advanced && { shape: { ...this.shape, features: TRACK_FEATURES.filter((f) => this.features.has(f)) } }) });
  }

  private show(preview: Preview): void {
    this.preview = preview;
    this.demo = this.demoFor(preview);
    this.render();
  }

  private remove(track: TrackRecord): void {
    if (!confirm(`Delete ${track.name}?`)) return;
    this.ctx.tracks.remove(track.id);
    if (this.preview.id === track.id) this.show(TRAINING_TRACK);
    else this.render();
  }

  private export(track: TrackRecord): void {
    downloadText(`${track.name.replace(/[^\w-]+/g, '_')}.track.json`, serializeTrack(track));
  }

  private async importTrack(): Promise<void> {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      const track = this.ctx.tracks.add(parseTrack(await file.text()));
      this.ctx.toast(`Imported ${track.name}`);
      this.show(track);
    } catch (error) {
      this.ctx.toast(error instanceof Error ? error.message : 'Import failed');
    }
  }

  private demoFor(preview: Preview): DemoDrive {
    return new DemoDrive(worldFor(preview).track, [BASE_MODEL]);
  }
}
