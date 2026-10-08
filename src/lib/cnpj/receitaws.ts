import 'server-only';
import { createHash } from 'node:crypto';

type Ambiente = Record<string, string | undefined>;
type JsonObject = Record<string, unknown>;
export type ModoReceitaWS = 'public' | 'commercial';

export class ErroReceitaWS extends Error {
  constructor(public readonly codigo: string, message: string, public readonly status = 502) { super(message); }
}
export class EsperaReceitaWS extends Error {
  constructor(public readonly segundos: number) { super('Aguardando limite de consultas da ReceitaWS.'); }
}

export function configReceitaWS(env: Ambiente = process.env) {
  const token = env.RECEITAWS_TOKEN?.trim() || '';
  const mode = env.RECEITAWS_MODE?.trim() || (token ? 'commercial' : 'public');
  const days = Number(env.RECEITAWS_DAYS || '30');
  const fallback = env.RECEITAWS_FALLBACK || 'cacheOnError';
  const rpm = mode === 'public' ? 3 : Number(env.RECEITAWS_REQUESTS_PER_MINUTE || '50');
  if (!['public', 'commercial'].includes(mode) || !Number.isSafeInteger(days) || days < 0 ||
      !['cacheOnError', 'noCache'].includes(fallback) || !Number.isInteger(rpm) || rpm < 1 || rpm > 50) {
    throw new ErroReceitaWS('RECEITA_CONFIG_INVALID', 'Configuração da ReceitaWS inválida.', 503);
  }
  if (mode === 'commercial' && !token) throw new ErroReceitaWS('RECEITA_NOT_CONFIGURED', 'Token comercial da ReceitaWS não configurado.', 503);
  return { mode: mode as ModoReceitaWS, token, days, fallback, rpm };
}

export function criarLimitadorReceitaWS(agora: () => number = Date.now) {
  const reservas = new Map<string, number>();
  return {
    admitir(chave: string, rpm: number) {
      const atual = agora();
      const proxima = reservas.get(chave) || 0;
      if (atual < proxima) return Math.ceil((proxima - atual) / 1000);
      // Espaçamento conservador: 50/min com margem de 100ms; sem rajadas.
      reservas.set(chave, atual + Math.ceil(60000 / rpm) + 100);
      return 0;
    },
    bloquear(chave: string, segundos: number) {
      reservas.set(chave, Math.max(reservas.get(chave) || 0, agora() + segundos * 1000));
    },
  };
}
type Limitador = ReturnType<typeof criarLimitadorReceitaWS>;
const globalReceita = globalThis as typeof globalThis & { receitawsLimitador?: Limitador };
function limitadorCompartilhado() { return globalReceita.receitawsLimitador ??= criarLimitadorReceitaWS(); }

export async function consultarReceitaWS(cnpj: string, deps: {
  env?: Ambiente; fetcher?: typeof fetch; limitador?: Limitador; days?: number;
} = {}): Promise<{ dados: JsonObject; modo: ModoReceitaWS }> {
  if (!/^\d{14}$/.test(cnpj)) throw new ErroReceitaWS('RECEITA_INVALID_CNPJ', 'CNPJ inválido.', 400);
  const cfg = configReceitaWS(deps.env);
  if (deps.days !== undefined) {
    if (!Number.isSafeInteger(deps.days) || deps.days < 0) throw new ErroReceitaWS('RECEITA_CONFIG_INVALID', 'Idade máxima dos dados inválida.', 400);
    cfg.days = deps.days;
  }
  const limiter = deps.limitador || limitadorCompartilhado();
  const chave = cfg.mode === 'public' ? 'public' : createHash('sha256').update(cfg.token).digest('hex');
  const espera = limiter.admitir(chave, cfg.rpm);
  if (espera) throw new EsperaReceitaWS(espera);
  const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': 'PainelAlpha/1.0' };
  let url = `https://receitaws.com.br/v1/cnpj/${cnpj}`;
  if (cfg.mode === 'commercial') {
    url += `/days/${cfg.days}?fallback=${cfg.fallback}`;
    headers.Authorization = `Bearer ${cfg.token}`;
  }
  let response: Response;
  try {
    response = await (deps.fetcher || fetch)(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(65000) });
  } catch { throw new ErroReceitaWS('RECEITA_UNAVAILABLE', 'ReceitaWS indisponível. Tente novamente.'); }
  if (response.status === 429) {
    const raw = response.headers?.get('Retry-After');
    const informado = raw ? Number(raw) : 60;
    const seconds = Number.isFinite(informado) && informado > 0 ? Math.min(300, Math.ceil(informado)) : 60;
    limiter.bloquear(chave, seconds);
    throw new EsperaReceitaWS(seconds);
  }
  if (response.status === 402) throw new ErroReceitaWS('RECEITA_QUOTA_EXHAUSTED', 'Cota da ReceitaWS esgotada. Confira o saldo do plano.', 402);
  if ([401, 403].includes(response.status)) throw new ErroReceitaWS('RECEITA_UNAUTHORIZED', 'Token da ReceitaWS recusado. Confira a configuração.', 503);
  if (response.status === 504) throw new ErroReceitaWS('RECEITA_TIMEOUT', 'Consulta ReceitaWS excedeu o prazo. Tente novamente.');
  if (!response.ok) throw new ErroReceitaWS('RECEITA_UNAVAILABLE', 'ReceitaWS indisponível. Tente novamente.');
  let dados: unknown;
  try { dados = await response.json(); } catch { throw new ErroReceitaWS('RECEITA_INVALID_RESPONSE', 'Resposta inválida da ReceitaWS.'); }
  if (!dados || typeof dados !== 'object' || Array.isArray(dados) ||
      !('status' in dados) || dados.status !== 'OK' || !('cnpj' in dados) || typeof dados.cnpj !== 'string' ||
      dados.cnpj.replace(/\D/g, '') !== cnpj || !('nome' in dados) || typeof dados.nome !== 'string' || !dados.nome.trim()) {
    throw new ErroReceitaWS('RECEITA_INVALID_RESPONSE', 'ReceitaWS retornou cadastro inválido ou CNPJ divergente.');
  }
  return { dados: dados as JsonObject, modo: cfg.mode };
}
