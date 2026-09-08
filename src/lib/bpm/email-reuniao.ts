import { z } from "zod";

export const emailClienteReuniaoSchema = z
  .string()
  .trim()
  .min(1, "Informe o e-mail do cliente")
  .email("Informe um e-mail válido")
  .max(320, "O e-mail deve ter no máximo 320 caracteres")
  .transform((email) => email.toLowerCase());

interface VinculoEmailReuniao {
  ativo: boolean;
  principal: boolean;
  pessoa: { email: string | null };
}

function emailsValidosUnicos(vinculos: VinculoEmailReuniao[]): string[] {
  const emails = vinculos.flatMap(({ pessoa }) => {
    const resultado = emailClienteReuniaoSchema.safeParse(pessoa.email);
    return resultado.success ? [resultado.data] : [];
  });
  return Array.from(new Set(emails));
}

/**
 * Evita escolher uma pessoa arbitrariamente: prioriza um único destinatário
 * principal e só usa o conjunto geral quando não existe principal válido.
 */
export function selecionarEmailClienteReuniao(vinculos: VinculoEmailReuniao[]): string | null {
  const ativos = vinculos.filter((vinculo) => vinculo.ativo);
  const principais = emailsValidosUnicos(ativos.filter((vinculo) => vinculo.principal));
  if (principais.length === 1) return principais[0];
  if (principais.length > 1) return null;

  const todos = emailsValidosUnicos(ativos);
  return todos.length === 1 ? todos[0] : null;
}

/** Mantém os convidados existentes e inclui o cliente uma única vez. */
export function combinarParticipantesReuniao(
  existentes: Array<{ email: string }>,
  emailCliente: string,
): string[] {
  const candidatos = [...existentes.map(({ email }) => email), emailCliente];
  return Array.from(new Set(candidatos.flatMap((email) => {
    const resultado = emailClienteReuniaoSchema.safeParse(email);
    return resultado.success ? [resultado.data] : [];
  })));
}
