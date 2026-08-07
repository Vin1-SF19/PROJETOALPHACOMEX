export const NOTA_USUARIO_CHANNEL_PREFIX = "private-notas-usuario-";

export const NOTA_COMPARTILHADA_EVENT = "nota-compartilhada";
export const NOTA_MENCAO_EVENT = "nota-mencao";
export const NOTA_COMENTARIO_EVENT = "nota-comentario";
export const NOTA_PERMISSAO_ALTERADA_EVENT = "nota-permissao-alterada";
export const NOTA_VERSAO_RESTAURADA_EVENT = "nota-versao-restaurada";
export const NOTA_LEMBRETE_EVENT = "nota-lembrete";

export interface NotaNotificacaoPayload {
  noteId: string;
  noteTitle: string;
  tipo:
    | "COMPARTILHADA"
    | "MENCAO"
    | "COMENTARIO"
    | "PERMISSAO_ALTERADA"
    | "VERSAO_RESTAURADA"
    | "LEMBRETE";
  mensagem: string;
  autorNome: string;
  createdAt: string;
}

export function canalNotasDoUsuario(userId: number): string {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("ID de usuário inválido para o canal de notas.");
  }
  return `${NOTA_USUARIO_CHANNEL_PREFIX}${userId}`;
}

export function extrairUsuarioIdDoCanalNotas(channelName: string): number | null {
  if (!channelName.startsWith(NOTA_USUARIO_CHANNEL_PREFIX)) return null;

  const value = channelName.slice(NOTA_USUARIO_CHANNEL_PREFIX.length);
  if (!/^[1-9]\d*$/.test(value)) return null;

  return Number(value);
}
