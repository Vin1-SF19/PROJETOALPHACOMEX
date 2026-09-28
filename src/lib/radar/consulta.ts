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
};

export class ErroConsultaRadar extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

const campo = (value: unknown): string => typeof value === "string" ? value.trim() : "";

export async function consultarRadar(cnpj: string): Promise<DadosRadar> {
  const digits = cnpj.replace(/\D/g, "");
  if (!/^(\d{8}|\d{14})$/.test(digits)) {
    throw new ErroConsultaRadar(400, "INVALID_CNPJ", "CNPJ inválido");
  }
  const raiz = digits.slice(0, 8);
  const token = process.env.CONSULTA_RADAR_TOKEN?.trim();
  if (!token) {
    throw new ErroConsultaRadar(503, "NOT_CONFIGURED", "API Radar não configurada");
  }

  let response: Response;
  try {
    response = await fetch(`https://consulta-radar.alpha-comex.com/consultar/${raiz}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    });
  } catch {
    throw new ErroConsultaRadar(502, "UPSTREAM_UNAVAILABLE", "Serviço Radar indisponível");
  }

  if (response.status === 404) throw new ErroConsultaRadar(404, "NOT_FOUND", "CNPJ não habilitado ou não encontrado no Radar");
  if (response.status === 401) throw new ErroConsultaRadar(502, "UPSTREAM_UNAUTHORIZED", "Autenticação da API Radar falhou");
  if (response.status === 400) throw new ErroConsultaRadar(502, "UPSTREAM_BAD_REQUEST", "API Radar rejeitou a raiz do CNPJ");

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ErroConsultaRadar(502, "INVALID_RESPONSE", "Resposta inválida da API Radar");
  }
  if (response.status === 502 && JSON.stringify(payload).includes("BLOCKED_BY_CAPTCHA")) {
    throw new ErroConsultaRadar(502, "BLOCKED_BY_CAPTCHA", "Consulta temporariamente bloqueada por captcha. Tente novamente em alguns minutos.");
  }
  if (!response.ok) throw new ErroConsultaRadar(502, "UPSTREAM_UNAVAILABLE", "Serviço Radar indisponível");
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || !("success" in payload) || payload.success !== true || !("data" in payload) || !payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) {
    throw new ErroConsultaRadar(502, "INVALID_RESPONSE", "Resposta incompleta da API Radar");
  }
  const data = payload.data as Record<string, unknown>;
  const situacao = campo(data.situacao);
  if (!situacao) throw new ErroConsultaRadar(502, "INVALID_RESPONSE", "Resposta incompleta da API Radar");
  const modalidade = campo(data.modalidade);
  const razaoSocial = campo(data.razaoSocial);
  return {
    cnpj: raiz,
    contribuinte: razaoSocial,
    razaoSocial,
    situacao,
    modalidade,
    submodalidade: modalidade,
    dataSituacao: campo(data.dataSituacao),
    baseLegal: campo(data.baseLegal),
    tipoDesabilitacao: campo(data.tipoDesabilitacao),
    operacoesAutorizadas: campo(data.operacoesAutorizadas),
    raw: "raw" in payload ? campo(payload.raw) : "",
  };
}
