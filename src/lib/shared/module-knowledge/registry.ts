import { isAdminRole } from "@/lib/roles";
import { MANUAL_ALPHA_METAS } from "./metas";
import { MANUAL_PARCEIROS } from "./parceiros";
import type { ManualModulo, ResultadoConsultaManual, TopicoManualModulo } from "./types";

export const MANUAIS_MODULOS = [MANUAL_ALPHA_METAS, MANUAL_PARCEIROS] as const;

export function normalizarTermoManual(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function corresponde(valor: string, aliases: readonly string[]): boolean {
  const normalizado = normalizarTermoManual(valor);
  return aliases.some((alias) => normalizarTermoManual(alias) === normalizado);
}

export function encontrarManualModulo(valor: string): ManualModulo | null {
  return (
    MANUAIS_MODULOS.find(
      (manual) =>
        corresponde(valor, [manual.id, manual.nome, manual.rota, ...manual.aliases]),
    ) ?? null
  );
}

function encontrarTopico(manual: ManualModulo, valor: string): TopicoManualModulo | null {
  const exato = manual.topicos.find((topico) =>
    corresponde(valor, [topico.id, topico.titulo, ...topico.aliases]),
  );
  if (exato) return exato;

  const normalizado = normalizarTermoManual(valor);
  return (
    manual.topicos.find((topico) =>
      [topico.titulo, ...topico.aliases].some((alias) => {
        const aliasNormalizado = normalizarTermoManual(alias);
        return normalizado.includes(aliasNormalizado) || aliasNormalizado.includes(normalizado);
      }),
    ) ?? null
  );
}

export function podeConsultarManualModulo(
  manual: ManualModulo,
  contexto: { role: string; permissoes: readonly string[] },
): boolean {
  if (isAdminRole(contexto.role)) return true;
  if (manual.rolesComAcesso?.includes(contexto.role)) return true;
  return contexto.permissoes.includes(manual.permissao);
}

function cabecalhoManual(manual: ManualModulo): string {
  return `# ${manual.nome}\n\nRota: ${manual.rota}\n\n${manual.resumo}`;
}

export function consultarManualModulo(modulo: string, topico?: string): ResultadoConsultaManual {
  const manual = encontrarManualModulo(modulo);
  if (!manual) {
    return {
      sucesso: false,
      erro: `Manual do módulo "${modulo}" não encontrado.`,
      sugestoes: MANUAIS_MODULOS.map((item) => item.nome),
    };
  }

  if (topico?.trim()) {
    const encontrado = encontrarTopico(manual, topico);
    if (!encontrado) {
      return {
        sucesso: false,
        erro: `Tópico "${topico}" não encontrado no manual de ${manual.nome}.`,
        sugestoes: manual.topicos.map((item) => item.titulo),
      };
    }
    return {
      sucesso: true,
      modulo: manual.nome,
      topico: encontrado.titulo,
      conteudo: `${cabecalhoManual(manual)}\n\n## ${encontrado.titulo}\n\n${encontrado.conteudo}`,
    };
  }

  return {
    sucesso: true,
    modulo: manual.nome,
    topico: null,
    conteudo: [
      cabecalhoManual(manual),
      ...manual.topicos.map((item) => `\n## ${item.titulo}\n\n${item.conteudo}`),
    ].join("\n"),
  };
}

export function listarManuaisModulos(): string {
  return MANUAIS_MODULOS.map(
    (manual) => `- **${manual.nome}** (${manual.rota}): ${manual.resumo}`,
  ).join("\n");
}
