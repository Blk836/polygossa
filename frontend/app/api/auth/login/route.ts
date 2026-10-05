import { authenticate } from "../session";

export async function POST(request: Request) {
  return authenticate(request, "/api/auth/login");
}
