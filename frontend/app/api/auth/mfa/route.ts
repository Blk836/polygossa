import { cookies } from "next/headers";
import { BRAND } from "@/lib/brand";
import { REFRESH_COOKIE, cognitoConfig, type CognitoConfig } from "@/lib/cognito";
import { confirmTotp, mfaStatus, startTotp, turnOffTotp } from "@/lib/cognito-api";
import { backendFetch } from "@/lib/server-api";
import { currentAccess } from "@/lib/session";

const fail = (status: number, message: string) => Response.json({ code: "mfa", message }, { status });

async function session(): Promise<{ config: CognitoConfig; access: string } | Response> {
  const jar = await cookies();
  const config = cognitoConfig();
  if (!config || !jar.has(REFRESH_COOKIE)) return fail(404, "Not available for this account");
  const access = await currentAccess(config, jar);
  return access ? { config, access } : fail(401, "Not signed in");
}

export async function GET() {
  const s = await session();
  if (s instanceof Response) return s;
  const status = await mfaStatus(s.config, s.access);
  return status ? Response.json(status) : fail(502, "Couldn't reach the sign-in service. Try again shortly.");
}

export async function POST(request: Request) {
  const s = await session();
  if (s instanceof Response) return s;
  const body = (await request.json().catch(() => ({}))) as { action?: string; code?: string };
  if (body.action === "start") {
    const me = (await (await backendFetch("/api/me")).json().catch(() => ({}))) as { email?: string };
    const setup = await startTotp(s.config, s.access, me.email ?? "", BRAND);
    return setup ? Response.json(setup) : fail(502, "Couldn't start setting up the app. Try again.");
  }
  if (body.action === "confirm" && typeof body.code === "string" && /^\d{6}$/.test(body.code.trim())) {
    return (await confirmTotp(s.config, s.access, body.code.trim()))
      ? Response.json({ on: true, federated: false })
      : fail(400, "That code didn't match. Check the app and try the newest code.");
  }
  return fail(400, "Enter the 6-digit code from your authenticator app");
}

export async function DELETE() {
  const s = await session();
  if (s instanceof Response) return s;
  return (await turnOffTotp(s.config, s.access))
    ? Response.json({ on: false, federated: false })
    : fail(502, "Couldn't turn it off. Try again.");
}
