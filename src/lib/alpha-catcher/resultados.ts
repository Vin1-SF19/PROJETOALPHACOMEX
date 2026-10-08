import type { ResultadoCatcher } from './core';

export type CampoOrdenacaoCatcher = 'original' | 'capitalSocial' | 'razaoSocial' | 'nomeFantasia' | 'cnpj' | 'empresa' | 'estado' | 'situacao' | 'modalidade' | 'localidade' | 'dataConsulta' | 'mensagem' | 'uf' | 'municipio' | 'regimeTributario' | 'dataOpcao';
export type LinhaOrdenavelCatcher = Omit<Partial<ResultadoCatcher>, 'estado'> & { cnpj: string; consignatario: string; estado: string };
const comparador = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
const estados: Record<string, string> = { aguardando: 'Aguardando', consultando: 'Consultando', existente: 'Já no banco', salvo: 'Salvo', pendente: 'Pendente' };

const dataInclusao = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short',
});
export function formatarDataInclusaoCatcher(value?: string | null): string {
  if (!value) return '—';
  const data = new Date(value);
  return Number.isNaN(data.getTime()) ? '—' : dataInclusao.format(data);
}

export function dataOpcaoSimplesCatcher(linha: Pick<ResultadoCatcher, 'optanteSimples' | 'regimeTributario' | 'dataOpcao'>): string | null {
  const simples = linha.optanteSimples === true || (linha.optanteSimples == null && linha.regimeTributario?.trim().toLowerCase() === 'simples nacional');
  return simples ? linha.dataOpcao || null : null;
}
const dataOpcao = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', dateStyle: 'short' });
export function formatarDataOpcaoCatcher(value?: string | null): string {
  if (!value) return '—';
  const data = new Date(value);
  return Number.isNaN(data.getTime()) ? '—' : dataOpcao.format(data);
}

export function ordenarResultadosCatcher<T extends LinhaOrdenavelCatcher>(linhas: readonly T[], campo: CampoOrdenacaoCatcher, direcao: 'asc' | 'desc'): T[] {
  const copia = [...linhas];
  if (campo === 'original') return copia;
  const valor = (linha: T) => {
    if (campo === 'dataConsulta' || campo === 'dataOpcao') {
      const data = campo === 'dataOpcao' ? dataOpcaoSimplesCatcher(linha) : linha.dataConsulta;
      const instante = data ? Date.parse(data) : NaN;
      return Number.isFinite(instante) ? new Date(instante).toISOString() : '';
    }
    if (campo === 'empresa') return (linha.razaoSocial || linha.consignatario).trim();
    if (campo === 'estado') return estados[linha.estado] || linha.estado;
    if (campo === 'localidade') return [linha.municipio, linha.uf].filter(Boolean).join(' / ').trim();
    return (linha[campo] || '').trim();
  };
  return copia.sort((a, b) => {
    if (campo === 'capitalSocial') {
      const va = normalizarCapitalCatcher(a.capitalSocial), vb = normalizarCapitalCatcher(b.capitalSocial);
      if (va === null || vb === null) return va === null ? vb === null ? 0 : 1 : -1;
      return (va - vb) * (direcao === 'asc' ? 1 : -1);
    }
    const va = valor(a), vb = valor(b);
    // Campos ainda não consultados permanecem ao final em ambas as direções.
    if (!va || !vb) return va ? -1 : vb ? 1 : 0;
    return comparador.compare(va, vb) * (direcao === 'asc' ? 1 : -1);
  });
}

export function normalizarCapitalCatcher(value?: string | null): number | null {
  if (!value?.trim()) return null;
  const texto = value.trim().replace(/^R\$\s*/, '');
  const normalizado = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto;
  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}
export function formatarCapitalCatcher(value?: string | null): string {
  const numero = normalizarCapitalCatcher(value);
  return numero === null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numero);
}
