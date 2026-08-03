import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

/**
 * RBAC granular por categoria de ação dentro do módulo de Comissões — substitui a
 * checagem hardcoded `ROLES_TEMPORARIAMENTE_PERMITIDOS` (role inteira) nos 12 arquivos de
 * Server Actions. 33 funções reais foram agrupadas em 6 categorias funcionais (decisão do
 * usuário, não granularidade por função individual).
 *
 * Fallback (decisão do usuário): um usuário FINANCEIRO sem NENHUMA linha em
 * `CommissionPermission` mantém acesso total (comportamento idêntico ao pré-RBAC) — a
 * restrição só passa a valer depois que um Admin configura explicitamente ao menos uma
 * categoria para aquele usuário. Isso evita quebrar quem já usa o módulo sem aviso.
 */
export type CategoriaPermissao = "VISUALIZAR" | "SINCRONIZAR" | "PAGAR" | "APROVAR" | "CONFIGURAR" | "EXPORTAR";

export const CATEGORIAS_PERMISSAO: CategoriaPermissao[] = [
  "VISUALIZAR",
  "SINCRONIZAR",
  "PAGAR",
  "APROVAR",
  "CONFIGURAR",
  "EXPORTAR",
];

export const CATEGORIA_LABEL: Record<CategoriaPermissao, string> = {
  VISUALIZAR: "Visualizar (listar eventos, ver detalhes, divergências)",
  SINCRONIZAR: "Sincronizar (importar dados do CS&NPS/Metas)",
  PAGAR: "Pagar (registrar/programar/estornar pagamento, ajuste manual)",
  APROVAR: "Aprovar (eventos, exceções, versões de regra)",
  CONFIGURAR: "Configurar (cargos, tarifários, regras, feriados, exceções)",
  EXPORTAR: "Exportar (gerar espelhos PDF/Excel)",
};

const ROLES_COM_ACESSO_BASE = ["FINANCEIRO"];

export interface AcessoCategoriaResult {
  ok: boolean;
  userId?: number;
  error?: string;
}

/**
 * Verifica se o usuário da sessão pode executar uma ação da categoria informada.
 * Admin/CEO sempre têm acesso total (bypass, mesmo padrão já usado em todo o painel).
 * FINANCEIRO (ou outra role autorizada à base do módulo): acesso liberado por padrão,
 * a menos que exista uma linha explícita em `CommissionPermission` para (userId, categoria)
 * com `permitido: false`.
 */
export async function verificarAcessoCategoria(
  userId: number,
  role: string,
  categoria: CategoriaPermissao,
): Promise<AcessoCategoriaResult> {
  if (isAdminRole(role)) {
    return { ok: true, userId };
  }

  if (!ROLES_COM_ACESSO_BASE.includes(role)) {
    return { ok: false, error: "Sem permissão" };
  }

  const override = await db.commissionPermission.findUnique({
    where: { userId_categoria: { userId, categoria } },
  });

  if (override && !override.permitido) {
    return { ok: false, error: `Sem permissão para: ${CATEGORIA_LABEL[categoria]}` };
  }

  return { ok: true, userId };
}
