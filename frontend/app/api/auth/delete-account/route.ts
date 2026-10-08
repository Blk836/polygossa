import { cookies } from "next/headers";
import { REFRESH_COOKIE, cognitoConfig, logoutUrl } from "@/lib/cognito";
import { deleteCognitoUser } from "@/lib/cognito-api";
import { BACKEND_URL } from "@/lib/server-api";
import { clearSession, currentAccess } from "@/lib/session";

/**
 * Deletes the account (docs/acceptance/gdpr.feature): the backend removes all of its data first; then, for a
 * Cognito session, the user is deleted from the pool too. This device then signs out like a normal sign-out.
 */
export async function POST(request: Request) {
  const jar = await cookies();
  const config = cognitoConfig();
  const access = await currentAccess(config, jar);
  if (!access) return Response.json({ code: "unauthorized", message: "Not signed in" }, { status: 401 });
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/api/me`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: await request.text(),
      cache: "no-store",
    });
  } catch {
    return Response.json({ code: "backend_unavailable", message: "The server is unavailable. Try again shortly." }, { status: 502 });
  }
  if (!res.ok) return Response.json(await res.json().catch(() => ({})), { status: res.status });
  const cognito = config !== null && jar.has(REFRESH_COOKIE);
  clearSession(jar);
  if (!cognito) return new Response(null, { status: 204 });
  // The account's data is already gone; a pool user left behind would only get a new, empty account.
  await deleteCognitoUser(config, access);
  return Response.json({ redirect: logoutUrl(config) });
}
