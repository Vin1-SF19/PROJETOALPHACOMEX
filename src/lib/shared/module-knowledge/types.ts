export interface TopicoManualModulo {
  id: string;
  titulo: string;
  aliases: readonly string[];
  conteudo: string;
}

export interface ManualModulo {
  id: string;
  nome: string;
  rota: string;
  permissao: string;
  rolesComAcesso?: readonly string[];
  aliases: readonly string[];
  resumo: string;
  topicos: readonly TopicoManualModulo[];
}

export type ResultadoConsultaManual =
  | { sucesso: true; modulo: string; topico: string | null; conteudo: string }
  | { sucesso: false; erro: string; sugestoes?: string[] };
