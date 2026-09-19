import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isAdminRole } from "@/lib/roles";
import {
  isPainelEmbeddedMarker,
  isPainelIframeDestination,
  isValidPainelFrameId,
  PAINEL_EMBED_HEADER,
  PAINEL_EMBED_PARAM,
  PAINEL_FRAME_ID_HEADER,
  PAINEL_FRAME_ID_PARAM,
} from "@/lib/painel-embedded";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  const token = await getToken({ 
    req, 
    secret,
    raw: false,
    cookieName: process.env.NODE_ENV === "production" 
      ? "__Secure-authjs.session-token"
      : "authjs.session-token"
  });

  const isLoggedIn = !!token && token.acessoBloqueado !== true;

  const retornandoDeBloqueio =
    req.nextUrl.searchParams.get("acesso") === "bloqueado";

  // Usuário TV: acesso exclusivo ao placar de Metas em modo TV, sem sidebar/abas do painel.
  const isRoleTV = token?.role === "TV";

  if (pathname === "/" && isLoggedIn && !retornandoDeBloqueio) {
    return NextResponse.redirect(
      new URL(isRoleTV ? "/PainelAlpha/Metas" : "/PainelAlpha", req.nextUrl)
    );
  }

  if (isRoleTV && pathname === "/PainelAlpha") {
    return NextResponse.redirect(new URL("/PainelAlpha/Metas", req.nextUrl));
  }

  if (!isLoggedIn && pathname.startsWith("/PainelAlpha")) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  const isMudarSenhaPage = pathname === "/PainelAlpha/mudar-senha";
  if (isLoggedIn && token?.senhaTemporaria === true && pathname.startsWith("/PainelAlpha") && !isMudarSenhaPage) {
    return NextResponse.redirect(new URL("/PainelAlpha/mudar-senha", req.nextUrl));
  }

  if (
    pathname.startsWith("/PainelAlpha/cadastro") &&
    !isAdminRole(typeof token?.role === "string" ? token.role : undefined)
  ) {
    return NextResponse.redirect(new URL("/PainelAlpha", req.nextUrl));
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete(PAINEL_EMBED_HEADER);
  requestHeaders.delete(PAINEL_FRAME_ID_HEADER);

  const isPainelRoute = pathname === "/PainelAlpha" || pathname.startsWith("/PainelAlpha/");
  const hasEmbeddedMarker = isPainelEmbeddedMarker(
    req.nextUrl.searchParams.get(PAINEL_EMBED_PARAM),
  );
  const isIframeNavigation = isPainelIframeDestination(req.headers.get("sec-fetch-dest"));

  if (isPainelRoute && (hasEmbeddedMarker || isIframeNavigation)) {
    requestHeaders.set(PAINEL_EMBED_HEADER, "1");

    const frameId = req.nextUrl.searchParams.get(PAINEL_FRAME_ID_PARAM);
    if (isValidPainelFrameId(frameId)) {
      requestHeaders.set(PAINEL_FRAME_ID_HEADER, frameId);
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
