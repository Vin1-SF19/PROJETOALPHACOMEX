import { isAdminRole, normalizeRole } from "@/lib/roles";
import { DIRETOR_OPERACIONAL_VITOR_ID } from "@/lib/bpm/boas-vindas";

export type AutoridadeMovimentoLivre = { tipo: "ADMIN" | "LIDER_SETOR"; setor: string | null };

/**
 * Liderança é independente da supervisão de leitura do quadro e do vínculo ao card.
 * A direção operacional reutiliza a identidade individual já cadastrada no domínio.
 * O chamador deve verificar conta ativa, permissão CRM e acesso ao pipeline.
 */
export function resolverAutoridadeMovimentoLivre(
  usuario: { id: number; role: string },
  setores: readonly { nome: string; ativo?: boolean }[],
): AutoridadeMovimentoLivre | null {
  if (isAdminRole(usuario.role)) return { tipo: "ADMIN", setor: null };
  const role = normalizeRole(usuario.role);
  const setorLiderado = role.startsWith("LIDER") ? role.slice("LIDER".length)
    : usuario.id === DIRETOR_OPERACIONAL_VITOR_ID && role === "OPERACIONAL" ? "OPERACIONAL" : null;
  if (!setorLiderado) return null;
  const setor = setores.find((item) => item.ativo !== false
    && normalizeRole(item.nome).replace(/^LIDER/, "") === setorLiderado);
  return setor ? { tipo: "LIDER_SETOR", setor: setor.nome } : null;
}
