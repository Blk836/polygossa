import type { NextRequest } from "next/server";
import { backendFetch } from "@/lib/server-api";

// Backend-for-frontend proxy: forwards /api/* to the Spring Boot API with the JWT from the httpOnly cookie, so the
// token is never exposed to browser JavaScript.

const FORWARD_REQUEST_HEADERS = ["content-type", "range", "accept"];
const FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "content-length",
  "content-disposition",
  "content-range",
  "accept-ranges",
  "cache-control",
  "last-modified",
  "etag",
];

async function proxy(request: NextRequest, ctx: RouteContext<"/api/[...path]">) {
  const { path } = await ctx.params;
  const target = `/api/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const hasBody = !["GET", "HEAD"].includes(request.method);
  let res: Response;
  try {
    res = await backendFetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
    });
  } catch {
    return Response.json({ code: "backend_unavailable", message: "The server is unavailable. Try again shortly." }, { status: 502 });
  }
  const out = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = res.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(res.body, { status: res.status, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
