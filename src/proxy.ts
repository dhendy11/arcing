// Route protection. Next.js 16 deprecated the old `middleware.ts` file
// convention in favour of `proxy.ts`, and the rename is NOT cosmetic: under
// the old name Next 16 still compiles this file as EDGE runtime, which
// cannot load node:crypto, and src/server/session.ts needs it to verify the
// cookie HMAC. Only the `proxy.ts` name defaults to the Node.js runtime.
// This bit madori (memory/madori_project.md gotcha 8) and only a live
// request reveals it: `next build` bundles this file without executing it.
import { NextResponse, type NextRequest } from "next/server";
import { guardDecision } from "@/server/routeGuard";
import { hasValidSession } from "@/server/session";

export default function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const decision = guardDecision(pathname, hasValidSession(request));
  if (decision === "next") return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Anchored to the same boundaries guardDecision enforces. A matcher
  // excluded path never reaches the function above, so guardDecision cannot
  // reassert anything for it. Next requires a static literal here.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico$|login$|api/).*)"],
};
