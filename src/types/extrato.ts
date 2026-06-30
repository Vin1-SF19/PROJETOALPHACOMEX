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

export interface RespostaExtracaoOnyx {
  success: true;
  data: TransacaoNormalizada[];
  ultimaDataEncontrada?: string;
}

export interface ErroExtracaoOnyx {
  success: false;
  error: string;
}

export type ResultadoExtracaoOnyx = RespostaExtracaoOnyx | ErroExtracaoOnyx;
