import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "qs_session";

const PROTECTED = [
  "/dashboard",
  "/enquiries",
  "/quotes",
  "/price-book",
  "/checklist",
  "/business",
  "/account",
  "/onboarding",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!needsAuth) return NextResponse.next();
  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/).*)"],
};
