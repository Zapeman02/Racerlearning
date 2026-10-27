import './style.css';
import { browserStore } from './data/storage.ts';
import { App } from './ui/app.ts';

new App(document.querySelector<HTMLCanvasElement>('#world')!, document.querySelector<HTMLElement>('#ui')!, browserStore());
