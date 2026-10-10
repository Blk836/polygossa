export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }

  get upgradeRequired() {
    return this.status === 402;
  }
}

type Body = Record<string, unknown> | unknown[] | FormData | undefined;

function encode(body: Body): { headers: Record<string, string>; payload?: BodyInit } {
  if (body instanceof FormData) return { headers: {}, payload: body };
  if (body === undefined) return { headers: {} };
  return { headers: { "Content-Type": "application/json" }, payload: JSON.stringify(body) };
}

function decode(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function toError(status: number, data: unknown): ApiError {
  const err = (data ?? {}) as { code?: string; message?: string };
  return new ApiError(status, err.code ?? "error", err.message ?? `Request failed (${status})`);
}

function redirectToLogin(path: string, status: number) {
  if (status !== 401 || typeof window === "undefined" || path.startsWith("auth/")) return;
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  throw new ApiError(401, "unauthorized", "Please sign in again");
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: Body; signal?: AbortSignal } = {},
): Promise<T> {
  const { body, signal } = options;
  const method = options.method ?? (body ? "POST" : "GET");
  const { headers, payload } = encode(body);
  const res = await fetch(`/api/${path.replace(/^\/+/, "")}`, { method, headers, body: payload, signal });
  redirectToLogin(path, res.status);
  const data = decode(await res.text());
  if (!res.ok) throw toError(res.status, data);
  return data as T;
}

export function beacon(path: string, body: Record<string, unknown>) {
  const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
  if (!navigator.sendBeacon?.(`/api/${path}`, blob)) {
    void fetch(`/api/${path}`, { method: "POST", body: blob, keepalive: true });
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}
