export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function browserStore(): KeyValueStore {
  try {
    return globalThis.localStorage;
  } catch {
    return memoryStore();
  }
}

export function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Persists a list of records as JSON under one key. Shared by all repositories. */
export class LocalCollection<T extends { id: string }> {
  private readonly key: string;
  private readonly store: KeyValueStore;

  constructor(key: string, store: KeyValueStore) {
    this.key = key;
    this.store = store;
  }

  all(): T[] {
    try {
      const parsed = JSON.parse(this.store.getItem(this.key) ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  get(id: string): T | undefined {
    return this.all().find((item) => item.id === id);
  }

  upsert(item: T): T {
    const items = this.all();
    const index = items.findIndex((i) => i.id === item.id);
    if (index >= 0) items[index] = item;
    else items.push(item);
    this.write(items);
    return item;
  }

  remove(id: string): void {
    this.write(this.all().filter((item) => item.id !== id));
  }

  private write(items: T[]): void {
    try {
      this.store.setItem(this.key, JSON.stringify(items));
    } catch (error) {
      console.warn('Could not save', this.key, error);
    }
  }
}

export function cleanName(name: string, fallback: string): string {
  return name.trim().slice(0, 24) || fallback;
}
