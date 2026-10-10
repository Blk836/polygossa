export class PageCache {
  private readonly entries = new Map<string, unknown>();

  constructor(private readonly limit: number) {}

  recall<T>(key: string): T | undefined {
    if (!this.entries.has(key)) return undefined;
    const value = this.entries.get(key) as T;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  remember(key: string, value: unknown) {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value!);
  }
}

const browserCache = new PageCache(50);
const inBrowser = () => typeof window !== "undefined";

export const pageCache = {
  recall: <T>(key: string): T | undefined => (inBrowser() ? browserCache.recall<T>(key) : undefined),
  remember: (key: string, value: unknown) => {
    if (inBrowser()) browserCache.remember(key, value);
  },
};
