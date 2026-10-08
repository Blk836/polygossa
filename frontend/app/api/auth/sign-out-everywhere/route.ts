import { cookies } from "next/headers";
import { REFRESH_COOKIE, cognitoConfig, logoutUrl } from "@/lib/cognito";
import { globalSignOut } from "@/lib/cognito-api";
import { BACKEND_URL } from "@/lib/server-api";
import { clearSession, currentAccess } from "@/lib/session";

/**
 * Signs the account out on every device: the backend refuses every login token issued until now and, for a Cognito
 * session, Cognito ends all its sessions so no device can renew. This device then signs out like a normal sign-out.
 */
export async function POST() {
  const jar = await cookies();
  const access = await currentAccess(cognitoConfig(), jar);
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
