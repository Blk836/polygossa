// What each page last showed, kept in this browser tab's memory so a tab you come back to shows it at once while it
// refreshes (docs/acceptance/instant-tabs.feature). Never in browser storage: a reload, a new tab or signing out
// (a full page load) starts empty.

/** A small least-recently-used map from a page's data key to the data it last showed. */
export class PageCache {
  private readonly entries = new Map<string, unknown>();

  constructor(private readonly limit: number) {}

  recall<T>(key: string): T | undefined {
    if (!this.entries.has(key)) return undefined;
    const value = this.entries.get(key) as T;
    this.entries.delete(key); // re-inserted last: the most recently used
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

/** The app's cache. Browser only: on the server this module is shared by every visitor, so it keeps nothing there. */
export const pageCache = {
  recall: <T>(key: string): T | undefined => (inBrowser() ? browserCache.recall<T>(key) : undefined),
  remember: (key: string, value: unknown) => {
    if (inBrowser()) browserCache.remember(key, value);
  },
};
