import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE, cognitoConfig, globalSignOut, logoutUrl } from "@/lib/cognito";
import { BACKEND_URL } from "@/lib/server-api";
import { clearSession, keepSessionFresh } from "@/lib/session";

type Jar = Awaited<ReturnType<typeof cookies>>;

/** This session's access token, renewed first if it is about to expire; undefined when the session has ended. */
async function currentAccess(jar: Jar): Promise<string | undefined> {
  const session = await keepSessionFresh(cognitoConfig(), jar);
  if (session === "ended") return undefined;
  return session === "fresh" ? jar.get(ACCESS_COOKIE)?.value : session.access;
}

/**
 * Signs the account out on every device: the backend refuses every login token issued until now and, for a Cognito
 * session, Cognito ends all its sessions so no device can renew. This device then signs out like a normal sign-out.
 */
export async function POST() {
  const jar = await cookies();
  const access = await currentAccess(jar);
  if (!access) return Response.json({ code: "unauthorized", message: "Not signed in" }, { status: 401 });
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/me/sign-out-everywhere`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}` },
      cache: "no-store",
    });
  } catch {
    return Response.json({ code: "backend_unavailable", message: "The server is unavailable. Try again shortly." }, { status: 502 });
  }
  if (!res.ok) return Response.json(await res.json().catch(() => ({})), { status: res.status });
  const config = cognitoConfig();
  const cognito = config !== null && jar.has(REFRESH_COOKIE);
  clearSession(jar);
  if (!cognito) return new Response(null, { status: 204 });
  await globalSignOut(config, access);
  return Response.json({ redirect: logoutUrl(config) });
}
