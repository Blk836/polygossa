import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TOKEN_COOKIE } from "@/lib/server-api";

export async function POST() {
  (await cookies()).delete(TOKEN_COOKIE);
  return new Response(null, { status: 204 });
}

/** Used by server components when the stored session is no longer valid. */
export async function GET() {
  (await cookies()).delete(TOKEN_COOKIE);
  redirect("/login");
}
