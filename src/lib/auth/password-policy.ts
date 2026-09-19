import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_POLICY_MESSAGE =
  `A senha deve ter entre ${PASSWORD_MIN_LENGTH} e ${PASSWORD_MAX_LENGTH} caracteres.`;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE)
  .max(PASSWORD_MAX_LENGTH, PASSWORD_POLICY_MESSAGE)
  .refine((password) => /\S/.test(password), PASSWORD_POLICY_MESSAGE);

export function validarNovaSenha(password: unknown):
  | { success: true; password: string }
  | { success: false; error: string } {
  const result = passwordSchema.safeParse(password);

  if (!result.success) {
    return { success: false, error: PASSWORD_POLICY_MESSAGE };
  }

  return { success: true, password: result.data };
}
