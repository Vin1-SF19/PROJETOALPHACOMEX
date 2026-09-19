"use server";

import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { headers } from "next/headers";
import db from "@/lib/prisma";
import { Resend } from "resend";
import { hash } from "bcryptjs";
import { z } from "zod";
import { validarNovaSenha } from "@/lib/auth/password-policy";
import { hashTokenRecuperacao } from "@/lib/auth/recovery-token";
import {
  consumeAuthRateLimit,
  getAuthRequestAddress,
  normalizeAuthIdentifier,
} from "@/lib/auth/rate-limit";

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/i);
const RESPOSTA_RECUPERACAO = {
  success: true as const,
  message: "Se o e-mail estiver cadastrado, as instruções serão enviadas.",
};

function criarClienteResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY não configurada");
  return new Resend(apiKey);
}

function obterOrigemAplicacao(): string {
  const configuredUrl = process.env.APP_URL ?? process.env.AUTH_URL;
  if (!configuredUrl) throw new Error("APP_URL não configurada");

  const url = new URL(configuredUrl);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("APP_URL deve usar HTTPS em produção");
  }

  return url.origin;
}

async function enviarRecuperacaoSeExistir(email: string): Promise<void> {
  const usuario = await db.usuarios.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (!usuario) return;

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashTokenRecuperacao(token);
  const expiracao = new Date(Date.now() + 60 * 60 * 1000);

  await db.usuarios.update({
    where: { id: usuario.id },
    data: { reset_token: tokenHash, reset_expires: expiracao },
  });

  const link = new URL("/auth/RedefinirSenha", obterOrigemAplicacao());
  link.searchParams.set("token", token);

  await criarClienteResend().emails.send({
    from: process.env.AUTH_EMAIL_FROM ?? "Sistema Alpha <onboarding@resend.dev>",
    to: usuario.email,
    subject: "Recuperação de Senha - Alpha",
    html: `
      <div style="font-family: sans-serif; background: #020617; color: white; padding: 40px; border-radius: 20px;">
        <h1 style="color: #6366f1; text-transform: uppercase; font-style: italic;">Reset de Senha</h1>
        <p>Você solicitou a recuperação de acesso ao Painel Alpha.</p>
        <a href="${link.toString()}" style="background: #6366f1; color: white; padding: 15px 25px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block; margin-top: 20px;">REDEFINIR MINHA SENHA</a>
        <p style="margin-top: 30px; font-size: 12px; color: #475569;">Este link expira em 1 hora e só pode ser usado uma vez.</p>
      </div>
    `,
  });
}

export async function solicitarRecuperacao(email: string) {
  const input = emailSchema.safeParse(email);
  const identifier = normalizeAuthIdentifier(typeof email === "string" ? email : "invalid");

  try {
    const requestHeaders = await headers();
    const requestAddress = getAuthRequestAddress(requestHeaders);
    const [ipLimit, identifierLimit] = await Promise.all([
      consumeAuthRateLimit("recovery_ip", requestAddress),
      consumeAuthRateLimit("recovery_identifier", identifier || "invalid"),
    ]);
    if (!ipLimit.allowed || !identifierLimit.allowed || !input.success) {
      return RESPOSTA_RECUPERACAO;
    }
  } catch (error) {
    console.error("Falha ao aplicar limite da recuperação de senha:", error);
    return RESPOSTA_RECUPERACAO;
  }

  after(async () => {
    try {
      await enviarRecuperacaoSeExistir(input.data);
    } catch (error) {
      console.error("Falha ao processar recuperação de senha:", error);
    }
  });

  return RESPOSTA_RECUPERACAO;
}

export async function redefinirSenha(token: string, novaSenhaRaw: string) {
  try {
    const tokenValido = tokenSchema.safeParse(token);
    const senha = validarNovaSenha(novaSenhaRaw);
    if (!tokenValido.success || !senha.success) {
      return { error: senha.success ? "Token inválido ou expirado" : senha.error };
    }

    const tokenHash = hashTokenRecuperacao(tokenValido.data.toLowerCase());
    const usuario = await db.usuarios.findFirst({
      where: {
        reset_token: tokenHash,
        reset_expires: { gt: new Date() }
      },
      select: { id: true },
    });

    if (!usuario) return { error: "Token inválido ou expirado" };

    const senhaCripto = await hash(senha.password, 12);

    const updated = await db.usuarios.updateMany({
      where: {
        id: usuario.id,
        reset_token: tokenHash,
        reset_expires: { gt: new Date() },
      },
      data: {
        senha: senhaCripto,
        reset_token: null,
        reset_expires: null,
        senhaTemporaria: false,
        authSessionVersion: { increment: 1 },
      },
    });

    if (updated.count !== 1) return { error: "Token inválido ou expirado" };

    return { success: true };
  } catch (error) {
    console.error("Falha ao redefinir senha:", error);
    return { error: "Erro ao atualizar senha" };
  }
}
