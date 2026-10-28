import { BASE_MODEL } from '../../data/models.ts';
import { TRAINING_TRACK } from '../../data/tracks.ts';
import { Camera, type Viewport } from '../../render/camera.ts';
import type { SceneView } from '../../render/renderer.ts';
import { DemoDrive } from '../demo-drive.ts';
import { h } from '../dom.ts';
import { BaseScreen } from '../screen.ts';
import { worldFor } from '../world.ts';

const STEPS = [
  {
    jp: '見る',
    title: 'It sees',
    text: 'Your car shoots 7 invisible laser rays and measures how far it is to the edge of the road. It also knows its speed, how much it is sliding and which way the road bends ahead.',
  },
  {
    jp: '考える',
    title: 'It thinks',
    text: 'Those numbers flow through a tiny neural network: about 200 adjustable knobs called weights. Out come two decisions every frame: how to steer and how much gas to give.',
    diagram: true,
  },
  {
    jp: '目標',
    title: 'You set the goal',
    text: 'The sliders are rewards. Every frame the car earns or loses points: plus for moving forward, minus for crashing, maybe a bonus for drifting. You never drive. You decide what good driving means.',
  },
  {
    jp: '進化',
    title: 'It evolves',
    text: '40 cars with slightly different brains drive at the same time. When the round ends, the best few survive and get copied with small random changes. Repeat, and driving skill appears out of nothing. This is called neuroevolution.',
  },
  {
    jp: '勝負',
    title: 'It races',
    text: 'Your racer only practises on the training circuit. On a brand new track it has to handle corners it has never seen. KAMI-01, the base model, trained for 150 generations on hundreds of random tracks.',
  },
];

const INPUTS = ['Ray ←', 'Ray ↖', 'Ray ↑', 'Ray ↗', 'Ray →', 'Speed', 'Slide', 'Bend'];
const HIDDEN = 6;
const OUTPUTS = ['Steer', 'Gas'];

export class HowScreen extends BaseScreen {
  private readonly world = worldFor(TRAINING_TRACK);
  private readonly camera = new Camera();
  private readonly demo = new DemoDrive(this.world.track, [BASE_MODEL]);
  private placed = false;

  protected build(): Node[] {
    return [
      h('article', { class: 'how', 'data-testid': 'how' },
        h('header', { class: 'how-head' },
          h('p', { class: 'eyebrow' }, '仕組み'),
          h('h1', {}, 'How it ', h('span', { class: 'neon' }, 'works')),
          h('p', { class: 'lede' }, 'You do not drive the car. You teach it, by deciding what it gets rewarded for.'),
        ),
        h('ol', { class: 'how-steps' }, ...STEPS.map((step, i) =>
          h('li', { class: 'how-step' },
            h('div', { class: 'how-num' }, String(i + 1).padStart(2, '0'), h('span', { class: 'jp' }, step.jp)),
            h('div', {},
              h('h2', {}, step.title),
              h('p', {}, step.text),
              step.diagram ? networkDiagram() : null,
            ),
          ),
        )),
        h('aside', { class: 'how-tip' },
          h('strong', {}, 'Tip: '),
          'If your cars spin in circles or crawl, they found a loophole in your rewards. Raise Progress or punish Standing still. Real AI researchers call this reward hacking.',
        ),
        h('div', { class: 'row how-cta' },
          h('button', { class: 'btn primary', type: 'button', 'data-testid': 'how-train', onclick: () => this.ctx.go('train') }, 'Start training'),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => this.ctx.go('garage') }, 'Back to garage'),
        ),
      ),
    ];
  }

  update(dt: number, view: Viewport): void {
    this.demo.update(dt);
    const zoom = Math.min(view.width, view.height) / 1000;
    if (!this.placed) this.camera.jumpTo(this.demo.leader, zoom);
    this.placed = true;
    this.camera.follow(this.demo.leader, zoom, dt * 0.5);
  }

  scene(): SceneView {
    return { ...this.world, camera: this.camera, cars: this.demo.cars, detail: 'high' };
  }
}

/** Simplified picture of the real network (11 → 16 → 2) with signals pulsing through it. */
function networkDiagram(): HTMLElement {
  const width = 520;
  const height = 300;
  const column = (count: number, x: number) =>
    Array.from({ length: count }, (_, i) => ({ x, y: ((i + 1) * height) / (count + 1) }));
  const inputs = column(INPUTS.length, 110);
  const hidden = column(HIDDEN, 270);
  const outputs = column(OUTPUTS.length, 420);

  const edges: string[] = [];
  const link = (a: { x: number; y: number }, b: { x: number; y: number }, i: number) => {
    const lit = i % 5 === 0;
    edges.push(`<line class="edge${lit ? ' lit' : ''}" style="--d:${(i % 7) * 0.25}s" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`);
  };
  let k = 0;
  for (const a of inputs) for (const b of hidden) link(a, b, k++);
  for (const a of hidden) for (const b of outputs) link(a, b, k++);

  const node = (p: { x: number; y: number }, cls: string, r: number) => `<circle class="node ${cls}" cx="${p.x}" cy="${p.y}" r="${r}"/>`;
  const svg = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Neural network: sensor inputs feed a hidden layer that outputs steer and gas">
      ${edges.join('')}
      ${inputs.map((p) => node(p, 'in', 7)).join('')}
      ${hidden.map((p) => node(p, 'hid', 9)).join('')}
      ${outputs.map((p) => node(p, 'out', 12)).join('')}
      ${inputs.map((p, i) => `<text class="label" x="${p.x - 16}" y="${p.y + 4}" text-anchor="end">${INPUTS[i]}</text>`).join('')}
      ${outputs.map((p, i) => `<text class="label out" x="${p.x + 22}" y="${p.y + 5}">${OUTPUTS[i]}</text>`).join('')}
      <text class="caption" x="110" y="14" text-anchor="middle">SENSES</text>
      <text class="caption" x="270" y="14" text-anchor="middle">BRAIN</text>
      <text class="caption" x="420" y="14" text-anchor="middle">ACTIONS</text>
    </svg>`;
  const figure = h('figure', { class: 'diagram', 'data-testid': 'diagram' });
  figure.innerHTML = svg;
  figure.append(h('figcaption', {}, 'Simplified. The real brain has 11 inputs and 16 hidden nodes.'));
  return figure;
}
