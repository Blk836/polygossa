import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { REFRESH_COOKIE, cognitoConfig, logoutUrl, revoke } from "@/lib/cognito";
import { clearSession } from "@/lib/session";

/**
 * Signs out: clears the session here and, for a Cognito session, revokes its refresh token and answers with
 * Cognito's sign-out page for the browser to pass through (so the next sign-in asks for the password again).
 */
export async function POST() {
  const jar = await cookies();
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  clearSession(jar);
  const config = cognitoConfig();
  if (!config || !refresh) return new Response(null, { status: 204 });
  await revoke(config, refresh);
  return Response.json({ redirect: logoutUrl(config) });
}

/** Used by server components when the stored session is no longer valid. */
export async function GET() {
  clearSession(await cookies());
  redirect("/login");
}
