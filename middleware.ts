import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isAdminRole } from "@/lib/roles";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  const token = await getToken({ 
    req, 
    secret,
    raw: false,
    cookieName: process.env.NODE_ENV === "production" 
      ? "next-auth.session-token" 
      : "next-auth.session-token"
  });

  const isLoggedIn = !!token && token.acessoBloqueado !== true;

  const retornandoDeBloqueio =
    req.nextUrl.searchParams.get("acesso") === "bloqueado";

  if (pathname === "/" && isLoggedIn && !retornandoDeBloqueio) {
    return NextResponse.redirect(new URL("/PainelAlpha", req.nextUrl));
  }

  if (!isLoggedIn && pathname.startsWith("/PainelAlpha")) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  if (
    pathname.startsWith("/PainelAlpha/cadastro") &&
    !isAdminRole(typeof token?.role === "string" ? token.role : undefined)
  ) {
    return NextResponse.redirect(new URL("/PainelAlpha", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
