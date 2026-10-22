import "server-only";

export type DadosRadar = {
  cnpj: string;
  contribuinte: string;
  razaoSocial: string;
  situacao: string;
  modalidade: string;
  submodalidade: string;
  dataSituacao: string;
  baseLegal: string;
  tipoDesabilitacao: string;
  operacoesAutorizadas: string;
  raw: string;
  dataAtualizacaoPublicada?: string | null;
  consultadoEm?: string;
  aviso?: string;
};

export class ErroConsultaRadar extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "ErroConsultaRadar";
  }
}

const campo = (value: unknown): string => typeof value === "string" ? value.trim() : "";

/** Cliente server-side da API RADAR do ialpha. O token nunca sai do servidor Alpha. */
export async function consultarRadar(cnpj: string, timeoutMs = 90_000): Promise<DadosRadar> {
  const digits = cnpj.replace(/\D/g, "");
  if (!/^(\d{8}|\d{14})$/.test(digits)) {
    throw new ErroConsultaRadar(400, "INVALID_CNPJ", "CNPJ inválido");
  }
  const raiz = digits.slice(0, 8);
  const token = process.env.CONSULTA_RADAR_TOKEN?.trim();
  if (!token) throw new ErroConsultaRadar(503, "NOT_CONFIGURED", "API Radar não configurada");

  let response: Response;
  try {
    response = await fetch(`https://consulta-radar.alpha-comex.com/consultar/${raiz}?fonte=csv`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch {
    throw new ErroConsultaRadar(502, "UPSTREAM_UNAVAILABLE", "Serviço Radar indisponível");
  }

  if (response.status === 404) throw new ErroConsultaRadar(404, "NOT_FOUND", "CNPJ não consta no arquivo consultado");
  if (response.status === 401) throw new ErroConsultaRadar(502, "UPSTREAM_UNAUTHORIZED", "Autenticação da API Radar falhou");
  if (response.status === 400) throw new ErroConsultaRadar(502, "UPSTREAM_BAD_REQUEST", "API Radar rejeitou a raiz do CNPJ");

  let payload: unknown;
  try { payload = await response.json(); }
  catch { throw new ErroConsultaRadar(502, "INVALID_RESPONSE", "Resposta inválida da API Radar"); }
  if (response.status === 502 && JSON.stringify(payload).includes("BLOCKED_BY_CAPTCHA")) {
    throw new ErroConsultaRadar(502, "BLOCKED_BY_CAPTCHA", "Consulta temporariamente bloqueada. Tente novamente em alguns minutos.");
  }
  if (!response.ok) throw new ErroConsultaRadar(502, "UPSTREAM_UNAVAILABLE", "Serviço Radar indisponível");

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ErroConsultaRadar(502, "INVALID_RESPONSE", "Resposta incompleta da API Radar");
  }
  const envelope = payload as Record<string, unknown>;
  const data = envelope.data && typeof envelope.data === "object" && !Array.isArray(envelope.data)
    ? envelope.data as Record<string, unknown>
    : envelope;
  const isLegacyEnvelope = "success" in envelope;
  if (isLegacyEnvelope && envelope.success !== true) throw new ErroConsultaRadar(502, "INVALID_RESPONSE", "Resposta incompleta da API Radar");
  const situacao = campo(data.situacao) || (data.found === true ? "HABILITADA" : data.found === false ? "NÃO CONSTA NO ARQUIVO CONSULTADO" : "");
  const razaoSocial = campo(data.razaoSocial) || campo(data.contribuinte);
  const modalidade = campo(data.modalidade);
  if (!situacao) throw new ErroConsultaRadar(502, "INVALID_RESPONSE", "Resposta incompleta da API Radar");
  return {
    cnpj: raiz,
    contribuinte: razaoSocial,
    razaoSocial,
    situacao,
    modalidade,
    submodalidade: campo(data.submodalidade) || modalidade,
    dataSituacao: campo(data.dataSituacao),
    baseLegal: campo(data.baseLegal),
    tipoDesabilitacao: campo(data.tipoDesabilitacao),
    operacoesAutorizadas: campo(data.operacoesAutorizadas),
    raw: "raw" in envelope ? campo(envelope.raw) : "",
    dataAtualizacaoPublicada: campo(data.dataAtualizacaoPublicada) || campo(envelope.dataAtualizacaoPublicada) || null,
    consultadoEm: campo(data.consultadoEm) || campo(envelope.consultadoEm) || undefined,
    aviso: campo(data.aviso) || campo(envelope.aviso) || undefined,
  };
}
