import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { REFRESH_COOKIE, cognitoConfig, logoutUrl, revoke } from "@/lib/cognito";
import { clearSession } from "@/lib/session";

export async function POST() {
  const jar = await cookies();
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  clearSession(jar);
  const config = cognitoConfig();
  if (!config || !refresh) return new Response(null, { status: 204 });
  await revoke(config, refresh);
  return Response.json({ redirect: logoutUrl(config) });
}

export async function GET() {
  clearSession(await cookies());
  redirect("/login");
}
