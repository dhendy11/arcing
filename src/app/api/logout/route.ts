import { NextResponse } from "next/server";
import { sessionClearCookie } from "@/server/session";

export async function POST(): Promise<Response> {
  const res = NextResponse.json({ ok: true });
  res.headers.set("set-cookie", sessionClearCookie());
  return res;
}
