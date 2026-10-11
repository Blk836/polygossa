export const MILESTONES = [100, 500, 1000, 5000];

export function reachedMilestone(before: number, after: number, seen: number[]): { show: number | null; seen: number[] } {
  const passed = MILESTONES.filter((m) => before < m && m <= after);
  const fresh = passed.filter((m) => !seen.includes(m));
  const all = [...new Set([...seen, ...MILESTONES.filter((m) => m <= after)])].sort((a, b) => a - b);
  return { show: fresh.length ? fresh[fresh.length - 1] : null, seen: all };
}

export function streakNews(current: number): { title: string; body: string } {
  const body = `Come back tomorrow to make it ${current + 1}.`;
  return { title: current > 1 ? `${current}-day streak kept` : "Streak started", body };
}

const key = (language: string) => `polly-milestones:${language}`;

export function seenMilestones(language: string): number[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key(language)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((m): m is number => typeof m === "number") : [];
  } catch {
    return [];
  }
}

export function saveSeenMilestones(language: string, seen: number[]) {
  try {
    localStorage.setItem(key(language), JSON.stringify(seen));
  } catch {}
}
