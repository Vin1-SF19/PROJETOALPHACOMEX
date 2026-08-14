import { z } from "zod";

// Fase 3.5 do Cliente Master (2026-08-13) — Operacional não cadastra mais dado
// cadastral de empresa (isso agora vive só em `Cliente`), só vincula uma
// empresa já existente pelo CNPJ a uma conta de acesso do portal.
export const vincularEmpresaOperacionalSchema = z.object({
  cnpj: z.string().min(11, "CNPJ inválido").max(20),
  clienteOperacionalId: z.string().min(1, "Selecione ou cadastre um acesso de cliente"),
});
export type VincularEmpresaOperacionalInput = z.infer<typeof vincularEmpresaOperacionalSchema>;

export const cadastrarAcessoOperacionalSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do cliente").max(120),
  email: z.string().trim().email("E-mail inválido").max(180),
  senha: z.string().min(4, "Senha muito curta").max(100),
});
export type CadastrarAcessoOperacionalInput = z.infer<typeof cadastrarAcessoOperacionalSchema>;
