import { isAdminRole } from "@/lib/roles";

export const CHAMADOS_ADMIN_CHANNEL = "private-admin-chamados";
export const NOVO_CHAMADO_EVENT = "novo-chamado";
export const CHAMADO_CONCLUIDO_EVENT = "chamado-concluido";
export const CHAMADO_USUARIO_CHANNEL_PREFIX = "private-chamados-usuario-";

export interface NovoChamadoPayload {
  chamadoId: number;
  titulo: string;
  usuario: string;
  setor: string;
  urgencia: string;
  createdAt: string;
}

export interface ChamadoConcluidoPayload {
  chamadoId: number;
  titulo: string;
  solucao?: string;
  createdAt: string;
}

export function podeReceberNovosChamados(role: string | null | undefined): boolean {
  return isAdminRole(role);
}

export function canalChamadosDoUsuario(userId: number): string {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("ID de usuário inválido para o canal de chamados.");
  }
  return `${CHAMADO_USUARIO_CHANNEL_PREFIX}${userId}`;
}

export function extrairUsuarioIdDoCanalChamados(channelName: string): number | null {
  if (!channelName.startsWith(CHAMADO_USUARIO_CHANNEL_PREFIX)) return null;

  const value = channelName.slice(CHAMADO_USUARIO_CHANNEL_PREFIX.length);
  if (!/^[1-9]\d*$/.test(value)) return null;

  const userId = Number(value);
  return Number.isSafeInteger(userId) ? userId : null;
}
