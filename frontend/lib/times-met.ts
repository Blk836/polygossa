export interface TimesMet {
  count: number;
  share: number;
}

export function sharePercent(share: number): string {
  const percent = share * 100;
  if (percent >= 0.1) return `${percent.toFixed(1).replace(/\.0$/, "")}%`;
  if (percent >= 0.01) return `${percent.toFixed(2)}%`;
  return "<0.01%";
}

export function timesMetText(met: TimesMet): string {
  if (met.count === 0) return "Not met yet";
  return `${met.count.toLocaleString("en-US")}× · ${sharePercent(met.share)}`;
}
