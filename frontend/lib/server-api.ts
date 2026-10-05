import "server-only";
import { cookies } from "next/headers";

export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";
export const TOKEN_COOKIE = "lector_token";

/** Server-side fetch to the backend with the signed-in user's token (Server Components, Route Handlers). */
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${BACKEND_URL}${path}`, { ...init, headers, cache: "no-store" });
}

/** Fetches JSON for server rendering; returns null for 401/403/404 so pages can redirect or show not-found. */
export async function backendJson<T>(path: string): Promise<T | null> {
  const res = await backendFetch(path);
  if ([401, 403, 404].includes(res.status)) return null;
  if (!res.ok) throw new Error(`Backend ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};
