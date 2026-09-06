// Small shared JSON error responses. Every route handler in src/app/api hits
// at least one of these, so one place keeps the status and body shape
// consistent instead of each handler inlining NextResponse.json calls.
import { NextResponse } from "next/server";
import type { Violation } from "@/core/validate";
import type { ArcDoc } from "@/core/types";

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export function notFound(): NextResponse {
  return NextResponse.json({ error: "not found" }, { status: 404 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function tooManyRequests(): NextResponse {
  return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
}

export function serviceUnavailable(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 503 });
}

export function conflict(doc: ArcDoc): NextResponse {
  return NextResponse.json({ error: "conflict", doc }, { status: 409 });
}

export function invalid(violations: Violation[]): NextResponse {
  return NextResponse.json({ error: "invalid", violations }, { status: 400 });
}
