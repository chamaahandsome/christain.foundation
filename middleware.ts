import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Viewer surfaces are public (concept §5: wide open at the viewer level).
// Creator/admin surfaces require auth; approval gating on top of auth comes
// with the creator-gate milestone (ported HMAC-cookie pattern from Maltivas).
const isProtectedRoute = createRouteMatcher([
  "/studio(.*)", // creator dashboard
  "/admin(.*)",
  "/settings(.*)",
  "/api/studio(.*)",
  "/api/admin(.*)",
]);

const hasClerkKeys = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

// Allow the app to boot without Clerk keys (early development, CI previews):
// public pages work, protected routes 404 until auth is configured.
export default hasClerkKeys
  ? clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) {
        const { userId } = await auth();
        if (!userId) {
          if (req.nextUrl.pathname.startsWith("/api/")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
          }
          const signIn = new URL("/signin", req.url);
          signIn.searchParams.set("redirect_url", req.nextUrl.pathname);
          return NextResponse.redirect(signIn);
        }
      }
      return NextResponse.next();
    })
  : function middleware(req: Request) {
      if (isProtectedRoute(req as never)) {
        return NextResponse.json(
          { error: "Auth is not configured (missing Clerk keys)." },
          { status: 404 },
        );
      }
      return NextResponse.next();
    };

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets
    "/((?!_next|.*\\.(?:ico|png|jpg|jpeg|svg|css|js|woff2?)$).*)",
    "/(api|trpc)(.*)",
  ],
};
