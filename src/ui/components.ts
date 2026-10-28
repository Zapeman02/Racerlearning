import type { ModelRecord } from '../data/models.ts';
import { CarSprites, type Paint } from '../render/car-sprites.ts';
import { h } from './dom.ts';

const sprites = new CarSprites();

export function segmented<T extends string | number>(options: { value: T; label: string }[], current: T, onChange: (value: T) => void, testId?: string): HTMLElement {
  const root = h('div', { class: 'segmented', role: 'radiogroup', 'data-testid': testId });
  for (const option of options) {
    const button = h('button', { class: option.value === current ? 'active' : '', role: 'radio', 'aria-checked': option.value === current, type: 'button' }, option.label);
    button.addEventListener('click', () => {
      root.querySelectorAll('button').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      button.classList.add('active');
      button.setAttribute('aria-checked', 'true');
      onChange(option.value);
    });
    root.append(button);
  }
  return root;
}

export function carPreview(paint: Paint, width = 76): HTMLCanvasElement {
  const { w, h: height } = CarSprites.size;
  const c = h('canvas', { class: 'car-preview', width: width * 2, height: Math.round((width * height) / w) * 2 });
  c.style.width = `${width}px`;
  const g = c.getContext('2d')!;
  g.drawImage(sprites.get(paint).glow, -c.width * 0.45, -c.height * 0.6, c.width * 1.9, c.height * 2.2);
  g.drawImage(sprites.get(paint).body, 0, 0, c.width, c.height);
  return c;
}

export function modelMeta(model: ModelRecord): string {
  if (model.generation === 0 && model.bestFitness === null) return model.weights ? 'Forked · gen 0' : 'Untrained';
  return `Gen ${model.generation} · best ${model.bestFitness ?? '–'}`;
}

export function sparkline(values: number[], width = 300, height = 64): HTMLCanvasElement {
  const c = h('canvas', { class: 'sparkline', width: width * 2, height: height * 2 });
  drawSparkline(c, values);
  return c;
}

export function drawSparkline(c: HTMLCanvasElement, values: number[]): void {
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  if (values.length < 2) return;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * c.width;
  const y = (v: number) => c.height - 6 - ((v - min) / span) * (c.height - 12);
  const fill = g.createLinearGradient(0, 0, 0, c.height);
  fill.addColorStop(0, 'rgba(255,43,214,0.35)');
  fill.addColorStop(1, 'rgba(255,43,214,0)');
  g.beginPath();
  g.moveTo(0, c.height);
  values.forEach((v, i) => g.lineTo(x(i), y(v)));
  g.lineTo(c.width, c.height);
  g.fillStyle = fill;
  g.fill();
  g.beginPath();
  values.forEach((v, i) => (i ? g.lineTo(x(i), y(v)) : g.moveTo(x(i), y(v))));
  g.strokeStyle = '#ff2bd6';
  g.lineWidth = 3;
  g.shadowColor = '#ff2bd6';
  g.shadowBlur = 10;
  g.stroke();
}

export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, class: 'hidden-input', 'data-testid': 'file-input' });
    input.addEventListener('change', () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    });
    document.body.append(input);
    input.click();
  });
}
