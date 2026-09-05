"use server"
import crypto 

from "crypto";
import db from "@/lib/prisma";
import { Resend } from 'resend';
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

function criarClienteResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY não configurada");
  return new Resend(apiKey);
}
const BASE_URL = "https://painel-alpha-projeto.vercel.app";

export async function solicitarRecuperacao(email: string) {
  try {
    const usuario = await db.usuarios.findUnique({ where: { email } });
    if (!usuario) return { error: "E-mail não encontrado" };

    const token = crypto.randomBytes(32).toString("hex");
    const expiracao = new Date(Date.now() + 3600000);

    await db.usuarios.update({
      where: { email },
      data: { reset_token: token, reset_expires: expiracao }
    });

    const link = `${BASE_URL}/auth/redefinir-senha?token=${token}`;

    await criarClienteResend().emails.send({
      from: 'Sistema Alpha <onboarding@resend.dev>',
      to: email,
      subject: 'Recuperação de Senha - Alpha',
      html: `
        <div style="font-family: sans-serif; background: #020617; color: white; padding: 40px; border-radius: 20px;">
          <h1 style="color: #6366f1; text-transform: uppercase; font-style: italic;">Reset de Senha</h1>
          <p>Você solicitou a recuperação de acesso ao Painel Alpha.</p>
          <a href="${link}" style="background: #6366f1; color: white; padding: 15px 25px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block; margin-top: 20px;">REDEFINIR MINHA SENHA</a>
          <p style="margin-top: 30px; font-size: 12px; color: #475569;">Este link expira em 1 hora.</p>
        </div>
      `
    });

    return { success: true };
  } catch (error) {
    return { error: "Falha ao enviar e-mail" };
  }
}

export async function redefinirSenha(token: string, novaSenhaRaw: string) {
  try {
    const usuario = await db.usuarios.findFirst({
      where: {
        reset_token: token,
        reset_expires: { gt: new Date() }
      }
    });

    if (!usuario) return { error: "Token inválido ou expirado" };

    const senhaCripto = await bcrypt.hash(novaSenhaRaw, 10);

    await db.usuarios.update({
      where: { id: usuario.id },
      data: {
        senha: senhaCripto,
        reset_token: null,
        reset_expires: null
      }
    });

    return { success: true };
  } catch (error) {
    return { error: "Erro ao atualizar senha" };
  }
}
