import { z } from "zod";
import { isAdminRole, isSameRole } from "@/lib/roles";
import { resolverVisibilidadeEtapa, type RegraVisibilidadeEtapa } from "@/lib/bpm/visibilidade-etapa";

export const regraAcessoPipelineSchema = z.object({
  tipo: z.enum(["SETOR", "USUARIO"]),
  id: z.number().int().positive(),
  nivel: z.enum(["PADRAO", "ADMINISTRATIVO"]),
}).strict();
export const regrasAcessoPipelineSchema = z.array(regraAcessoPipelineSchema).max(300).superRefine((regras, ctx) => {
  if (new Set(regras.map((regra) => `${regra.tipo}:${regra.id}`)).size !== regras.length) {
    ctx.addIssue({ code: "custom", message: "Cada setor ou usuário deve aparecer apenas uma vez." });
  }
  if (regras.filter((regra) => regra.tipo === "SETOR").length > 100
    || regras.filter((regra) => regra.tipo === "USUARIO").length > 200) {
    ctx.addIssue({ code: "custom", message: "Limite de setores ou usuários excedido." });
  }
});
export type RegraAcessoPipeline = z.infer<typeof regraAcessoPipelineSchema>;
export type NivelAcessoPipeline = RegraAcessoPipeline["nivel"];
export type SetorAcessoPipeline = { id?: number; nome: string; ativo?: boolean };
export type EntradaAcessoPipeline = {
  usuarioId: number;
  role: string;
  setoresPipeline: readonly SetorAcessoPipeline[];
  visualizacaoConfigJson?: string | null;
};
export type AutoridadeMovimentoLivre = { tipo: "ADMIN" | "ADMIN_PIPELINE"; setor: null };

const configuracaoSchema = z.object({ version: z.literal(2), regras: regrasAcessoPipelineSchema }).strict();

function lerRaiz(json?: string | null): Record<string, unknown> {
  if (json == null) return {};
  const valor: unknown = JSON.parse(json);
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw new Error("Configuração de acesso inválida");
  return Object.fromEntries(Object.entries(valor));
}

/** Identifica pipelines ainda não publicados no novo modelo e antes abertos a todo o CRM. */
export function possuiAcessoAnteriorAberto(json: string | null | undefined, setores: readonly SetorAcessoPipeline[]): boolean {
  try { return setores.length === 0 && !("permissoesPipeline" in lerRaiz(json)); }
  catch { return false; }
}

/** Converte somente concessões de entrada já persistidas; supervisão nunca concede administração. */
export function lerRegrasAcessoPipeline(json: string | null | undefined, setores: readonly SetorAcessoPipeline[]): RegraAcessoPipeline[] {
  try {
    const raiz = lerRaiz(json);
    if ("permissoesPipeline" in raiz) {
      const result = configuracaoSchema.safeParse(raiz.permissoesPipeline);
      return result.success ? result.data.regras : [];
    }
    const regras: RegraAcessoPipeline[] = setores.filter((setor) => setor.id != null && setor.ativo !== false)
      .map((setor) => ({ tipo: "SETOR", id: Number(setor.id), nivel: "PADRAO" }));
    const usuarios = z.array(z.number().int().positive()).max(200).safeParse(raiz.usuariosAutorizados);
    if (raiz.version === 1 && usuarios.success) {
      regras.push(...[...new Set(usuarios.data)].map((id): RegraAcessoPipeline => ({ tipo: "USUARIO", id, nivel: "PADRAO" })));
    }
    return regras;
  } catch { return []; }
}

/** Substitui a política de acesso e elimina suas chaves antigas, preservando configurações de negócio. */
export function gravarRegrasAcessoPipeline(json: string | null | undefined, regras: RegraAcessoPipeline[]): string {
  const raiz = lerRaiz(json);
  delete raiz.version;
  delete raiz.supervisores;
  delete raiz.usuariosAutorizados;
  return JSON.stringify({ ...raiz, permissoesPipeline: configuracaoSchema.parse({ version: 2, regras }) });
}

export function resolverNivelAcessoPipeline(entrada: EntradaAcessoPipeline): NivelAcessoPipeline | null {
  if (isAdminRole(entrada.role)) return "ADMINISTRATIVO";
  try {
    const raiz = lerRaiz(entrada.visualizacaoConfigJson);
    // Relações anteriores continuam dando acesso padrão até sua primeira publicação.
    // Configurações novas usam exclusivamente as regras explícitas abaixo.
    if (!("permissoesPipeline" in raiz)) {
      if (entrada.setoresPipeline.length === 0
        || entrada.setoresPipeline.some((setor) => setor.ativo !== false && isSameRole(setor.nome, entrada.role))) return "PADRAO";
    }
    const aplicaveis = lerRegrasAcessoPipeline(entrada.visualizacaoConfigJson, entrada.setoresPipeline).filter((regra) =>
      regra.tipo === "USUARIO" ? regra.id === entrada.usuarioId
        : entrada.setoresPipeline.some((setor) => setor.id === regra.id && setor.ativo !== false && isSameRole(setor.nome, entrada.role)));
    if (aplicaveis.some((regra) => regra.nivel === "ADMINISTRATIVO")) return "ADMINISTRATIVO";
    return aplicaveis.length ? "PADRAO" : null;
  } catch { return null; }
}

/** O chamador exige conta ativa, permissão CRM e pipeline ativo antes de usar a autoridade. */
export function resolverAutoridadeAdministrativaPipeline(entrada: EntradaAcessoPipeline): AutoridadeMovimentoLivre | null {
  if (resolverNivelAcessoPipeline(entrada) !== "ADMINISTRATIVO") return null;
  return { tipo: isAdminRole(entrada.role) ? "ADMIN" : "ADMIN_PIPELINE", setor: null };
}

/** Filtro comum das consultas agregadas: entrada no funil antes da visibilidade da coluna. */
export function podeVerEtapaPipeline(entrada: EntradaAcessoPipeline, regras: readonly RegraVisibilidadeEtapa[]): boolean {
  const nivel = resolverNivelAcessoPipeline(entrada);
  return nivel !== null && (nivel === "ADMINISTRATIVO" || resolverVisibilidadeEtapa(entrada.role, regras).podeVer);
}
