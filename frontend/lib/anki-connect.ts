export const ANKI_CONNECT_URL = "http://127.0.0.1:8765";
export const ANKI_CONNECT_CODE = "2055492159";
const KEY_STORAGE = "anki-connect-key";

export class AnkiUnreachable extends Error {}

export class AnkiFailed extends Error {}

export interface AnkiCardInfo {
  cardId: number;
  deckName: string;
  modelName: string;
  fields: Record<string, { value: string; order: number }>;
  type: number;
  interval: number;
}

export type ConnectResult =
  | { kind: "granted" }
  | { kind: "needs-key" }
  | { kind: "denied" }
  | { kind: "unreachable" }
  | { kind: "outdated" };

export function savedKey(): string | null {
  try {
    return window.localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

export function saveKey(key: string | null) {
  try {
    if (key) window.localStorage.setItem(KEY_STORAGE, key);
    else window.localStorage.removeItem(KEY_STORAGE);
  } catch {
    return;
  }
}

export async function invoke<T>(action: string, params: Record<string, unknown> = {}, key = savedKey()): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      body: JSON.stringify({ action, version: 6, params, ...(key ? { key } : {}) }),
    });
  } catch {
    throw new AnkiUnreachable("Can't reach Anki");
  }
  const data = (await res.json().catch(() => null)) as { result: T; error: string | null } | null;
  if (!data) throw new AnkiUnreachable("Can't reach Anki");
  if (data.error) throw new AnkiFailed(data.error);
  return data.result;
}

export async function connect(): Promise<ConnectResult> {
  try {
    const answer = await invoke<{ permission: string; requireApikey?: boolean }>("requestPermission", {}, null);
    if (answer.permission !== "granted") return { kind: "denied" };
    if (!answer.requireApikey) return { kind: "granted" };
    return (await keyWorks(savedKey())) ? { kind: "granted" } : { kind: "needs-key" };
  } catch (e) {
    if (e instanceof AnkiFailed) return { kind: "outdated" };
    return { kind: "unreachable" };
  }
}

export async function keyWorks(key: string | null): Promise<boolean> {
  if (!key) return false;
  try {
    await invoke("version", {}, key);
    return true;
  } catch {
    return false;
  }
}

export async function deckNames(): Promise<{ id: number; name: string }[]> {
  const decks = await invoke<Record<string, number>>("deckNamesAndIds");
  return Object.entries(decks)
    .map(([name, id]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function cardIds(deckId: number): Promise<number[]> {
  return invoke<number[]>("findCards", { query: `did:${deckId}` });
}

export function cardsInfo(cards: number[]): Promise<AnkiCardInfo[]> {
  return invoke<AnkiCardInfo[]>("cardsInfo", { cards });
}

export function fieldNames(card: AnkiCardInfo): string[] {
  return Object.entries(card.fields)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([name]) => name);
}
