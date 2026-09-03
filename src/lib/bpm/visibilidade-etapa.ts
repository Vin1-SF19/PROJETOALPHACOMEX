import { isAdminRole, normalizeRole } from "@/lib/roles";

export type RegraVisibilidadeEtapa = {
  perfil: string;
  podeVer: boolean;
  podeAgir: boolean;
};

export type PermissaoVisibilidadeEtapa = {
  podeVer: boolean;
  podeAgir: boolean;
  restrita: boolean;
};

/**
 * Resolve a allow-list de uma etapa sem substituir as regras de acesso ao
 * módulo e de vínculo com o card. Ausência de regras mantém o acesso legado.
 */
export function resolverVisibilidadeEtapa(
  perfil: string | null | undefined,
  regras: readonly RegraVisibilidadeEtapa[] | null | undefined,
): PermissaoVisibilidadeEtapa {
  const regrasAtivas = regras ?? [];
  if (isAdminRole(perfil)) {
    return { podeVer: true, podeAgir: true, restrita: regrasAtivas.length > 0 };
  }
  if (regrasAtivas.length === 0) {
    return { podeVer: true, podeAgir: true, restrita: false };
  }

  const perfilNormalizado = normalizeRole(perfil);
  const regra = regrasAtivas.find(
    (item) => normalizeRole(item.perfil) === perfilNormalizado,
  );
  const podeVer = Boolean(regra?.podeVer);
  return {
    podeVer,
    podeAgir: podeVer && Boolean(regra?.podeAgir),
    restrita: true,
  };
}

export function acaoBpmExigeSomenteVisualizacao(acao: string): boolean {
  return acao === "visualizar" || acao === "visualizarHistorico";
}
