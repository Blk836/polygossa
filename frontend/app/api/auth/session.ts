import { cookies } from "next/headers";
import { BACKEND_URL, TOKEN_COOKIE, cookieOptions } from "@/lib/server-api";

/** Forwards a login/signup to the backend and stores the returned JWT in an httpOnly cookie. */
export async function authenticate(request: Request, backendPath: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${backendPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
      cache: "no-store",
    });
  } catch {
    return Response.json({ code: "backend_unavailable", message: "The server is unavailable. Try again shortly." }, { status: 502 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return Response.json(data, { status: res.status });
  (await cookies()).set(TOKEN_COOKIE, data.token, cookieOptions);
  return Response.json(data.user, { status: res.status });
}
