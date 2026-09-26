import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import { checarAcessoModuloBpm } from "@/lib/bpm/ownership";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    const response = NextResponse.redirect(new URL("/", request.url));
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  const id = Number(session?.user?.id);
  if (!Number.isInteger(id) || id <= 0 || !await checarAcessoModuloBpm(id)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const base = process.env.ALPHA_CRM_BASE_URL;
  const secret = process.env.ALPHA_BRIDGE_TOKEN;
  if (!base || !secret || secret.length < 32) return NextResponse.json({ error: "CRM independente não configurado" }, { status: 503 });
  const email = session?.user?.email?.trim().toLowerCase();
  const name = session?.user?.nome?.trim();
  if (!email || !name) return NextResponse.json({ error: "Perfil incompleto" }, { status: 422 });
  const target = new URL("/api/auth/panel", base);
  if (!["http:", "https:"].includes(target.protocol)) return NextResponse.json({ error: "URL do CRM inválida" }, { status: 503 });
  const ticket = await new SignJWT({ email, name, role: isAdminRole(session?.user?.role) ? "ADMIN" : "MEMBER" })
    .setProtectedHeader({ alg: "HS256" }).setSubject(String(id)).setIssuer("painel-alpha")
    .setAudience("alpha-crm").setIssuedAt().setExpirationTime("30s")
    .sign(new TextEncoder().encode(secret));
  target.searchParams.set("ticket", ticket);
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
