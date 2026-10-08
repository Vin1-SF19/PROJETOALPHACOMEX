import 'server-only';
import db from '@/lib/prisma';
import { consultarRadar, ErroConsultaRadar } from '@/lib/radar/consulta';
import { consultarReceitaWS, ErroReceitaWS, EsperaReceitaWS, type ModoReceitaWS } from '@/lib/cnpj/receitaws';
import { parseDateBR } from '@/lib/cnpj/parse-date-br';
import { normalizarEmpresa, normalizarDiasReceita, normalizarDataConsulta, type EmpresaCatcher, type ResultadoCatcher } from './core';

type Registro = {
  json_completo?: string;
  nome_fantasia?: string | null;
  capital_social?: string | null;
  razao_social: string | null; situacao_radar: string | null; submodalidade: string | null;
  municipio: string | null; uf: string | null;
  data_consulta: Date;
  regime_tributario: string | null;
  optante_simples: boolean | null;
  data_opcao: Date | null;
};
type Receita = {
  modoReceitaWS?: ModoReceitaWS; status?: string; cnpj?: string; nome?: string; fantasia?: string; municipio?: string; uf?: string;
  capital_social?: string; abertura?: string; simples?: { optante?: boolean; data_opcao?: string };
};
type Payload = Parameters<typeof db.consultas_radar.create>[0]['data'];
type Dependencias = {
  buscar: (cnpj: string) => Promise<Registro | null>;
  salvar: (data: Payload) => Promise<Registro>;
  receita: (cnpj: string, days: number) => Promise<Receita>;
  radar: typeof consultarRadar;
};

const deps: Dependencias = {
  buscar: cnpj => db.consultas_radar.findUnique({ where: { cnpj } }),
  salvar: data => db.consultas_radar.create({ data }),
  radar: consultarRadar,
  receita: async (cnpj, days) => {
    const { dados, modo } = await consultarReceitaWS(cnpj, { days });
    return { ...dados, modoReceitaWS: modo };
  },
};

export { EsperaReceitaWS as EsperaCatcher } from '@/lib/cnpj/receitaws';

function resultado(empresa: EmpresaCatcher, estado: 'existente' | 'salvo', row: Registro): ResultadoCatcher {
  return { ...empresa, estado, razaoSocial: row.razao_social, nomeFantasia: row.nome_fantasia || null, capitalSocial: row.capital_social ?? null, situacao: row.situacao_radar,
    modalidade: row.submodalidade, municipio: row.municipio, uf: row.uf,
    dataConsulta: row.data_consulta.toISOString(), regimeTributario: row.regime_tributario,
    optanteSimples: row.optante_simples, dataOpcao: row.data_opcao?.toISOString() || null };
}

export async function processarEmpresa(input: unknown, dependencias: Dependencias = deps, opcoes: { days?: number; dataConsulta?: string; origem?: 'JSON' | 'LOGCOMEX'; importacaoId?: string; importacaoUserId?: number } = {}): Promise<ResultadoCatcher> {
  const origem = opcoes.origem ?? 'JSON';
  if (origem !== 'JSON' && origem !== 'LOGCOMEX') throw new Error('Origem inválida');
  const days = normalizarDiasReceita(opcoes.days);
  if (days === null) throw new Error('Idade máxima dos dados inválida');
  const dataConsulta = normalizarDataConsulta(opcoes.dataConsulta);
  if (dataConsulta === null) throw new Error('Data da consulta inválida');
  const empresa = normalizarEmpresa(input);
  if (!empresa) throw new Error('Empresa inválida');
  const existente = await dependencias.buscar(empresa.cnpj);
  const estadoExistente = (row: Registro) => {
    if (opcoes.importacaoId && row.json_completo) {
      try { const dono = JSON.parse(row.json_completo); if (dono.importacaoId === opcoes.importacaoId && dono.importacaoUserId === opcoes.importacaoUserId) return 'salvo' as const; } catch { /* Cadastro legado. */ }
    }
    return 'existente' as const;
  };
  if (existente) return resultado(empresa, estadoExistente(existente), existente);
  const pendente = (mensagem: string, codigo?: string): ResultadoCatcher => ({ ...empresa, estado: 'pendente', mensagem, codigo });
  let receita: Receita;
  try { receita = await dependencias.receita(empresa.cnpj, days); } catch (error) {
    if (error instanceof EsperaReceitaWS) throw error;
    return pendente(error instanceof ErroReceitaWS ? error.message : 'ReceitaWS indisponível. Tente novamente.',
      error instanceof ErroReceitaWS ? error.codigo : 'RECEITA_PENDENTE');
  }
  if (!receita || receita.status !== 'OK' || typeof receita.cnpj !== 'string' ||
      receita.cnpj.replace(/\D/g, '') !== empresa.cnpj || typeof receita.nome !== 'string' || !receita.nome.trim()) {
    return pendente('ReceitaWS indisponível ou resposta inválida. Tente novamente.', 'RECEITA_PENDENTE');
  }
  // O Radar só é chamado depois de validar o cadastro da ReceitaWS.
  let radar: Awaited<ReturnType<typeof consultarRadar>> | null = null;
  let naoEncontrado = false;
  try { radar = await dependencias.radar(empresa.cnpj); } catch (error) {
    naoEncontrado = error instanceof ErroConsultaRadar && error.status === 404;
    if (!naoEncontrado) {
      const codigo = error instanceof ErroConsultaRadar ? error.code : 'RADAR_PENDENTE';
      return pendente(codigo === 'BLOCKED_BY_CAPTCHA' ? 'Radar bloqueado por captcha. Tente novamente em alguns minutos.' : 'Radar indisponível. Tente novamente.', codigo);
    }
  }
  const optante = typeof receita.simples?.optante === 'boolean' ? receita.simples.optante : null;
  const payload: Payload = {
    ...(dataConsulta ? { data_consulta: dataConsulta } : {}),
    cnpj: empresa.cnpj, razao_social: receita.nome!.trim().toUpperCase(), nome_fantasia: receita.fantasia || null,
    situacao_radar: radar?.situacao || null, submodalidade: radar?.submodalidade || null,
    data_situacao: parseDateBR(radar?.dataSituacao), municipio: receita.municipio || null, uf: receita.uf || null,
    capital_social: receita.capital_social || null, data_constituicao: parseDateBR(receita.abertura),
    contribuinte: radar?.contribuinte || receita.nome!, optante_simples: optante,
    regime_tributario: optante === null ? null : optante ? 'Simples Nacional' : 'Regime Normal',
    data_opcao: parseDateBR(receita.simples?.data_opcao), fonte: `ALPHA_CATCHER+${origem}+RECEITAWS_${receita.modoReceitaWS === 'commercial' ? 'COMERCIAL' : 'PUBLICA'}+CONSULTA_RADAR`,
    json_completo: JSON.stringify({ ...(opcoes.importacaoId ? { importacaoId: opcoes.importacaoId, importacaoUserId: opcoes.importacaoUserId } : {}), origemImportacao: origem, logcomex: empresa, receitaws: receita, radar, politicaReceita: { days }, ...(dataConsulta ? { dataConsultaImportacao: opcoes.dataConsulta } : {}) }),
  };
  try {
    const salvo = await dependencias.salvar(payload);
    return { ...resultado(empresa, 'salvo', salvo), mensagem: naoEncontrado ? 'Radar não habilitado ou não encontrado (404).' : undefined };
  } catch (error) {
    // CREATE + CNPJ único preserva o registro de outra sessão; nunca sobrescrever.
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
      const concorrente = await dependencias.buscar(empresa.cnpj);
      if (concorrente) return resultado(empresa, estadoExistente(concorrente), concorrente);
    }
    return pendente('Não foi possível salvar. Tente novamente.', 'SAVE_FAILED');
  }
}
