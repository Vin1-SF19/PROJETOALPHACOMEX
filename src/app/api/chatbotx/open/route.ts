import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

const chatbotxUrl =
  process.env.CHATBOTX_URL ??
  "https://gateway-production-3365.up.railway.app";

function errorPage(message: string, status: number) {
  return new NextResponse(
    `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Não foi possível entrar</title>
    <style>
      :root { color-scheme: light; font-family: Arial, sans-serif; }
      body { margin: 0; padding: 32px; background: #f8fafc; color: #0f172a; }
      main { max-width: 560px; margin: 0 auto; padding: 24px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; }
      h1 { margin: 0 0 12px; font-size: 20px; }
      p { margin: 0; line-height: 1.5; color: #475569; }
    </style>
  </head>
  <body>
    <main>
      <h1>Não foi possível entrar no ChatbotX</h1>
      <p>${message}</p>
    </main>
  </body>
</html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

async function userCanOpenChatbotx(session: Awaited<ReturnType<typeof auth>>) {
  if (!session?.user) return false;
  if (isAdminRole(session.user.role ?? "")) return true;

  const userId = Number(session.user.id ?? 0);
  if (!Number.isInteger(userId) || userId <= 0) return false;

  try {
    const permissions = await getPermissoesEfetivas(userId);
    return permissions.includes("builder");
  } catch {
    return false;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return errorPage("Sua sessão do Painel Alpha não está ativa.", 401);
  }

  if (!(await userCanOpenChatbotx(session))) {
    return errorPage("Você não tem permissão para acessar este módulo.", 403);
  }

  const secret = process.env.ALPHA_SSO_SECRET;
  if (!secret) {
    return errorPage("O login do ChatbotX ainda não foi configurado no Painel Alpha.", 503);
  }

  const email = session.user.email?.trim().toLowerCase();
  const userId = session.user.id?.trim();
  const role = session.user.role?.trim();
  if (!email || !userId || !role) {
    return errorPage("Não foi possível identificar o usuário autenticado.", 500);
  }

  const assertion = await new SignJWT({ email, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("painel-alpha")
    .setAudience("chatbotx")
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(new TextEncoder().encode(secret));

  let response: Response;
  try {
    response = await fetch(`${chatbotxUrl}/api/auth/alpha-sso/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assertion }),
      cache: "no-store",
    });
  } catch {
    return errorPage("Não foi possível conectar ao ChatbotX. Tente novamente.", 502);
  }

  if (!response.ok) {
    if (response.status === 404) {
      return errorPage(
        "Este usuário ainda não possui uma conta no ChatbotX. Entre em contato com um administrador para solicitar a criação do usuário.",
        404,
      );
    }

    return errorPage("O ChatbotX recusou a autenticação SSO. Tente novamente.", 502);
  }

  const result = (await response.json()) as { loginUrl?: string };
  if (!result.loginUrl) {
    return errorPage("O ChatbotX não retornou uma URL de login.", 502);
  }

  return NextResponse.redirect(result.loginUrl, 303);
}
