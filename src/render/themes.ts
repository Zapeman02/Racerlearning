export type SceneryKind = 'city' | 'harbor' | 'forest';

export interface Theme {
  id: string;
  name: string;
  jp: string;
  ground: string;
  grid: string;
  asphalt: string;
  neon: readonly string[];
  scenery: SceneryKind;
}

export const THEMES: readonly Theme[] = [
  { id: 'shibuya', name: 'Neo Shibuya', jp: 'ネオ渋谷', ground: '#0b0716', grid: 'rgba(255,43,214,0.07)', asphalt: '#1c1a24', neon: ['#ff2bd6', '#00f0ff', '#b14bff'], scenery: 'city' },
  { id: 'harbor', name: 'Wangan Docks', jp: '湾岸', ground: '#05121a', grid: 'rgba(0,229,199,0.06)', asphalt: '#1a1e22', neon: ['#ff7a1a', '#00e5c7', '#ffd23f'], scenery: 'harbor' },
  { id: 'touge', name: 'Hakone Touge', jp: '箱根峠', ground: '#06110a', grid: 'rgba(124,255,79,0.04)', asphalt: '#1b1d1c', neon: ['#7cff4f', '#ffe600', '#00f0ff'], scenery: 'forest' },
  { id: 'akiba', name: 'Akiba Grid', jp: '秋葉原', ground: '#05081a', grid: 'rgba(61,123,255,0.08)', asphalt: '#1a1b26', neon: ['#ffe600', '#3d7bff', '#ff3355'], scenery: 'city' },
];

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
