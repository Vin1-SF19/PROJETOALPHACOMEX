import 'server-only';
import db from '@/lib/prisma';
import { consultarRadar, ErroConsultaRadar } from '@/lib/radar/consulta';
import { parseDateBR } from '@/lib/cnpj/parse-date-br';
import { criarAdmissao, normalizarEmpresa, type EmpresaCatcher, type ResultadoCatcher } from './core';

type Registro = {
  razao_social: string | null; situacao_radar: string | null; submodalidade: string | null;
  municipio: string | null; uf: string | null;
};
type Receita = {
  status?: string; cnpj?: string; nome?: string; fantasia?: string; municipio?: string; uf?: string;
  capital_social?: string; abertura?: string; simples?: { optante?: boolean; data_opcao?: string };
};
type Payload = Parameters<typeof db.consultas_radar.create>[0]['data'];
type Dependencias = {
  buscar: (cnpj: string) => Promise<Registro | null>;
  salvar: (data: Payload) => Promise<Registro>;
  receita: (cnpj: string) => Promise<Receita>;
  radar: typeof consultarRadar;
  admitir: () => number;
};

const globalCatcher = globalThis as typeof globalThis & { catcherAdmissao?: ReturnType<typeof criarAdmissao> };
globalCatcher.catcherAdmissao ??= criarAdmissao();
const deps: Dependencias = {
  buscar: cnpj => db.consultas_radar.findUnique({ where: { cnpj } }),
  salvar: data => db.consultas_radar.create({ data }),
  radar: consultarRadar,
  admitir: globalCatcher.catcherAdmissao,
  receita: async cnpj => {
    const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`, {
      headers: { Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(65000),
    });
    if (!response.ok) throw new Error('ReceitaWS indisponível');
    return response.json();
  },
};

export class EsperaCatcher extends Error {
  constructor(public segundos: number) { super('Aguardando intervalo entre consultas.'); }
}

function resultado(empresa: EmpresaCatcher, estado: 'existente' | 'salvo', row: Registro): ResultadoCatcher {
  return { ...empresa, estado, razaoSocial: row.razao_social, situacao: row.situacao_radar,
    modalidade: row.submodalidade, municipio: row.municipio, uf: row.uf };
}

export async function processarEmpresa(input: unknown, dependencias: Dependencias = deps): Promise<ResultadoCatcher> {
  const empresa = normalizarEmpresa(input);
  if (!empresa) throw new Error('Empresa inválida');
  const existente = await dependencias.buscar(empresa.cnpj);
  if (existente) return resultado(empresa, 'existente', existente);
  const espera = dependencias.admitir();
  if (espera) throw new EsperaCatcher(espera);
  const [rf, rd] = await Promise.allSettled([dependencias.receita(empresa.cnpj), dependencias.radar(empresa.cnpj)]);
  const pendente = (mensagem: string, codigo?: string): ResultadoCatcher => ({ ...empresa, estado: 'pendente', mensagem, codigo });
  if (rf.status === 'rejected' || !rf.value || rf.value.status !== 'OK' ||
      typeof rf.value.cnpj !== 'string' || rf.value.cnpj.replace(/\D/g, '') !== empresa.cnpj ||
      typeof rf.value.nome !== 'string' || !rf.value.nome.trim()) {
    return pendente('ReceitaWS indisponível ou resposta inválida. Tente novamente.', 'RECEITA_PENDENTE');
  }
  const naoEncontrado = rd.status === 'rejected' && rd.reason instanceof ErroConsultaRadar && rd.reason.status === 404;
  if (rd.status === 'rejected' && !naoEncontrado) {
    const codigo = rd.reason instanceof ErroConsultaRadar ? rd.reason.code : 'RADAR_PENDENTE';
    return pendente(codigo === 'BLOCKED_BY_CAPTCHA' ? 'Radar bloqueado por captcha. Tente novamente em alguns minutos.' : 'Radar indisponível. Tente novamente.', codigo);
  }
  const receita = rf.value;
  const radar = rd.status === 'fulfilled' ? rd.value : null;
  const optante = typeof receita.simples?.optante === 'boolean' ? receita.simples.optante : null;
  const payload: Payload = {
    cnpj: empresa.cnpj, razao_social: receita.nome!.trim().toUpperCase(), nome_fantasia: receita.fantasia || null,
    situacao_radar: radar?.situacao || null, submodalidade: radar?.submodalidade || null,
    data_situacao: parseDateBR(radar?.dataSituacao), municipio: receita.municipio || null, uf: receita.uf || null,
    capital_social: receita.capital_social || null, data_constituicao: parseDateBR(receita.abertura),
    contribuinte: radar?.contribuinte || receita.nome!, optante_simples: optante,
    regime_tributario: optante === null ? null : optante ? 'Simples Nacional' : 'Regime Normal',
    data_opcao: parseDateBR(receita.simples?.data_opcao), fonte: 'ALPHA_CATCHER+LOGCOMEX+RECEITAWS_PUBLICA+CONSULTA_RADAR',
    json_completo: JSON.stringify({ logcomex: empresa, receitaws: receita, radar }),
  };
  try {
    const salvo = await dependencias.salvar(payload);
    return { ...resultado(empresa, 'salvo', salvo), mensagem: naoEncontrado ? 'Radar não habilitado ou não encontrado (404).' : undefined };
  } catch (error) {
    // CREATE + CNPJ único preserva o registro de outra sessão; nunca sobrescrever.
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
      const concorrente = await dependencias.buscar(empresa.cnpj);
      if (concorrente) return resultado(empresa, 'existente', concorrente);
    }
    return pendente('Não foi possível salvar. Tente novamente.', 'SAVE_FAILED');
  }
}
