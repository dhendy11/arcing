import { NextResponse } from "next/server";
import { tooManyRequests, unauthorized } from "@/server/httpErrors";
import { clientIp, loginLimiter } from "@/server/rateLimit";
import { SESSION_MAX_AGE_S, passwordAccepted, sessionSetCookie, signSession } from "@/server/session";

export async function POST(req: Request): Promise<Response> {
  if (!loginLimiter.allow(clientIp(req))) return tooManyRequests();

  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return unauthorized();
  }

  if (!passwordAccepted(password)) return unauthorized();

  const secret = process.env.SESSION_SECRET;
  if (!secret) return unauthorized();

  const token = signSession(Date.now() + SESSION_MAX_AGE_S * 1000, secret);
  const res = NextResponse.json({ ok: true });
  res.headers.set("set-cookie", sessionSetCookie(token));
  return res;
}
