import { z } from "zod";

export const ROLES_CONHECIDOS = [
  "Admin",
  "CEO",
  "TI",
  "User",
  "RECURSOS HUMANOS",
  "FINANCEIRO",
  "Lider Comercial",
  "SUPORTE",
] as const;

function protocoloPermitido(valor: string): boolean {
  try {
    const protocolo = new URL(valor).protocol;
    return protocolo === "http:" || protocolo === "https:";
  } catch {
    return false;
  }
}

export const LinkExternoSchema = z.object({
  label: z.string().trim().min(1, "Nome obrigatório").max(60, "Máximo 60 caracteres"),
  url: z
    .string()
    .trim()
    .url("URL inválida")
    .refine(protocoloPermitido, "A URL deve usar http:// ou https://"),
  iconName: z.string().trim().min(1, "Ícone obrigatório"),
  visivelPara: z
    .string()
    .trim()
    .min(1)
    .refine(
      (valor) =>
        valor === "TODOS" ||
        valor.split(",").every((role) => (ROLES_CONHECIDOS as readonly string[]).includes(role.trim())),
      "Visibilidade inválida",
    ),
});

export type LinkExternoInput = z.input<typeof LinkExternoSchema>;
