export interface TimesMet {
  count: number;
  share?: number;
}

const number = (n: number) => n.toLocaleString("en-US");

export function oneIn(share: number): string {
  const n = 1 / share;
  if (n < 100) return `1 in ${number(Math.round(n))}`;
  const step = 10 ** (Math.floor(Math.log10(n)) - 1);
  return `1 in ${number(Math.round(n / step) * step)}`;
}

export function timesMetText(met: TimesMet): string {
  if (met.count === 0) return "Not met yet";
  const times = met.count === 1 ? "Met once" : `Met ${number(met.count)} times`;
  return met.share ? `${times} · ${oneIn(met.share)} words` : times;
}
