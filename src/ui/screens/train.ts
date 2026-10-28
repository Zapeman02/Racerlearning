import { randomSeed, Random } from '../../core/random.ts';
import { Stepper, type Speed } from '../../core/stepper.ts';
import { Trainer, type GenerationStats } from '../../ai/trainer.ts';
import type { ModelRecord } from '../../data/models.ts';
import { TRAINING_TRACK } from '../../data/tracks.ts';
import { Camera, type Viewport } from '../../render/camera.ts';
import type { SceneView } from '../../render/renderer.ts';
import { REWARD_RANGE, REWARD_TERMS, type RewardKey } from '../../sim/reward.ts';
import { drawSparkline, modelMeta, segmented, sparkline } from '../components.ts';
import { h } from '../dom.ts';
import { BaseScreen } from '../screen.ts';
import { worldFor, worldOf, type World } from '../world.ts';

const SPEEDS: { value: Speed; label: string }[] = [
  { value: 1, label: '1×' },
  { value: 4, label: '4×' },
  { value: 16, label: '16×' },
  { value: 'max', label: 'MAX' },
];

const VIEWS = [
  { value: 0, label: 'Circuit' },
  { value: 1, label: 'Random 1' },
  { value: 2, label: 'Random 2' },
];

export class TrainScreen extends BaseScreen {
  private readonly training = worldFor(TRAINING_TRACK);
  private practiceWorld: World | null = null;
  private view = 0;
  private readonly camera = new Camera();
  private readonly stepper = new Stepper();
  private model: ModelRecord | null = null;
  private trainer: Trainer | null = null;
  private playing = false;
  private stats: Record<string, HTMLElement> = {};
  private chart: HTMLCanvasElement | null = null;
  private playButton: HTMLButtonElement | null = null;
  private meta: HTMLElement | null = null;

  protected build(): Node[] {
    this.model = this.pickModel();
    if (!this.model) return [this.emptyState()];
    this.startTrainer(this.model);
    return [this.panel(this.model)];
  }

  update(dt: number, view: Viewport): void {
    this.camera.fit(this.world.track.bounds, view, 24);
    if (!this.trainer || !this.playing) return;
    this.stepper.advance(dt, () => this.trainer!.tick());
    this.stats.alive.textContent = `${this.trainer.alive(this.view)}/${this.trainer.runs[this.view].length}`;
  }

  scene(): SceneView {
    const leader = this.trainer?.leader(this.view);
    const cars = (this.trainer?.runs[this.view] ?? [])
      .filter((e) => !e.done && e !== leader)
      .map((e) => ({ car: e.agent.car, color: this.model!.color, alpha: 0.35 }));
    if (leader && !leader.done) cars.push({ car: leader.agent.car, color: this.model!.color, alpha: 1 });
    return { ...this.world, camera: this.camera, cars, detail: 'low', rays: leader && !leader.done ? leader.agent : null };
  }

  /** Only the viewed track gets scenery; practice tracks change every generation. */
  private get world(): World {
    const track = this.trainer?.tracks[this.view];
    if (!track || track === this.training.track) return this.training;
    if (this.practiceWorld?.track !== track) this.practiceWorld = worldOf(track, this.training.theme);
    return this.practiceWorld;
  }

  private pickModel(): ModelRecord | null {
    const editable = this.ctx.models.all().filter((m) => !m.builtIn);
    const active = editable.find((m) => m.id === this.ctx.activeModelId) ?? editable[editable.length - 1] ?? null;
    this.ctx.activeModelId = active?.id ?? null;
    return active;
  }

  private startTrainer(model: ModelRecord): void {
    this.trainer = new Trainer(this.world.track, model.rewards, new Random(randomSeed()), model.weights ?? undefined, model.generation);
    this.onDispose(this.trainer.events.on('generation', (s) => this.onGeneration(s)));
  }

  private onGeneration(stats: GenerationStats): void {
    this.model = this.ctx.models.recordGeneration(this.model!.id, stats.bestGenome, stats.best, stats.generation, this.trainer!.rewards.weights);
    this.meta!.textContent = modelMeta(this.model);
    this.stats.generation.textContent = String(stats.generation);
    this.stats.best.textContent = String(Math.round(stats.best));
    this.stats.average.textContent = String(Math.round(stats.average));
    drawSparkline(this.chart!, this.model.history);
  }

  private emptyState(): HTMLElement {
    return h('aside', { class: 'panel', 'data-obstruct': true },
      h('h2', {}, 'No racer yet'),
      h('p', { class: 'muted' }, 'Create a racer in the garage, then come back to train it.'),
      h('button', { class: 'btn primary wide', type: 'button', onclick: () => this.ctx.go('garage') }, 'Go to garage'),
    );
  }

  private panel(model: ModelRecord): HTMLElement {
    const editable = this.ctx.models.all().filter((m) => !m.builtIn);
    const picker = h('select', { class: 'select', 'aria-label': 'Racer to train', 'data-testid': 'train-model-select' },
      ...editable.map((m) => h('option', { value: m.id, selected: m.id === model.id }, m.name)),
    );
    picker.addEventListener('change', () => {
      this.ctx.activeModelId = picker.value;
      this.playing = false;
      this.unmount();
      this.mount(this.root);
    });
    this.chart = sparkline(model.history);
    this.playButton = h('button', { class: 'btn primary play', type: 'button', 'data-testid': 'play', onclick: () => this.togglePlay() }, 'Start training');
    const stat = (key: string, label: string, value: string) =>
      h('div', { class: 'stat' }, h('span', { class: 'stat-label' }, label), (this.stats[key] = h('strong', { 'data-testid': `stat-${key}` }, value)));

    return h('aside', { class: 'panel', 'data-obstruct': true },
      h('div', { class: 'panel-head' },
        h('div', { class: 'model-chip', style: `--accent:${model.color}` }, h('span', { class: 'dot' }), picker),
        (this.meta = h('span', { class: 'meta', 'data-testid': 'train-meta' }, modelMeta(model))),
      ),
      h('div', { class: 'controls' },
        this.playButton,
        segmented(SPEEDS, this.stepper.speed, (speed) => (this.stepper.speed = speed), 'speed'),
        segmented(VIEWS, this.view, (view) => (this.view = view), 'track-view'),
      ),
      h('div', { class: 'stats' },
        stat('generation', 'Gen', String(model.generation)),
        stat('alive', 'Alive', '–'),
        stat('best', 'Best', String(model.bestFitness ?? '–')),
        stat('average', 'Avg', '–'),
      ),
      this.chart,
      h('h3', {}, 'Rewards ', h('span', { class: 'jp' }, '報酬')),
      h('div', { class: 'sliders' }, ...REWARD_TERMS.map((term) => this.slider(term.key, term.label, term.hint))),
    );
  }

  private slider(key: RewardKey, label: string, hint: string): HTMLElement {
    const weights = this.trainer!.rewards.weights;
    const output = h('output', {}, format(weights[key]));
    const input = h('input', { type: 'range', min: -REWARD_RANGE, max: REWARD_RANGE, step: 0.5, value: weights[key], 'aria-label': label, 'data-reward': key });
    const paint = () => input.style.setProperty('--fill', String((Number(input.value) + REWARD_RANGE) / (REWARD_RANGE * 2)));
    paint();
    input.addEventListener('input', () => {
      weights[key] = Number(input.value);
      output.textContent = format(weights[key]);
      output.classList.toggle('neg', weights[key] < 0);
      paint();
    });
    input.addEventListener('change', () => this.ctx.models.saveRewards(this.model!.id, weights));
    output.classList.toggle('neg', weights[key] < 0);
    return h('label', { class: 'slider' }, h('span', { class: 'slider-top' }, h('span', {}, label), output), input, h('small', {}, hint));
  }

  private togglePlay(): void {
    this.playing = !this.playing;
    this.playButton!.textContent = this.playing ? 'Pause' : 'Resume';
    this.playButton!.classList.toggle('active', this.playing);
  }
}

function format(value: number): string {
  return (value > 0 ? '+' : '') + value.toFixed(1);
}
