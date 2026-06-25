import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadServerConfig } from "@/lib/config";
import { verifyOperatorCredentials } from "@/lib/auth/operator";
import { createOperatorSession } from "@/lib/auth/session";
import { SESSION_COOKIE, isRequestSecure, sessionCookieOptions } from "@/lib/auth/server";
import { SvixConfigError } from "@/lib/svix/errors";

const Body = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let cfg;
  try {
    cfg = loadServerConfig();
  } catch (e) {
    const message =
      e instanceof SvixConfigError ? e.message : "Server is misconfigured";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "username and password are required" },
      { status: 400 },
    );
  }

  if (!verifyOperatorCredentials(parsed.data.username, parsed.data.password, cfg)) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 },
    );
  }

  const token = createOperatorSession(parsed.data.username, cfg.sessionSecret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(isRequestSecure(req)));
  return res;
}
