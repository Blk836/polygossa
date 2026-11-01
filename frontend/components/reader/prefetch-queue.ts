export const MAX_AHEAD = 4;

export function prefetchQueue(fetch: (key: string) => Promise<unknown>, max = MAX_AHEAD) {
  const started = new Set<string>();
  let waiting: string[] = [];
  let busy = 0;

  function pump() {
    while (busy < max && waiting.length > 0) {
      const key = waiting.shift()!;
      started.add(key);
      busy++;
      void fetch(key)
        .catch(() => undefined)
        .finally(() => {
          busy--;
          pump();
        });
    }
  }

  return {
    want(keys: string[]) {
      waiting = keys.filter((k) => !started.has(k));
      pump();
    },
    clear() {
      waiting = [];
    },
  };
}
