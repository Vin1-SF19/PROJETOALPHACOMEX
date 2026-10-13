import 'server-only';
import { configReceitaWS, ErroReceitaWS } from '@/lib/cnpj/receitaws';

export type EstadoDiagnosticoApi = 'disponivel' | 'problema' | 'inconclusivo';
export type ItemDiagnosticoApi = { estado: EstadoDiagnosticoApi; mensagem: string };
export type DiagnosticoApisCatcher = {
  verificadoEm: string;
  worker: ItemDiagnosticoApi;
  receitaWS: ItemDiagnosticoApi;
  radar: ItemDiagnosticoApi;
};

/** Inspeciona somente a configuração local; nunca consulta CNPJ nem grava dados. */
export function diagnosticarApisCatcher(opcoes: { workerDisponivel: boolean; agora?: Date }): DiagnosticoApisCatcher {
  let receitaWS: ItemDiagnosticoApi;
  try {
    const config = configReceitaWS();
    receitaWS = {
      estado: 'inconclusivo',
      mensagem: `Configuração válida (${config.mode === 'commercial' ? 'comercial' : 'pública'}); disponibilidade externa não confirmada sem consultar um CNPJ.`,
    };
  } catch (error) {
    receitaWS = {
      estado: 'problema',
      mensagem: error instanceof ErroReceitaWS ? error.message : 'Não foi possível validar a configuração da ReceitaWS.',
    };
  }

  const radar: ItemDiagnosticoApi = process.env.CONSULTA_RADAR_TOKEN?.trim()
    ? { estado: 'inconclusivo', mensagem: 'Credencial configurada; disponibilidade externa não confirmada sem consultar um CNPJ.' }
    : { estado: 'problema', mensagem: 'Credencial da API Radar não configurada neste ambiente.' };

  return {
    verificadoEm: (opcoes.agora || new Date()).toISOString(),
    worker: opcoes.workerDisponivel
      ? { estado: 'disponivel', mensagem: 'Worker respondeu à verificação autenticada.' }
      : { estado: 'inconclusivo', mensagem: 'Esta instância não confirmou comunicação com um worker separado.' },
    receitaWS,
    radar,
  };
}
