'use server';

import { z } from "zod";

import { signIn } from "../../auth";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  senha: z.string().min(1).max(256),
});

export type LoginActionState =
  | { success: true }
  | { success: false; message: string };

function isCredentialsSignin(error: unknown): error is { type: "CredentialsSignin" } {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "CredentialsSignin"
  );
}

export default async function loginAction(
  _prevState: LoginActionState | null,
  formData: FormData,
): Promise<LoginActionState> {
  const input = loginSchema.safeParse({
    email: formData.get("email"),
    senha: formData.get("senha"),
  });

  if (!input.success) {
    return { success: false, message: "Dados de Login Incorretos" };
  }

  try {
    // No helper server-side do Auth.js, a Promise só resolve depois que os
    // cookies da sessão foram gravados no cookie jar da resposta.
    await signIn("credentials", {
      email: input.data.email,
      senha: input.data.senha,
      redirect: false,
      redirectTo: "/PainelAlpha",
    });

    return { success: true };
  } catch (error: unknown) {
    if (isCredentialsSignin(error)) {
      return { success: false, message: "Dados de Login Incorretos" };
    }

    return {
      success: false,
      message: "Não foi possível realizar o login. Tente novamente.",
    };
  }
}
