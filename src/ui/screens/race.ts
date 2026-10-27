import { clamp } from '../../core/math.ts';
import { Stepper } from '../../core/stepper.ts';
import { BASE_MODEL_ID, isTrained } from '../../data/models.ts';
import { TRAINING_TRACK } from '../../data/tracks.ts';
import { Race, type Racer } from '../../race/race.ts';
import { Camera, type Viewport } from '../../render/camera.ts';
import { Effects } from '../../render/effects.ts';
import type { SceneView } from '../../render/renderer.ts';
import { themeById } from '../../render/themes.ts';
import { carPreview, segmented } from '../components.ts';
import { h } from '../dom.ts';
import { BaseScreen } from '../screen.ts';
import { worldFor, type World } from '../world.ts';

const MAX_RACERS = 4;

export class RaceScreen extends BaseScreen {
  private readonly camera = new Camera();
  private readonly stepper = new Stepper();
  private readonly effects = new Effects();
  private trackId = TRAINING_TRACK.id;
  private selected = new Set<string>([BASE_MODEL_ID]);
  private laps = 3;
  private race: Race | null = null;
  private world: World = worldFor(TRAINING_TRACK);
  private overview = false;
  private followId: string | null = null;
  private hud: { lap: HTMLElement; time: HTMLElement; standings: HTMLElement; countdown: HTMLElement } | null = null;

  mount(root: HTMLElement): void {
    const active = this.ctx.activeModelId ? this.ctx.models.get(this.ctx.activeModelId) : undefined;
    if (active && isTrained(active)) this.selected.add(active.id);
    super.mount(root);
  }

  protected build(): Node[] {
    this.world = worldFor(this.ctx.tracks.get(this.trackId) ?? TRAINING_TRACK);
    return this.race ? this.buildHud(this.race) : [this.buildSetup()];
  }

  update(dt: number, view: Viewport): void {
    const race = this.race;
    if (!race) {
      this.camera.fit(this.world.track.bounds, view, 24);
      return;
    }
    this.stepper.advance(dt, () => race.tick());
    this.effects.update(race.racers.map((r) => r.agent.car), dt);
    const target = this.focusRacer(race).agent.car;
    if (this.overview) this.camera.fit(this.world.track.bounds, view, 24);
    else this.camera.follow(target, clamp(Math.min(view.width, view.height) / 800, 0.8, 1.2), dt);
    this.refreshHud(race);
  }

  scene(): SceneView {
    const racers = this.race?.racers ?? [];
    return { ...this.world, camera: this.camera, cars: racers.map((r) => ({ car: r.agent.car, color: r.entry.color })), detail: 'high', effects: this.effects };
  }

  private buildSetup(): HTMLElement {
    const trained = this.ctx.models.all().filter(isTrained);
    const start = h('button', { class: 'btn primary wide big', type: 'button', 'data-testid': 'start-race', onclick: () => this.start() }, 'Start race');
    const syncStart = () => (start.disabled = this.selected.size < 1);
    syncStart();
    return h('aside', { class: 'panel', 'data-obstruct': true },
      h('div', { class: 'panel-head' }, h('h2', {}, 'Race'), h('span', { class: 'jp' }, 'レース')),
      h('h3', {}, 'Track'),
      h('div', { class: 'list compact', 'data-testid': 'race-tracks' },
        ...this.ctx.tracks.all().map((t) => {
          const theme = themeById(t.themeId);
          return h('button', { class: `list-item list-main ${t.id === this.trackId ? 'selected' : ''}`, type: 'button', style: `--accent:${theme.neon[0]}`, onclick: () => {
            this.trackId = t.id;
            this.render();
          } }, h('strong', {}, t.name), h('span', { class: 'meta' }, theme.jp));
        }),
      ),
      h('h3', {}, `Racers `, h('span', { class: 'muted' }, `up to ${MAX_RACERS}`)),
      h('div', { class: 'racer-grid', 'data-testid': 'race-racers' },
        ...trained.map((m) => {
          const chip = h('button', { class: `racer-chip ${this.selected.has(m.id) ? 'selected' : ''}`, type: 'button', style: `--accent:${m.color}`, 'aria-pressed': this.selected.has(m.id), 'data-racer': m.id },
            carPreview(m.color, 56), h('span', {}, m.name));
          chip.addEventListener('click', () => {
            if (this.selected.has(m.id)) this.selected.delete(m.id);
            else if (this.selected.size < MAX_RACERS) this.selected.add(m.id);
            else return this.ctx.toast(`Max ${MAX_RACERS} racers`);
            chip.classList.toggle('selected', this.selected.has(m.id));
            chip.setAttribute('aria-pressed', String(this.selected.has(m.id)));
            syncStart();
          });
          return chip;
        }),
      ),
      trained.length < 2 ? h('p', { class: 'muted' }, 'Train a racer to challenge KAMI-01.') : null,
      h('h3', {}, 'Laps'),
      segmented([1, 3, 5].map((n) => ({ value: n, label: String(n) })), this.laps, (n) => (this.laps = n), 'laps'),
      start,
    );
  }

  private buildHud(race: Race): Node[] {
    this.hud = {
      lap: h('strong', { 'data-testid': 'hud-lap' }),
      time: h('strong', { 'data-testid': 'hud-time' }),
      standings: h('ol', { class: 'standings', 'data-testid': 'standings' }),
      countdown: h('div', { class: 'countdown', 'aria-live': 'polite' }),
    };
    this.onDispose(race.events.on('phase', (phase) => phase === 'finished' && this.showResults(race)));
    return [
      h('div', { class: 'hud-top' },
        h('div', { class: 'hud-box' }, h('span', {}, 'LAP'), this.hud.lap),
        h('div', { class: 'hud-box' }, h('span', {}, 'TIME'), this.hud.time),
      ),
      this.hud.standings,
      this.hud.countdown,
      h('div', { class: 'hud-actions' },
        h('button', { class: 'btn ghost small', type: 'button', 'data-testid': 'camera-toggle', onclick: (e: Event) => {
          this.overview = !this.overview;
          (e.currentTarget as HTMLElement).textContent = this.overview ? 'Follow cam' : 'Overview';
        } }, 'Overview'),
        h('button', { class: 'btn ghost small', type: 'button', onclick: () => this.exit() }, 'Exit'),
      ),
    ];
  }

  private refreshHud(race: Race): void {
    if (!this.hud) return;
    const leader = race.standings()[0];
    this.hud.lap.textContent = `${race.lapOf(leader)}/${race.laps}`;
    this.hud.time.textContent = formatTime(race.time);
    this.hud.countdown.textContent = race.phase === 'countdown' ? String(Math.ceil(race.countdown)) : race.time < 0.8 ? 'GO!' : '';
    this.hud.countdown.classList.toggle('visible', race.phase === 'countdown' || race.time < 0.8);
    const rows = race.standings().map((r, i) => {
      const row = h('li', { style: `--accent:${r.entry.color}`, class: r.entry.id === this.focusRacer(race).entry.id ? 'focus' : '' },
        h('span', { class: 'pos' }, String(i + 1)), h('span', { class: 'dot' }), h('span', { class: 'who' }, r.entry.name),
        h('span', { class: 'gap' }, r.finishTime !== null ? formatTime(r.finishTime) : r.frozen > 0 ? 'CRASH' : ''));
      row.addEventListener('click', () => (this.followId = r.entry.id));
      return row;
    });
    this.hud.standings.replaceChildren(...rows);
  }

  private start(): void {
    const entries = [...this.selected].map((id) => this.ctx.models.get(id)).filter((m) => m && isTrained(m)).map((m) => ({ id: m!.id, name: m!.name, color: m!.color, weights: m!.weights! }));
    if (!entries.length) return;
    this.race = new Race(this.world.track, entries, this.laps);
    this.followId = entries.find((e) => e.id !== BASE_MODEL_ID)?.id ?? entries[0].id;
    this.effects.clear();
    this.camera.jumpTo(this.race.racers[0].agent.car, 0.8);
    this.overview = false;
    this.render();
  }

  private showResults(race: Race): void {
    const results = race.standings();
    const modal = h('div', { class: 'modal', role: 'dialog', 'aria-label': 'Results', 'data-testid': 'results' },
      h('div', { class: 'modal-card' },
        h('p', { class: 'eyebrow' }, '結果'),
        h('h2', {}, `${results[0].entry.name} wins`),
        h('ol', { class: 'results' }, ...results.map((r, i) => h('li', { style: `--accent:${r.entry.color}` },
          h('span', { class: 'pos' }, ['1st', '2nd', '3rd', '4th'][i]), carPreview(r.entry.color, 48), h('span', { class: 'who' }, r.entry.name), h('span', { class: 'gap' }, formatTime(r.finishTime ?? race.time))))),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => this.start() }, 'Rematch'),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => this.exit() }, 'New race'),
        ),
      ),
    );
    this.root.append(modal);
  }

  private exit(): void {
    this.race = null;
    this.hud = null;
    this.effects.clear();
    this.render();
  }

  private focusRacer(race: Race): Racer {
    return race.racers.find((r) => r.entry.id === this.followId) ?? race.standings()[0];
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}
