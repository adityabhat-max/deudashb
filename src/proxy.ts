import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, sha256 } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/login"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return new NextResponse(
      "DASHBOARD_PASSWORD is not set. Add it in your Vercel project's Environment Variables, then redeploy.",
      { status: 500 }
    );
  }

  const expected = await sha256(password);
  const cookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (cookie === expected) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
