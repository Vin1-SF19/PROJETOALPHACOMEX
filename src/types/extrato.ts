export interface TransacaoExtraida {
  data: string;
  descricao: string;
  valor: number | string;
}

export interface TransacaoNormalizada {
  data: string;
  descricao: string;
  valor: number;
}

export interface PaginaComErro {
  pagina: number; // 1-indexed, para exibição ao usuário
  texto: string; // texto da página (extraído via pdf-parse), usado para reprocessar sem re-upload do PDF
  motivo: string; // mensagem de erro
}

export interface RespostaExtracaoOnyx {
  success: true;
  data: TransacaoNormalizada[];
  ultimaDataEncontrada?: string;
  paginasComErro?: PaginaComErro[];
}

export interface ErroExtracaoOnyx {
  success: false;
  error: string;
}

export type ResultadoExtracaoOnyx = RespostaExtracaoOnyx | ErroExtracaoOnyx;
