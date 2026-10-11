export function redirectSource(domain: string): string {
  return "function handler(event) { return event.request; }" + domain.slice(0, 0);
}
