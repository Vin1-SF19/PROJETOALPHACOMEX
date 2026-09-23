type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function flag(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["sim", "s", "true", "1"].includes(normalized)) return true;
  if (["não", "nao", "n", "false", "0"].includes(normalized)) return false;
  return null;
}

function regime(simples: boolean | null): string | null {
  return simples === null ? null : simples ? "Simples Nacional" : "Regime Normal";
}

function formatarData(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

async function jsonExterno(url: string): Promise<JsonObject> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "PainelAlpha/1.0", Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Fonte cadastral indisponível");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Cadastro inválido");
  return data as JsonObject;
}

function verificarCadastro(cnpj: string, returnedCnpj: unknown, razaoSocial: unknown): void {
  if (string(returnedCnpj).replace(/\D/g, "") !== cnpj || !string(razaoSocial).trim()) {
    throw new Error("Cadastro incompleto ou CNPJ divergente");
  }
}

async function consultarCnpjWs(cnpj: string) {
  const dados = await jsonExterno(`https://publica.cnpj.ws/cnpj/${cnpj}`);
  if (dados.message) throw new Error("CNPJ não encontrado");
  const estabelecimento = object(dados.estabelecimento);
  const simples = object(dados.simples);
  verificarCadastro(cnpj, estabelecimento.cnpj, dados.razao_social);
  const optanteSimples = flag(simples.simples);
  const optanteSimei = flag(simples.mei);
  const mapearCnae = (item: unknown) => {
    const cnae = object(item);
    return { code: string(cnae.subclasse || cnae.id), text: string(cnae.descricao) };
  };
  const principal = estabelecimento.atividade_principal ? [mapearCnae(estabelecimento.atividade_principal)] : [];
  const secundarios = Array.isArray(estabelecimento.atividades_secundarias)
    ? estabelecimento.atividades_secundarias.map(mapearCnae) : [];

  return {
    cnpj: string(estabelecimento.cnpj),
    razaoSocial: string(dados.razao_social).toUpperCase(),
    nomeFantasia: (string(estabelecimento.nome_fantasia) || "Sem nome fantasia").toUpperCase(),
    municipio: string(object(estabelecimento.cidade).nome).toUpperCase(),
    uf: string(object(estabelecimento.estado).sigla).toUpperCase(),
    dataConstituicao: formatarData(string(estabelecimento.data_inicio_atividade)),
    regimeTributario: regime(optanteSimples),
    capitalSocial: dados.capital_social || 0,
    data_opcao: simples.data_opcao_simples || null,
    optante_simples: optanteSimples,
    data_exclusaoSimples: simples.data_exclusao_simples || null,
    optante_simei: optanteSimei,
    data_opcaoSimei: simples.data_opcao_mei || null,
    data_exclusaoSimei: simples.data_exclusao_mei || null,
    atividade_principal: principal,
    atividades_secundarias: secundarios,
    abertura_bruta: formatarData(string(estabelecimento.data_inicio_atividade)),
    simples: { optante: optanteSimples, data_opcao: simples.data_opcao_simples || null, data_exclusao: simples.data_exclusao_simples || null },
    bairro: string(estabelecimento.bairro).toUpperCase(),
    cep: string(estabelecimento.cep),
    email: string(estabelecimento.email).toLowerCase(),
    telefone: estabelecimento.ddd1 && estabelecimento.telefone1 ? `(${estabelecimento.ddd1}) ${estabelecimento.telefone1}` : "",
    logradouro: string(estabelecimento.logradouro).toUpperCase(),
    numero: string(estabelecimento.numero),
    situacao: string(estabelecimento.situacao_cadastral).toUpperCase(),
    natureza_juridica: string(object(dados.natureza_juridica).descricao),
    porte: string(object(dados.porte).descricao),
    qsa: Array.isArray(dados.socios) ? dados.socios.map((item) => {
      const socio = object(item);
      return { nome: socio.nome, qual: string(object(socio.qualificacao_socio).descricao) };
    }) : [],
    fonteCadastro: "cnpj.ws",
  };
}

export async function getReceitaData(cnpj: string) {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) throw new Error("CNPJ inválido");
  try {
    const dados = await jsonExterno(`https://www.receitaws.com.br/v1/cnpj/${digits}`);
    if (dados.status && dados.status !== "OK") throw new Error("ReceitaWS recusou a consulta");
    verificarCadastro(digits, dados.cnpj, dados.nome);
    const simples = object(dados.simples);
    const simei = object(dados.simei);
    const optanteSimples = flag(simples.optante);
    const optanteSimei = flag(simei.optante);
    return {
      cnpj: string(dados.cnpj),
      razaoSocial: string(dados.nome).toUpperCase(),
      nomeFantasia: (string(dados.fantasia) || "Sem nome fantasia").toUpperCase(),
      municipio: string(dados.municipio).toUpperCase(),
      uf: string(dados.uf).toUpperCase(),
      dataConstituicao: string(dados.abertura),
      regimeTributario: regime(optanteSimples),
      capitalSocial: dados.capital_social || 0,
      data_opcao: simples.data_opcao || dados.opcao_pelo_simples_data || null,
      optante_simples: optanteSimples,
      data_exclusaoSimples: simples.data_exclusao || null,
      optante_simei: optanteSimei,
      data_opcaoSimei: simei.data_opcao || null,
      data_exclusaoSimei: simei.data_exclusao || null,
      atividade_principal: Array.isArray(dados.atividade_principal) ? dados.atividade_principal : [],
      atividades_secundarias: Array.isArray(dados.atividades_secundarias) ? dados.atividades_secundarias : [],
      abertura_bruta: string(dados.abertura),
      simples: { ...simples, optante: optanteSimples },
      bairro: string(dados.bairro).toUpperCase(),
      cep: string(dados.cep),
      email: string(dados.email).toLowerCase(),
      telefone: string(dados.telefone),
      logradouro: string(dados.logradouro).toUpperCase(),
      numero: string(dados.numero),
      situacao: string(dados.situacao).toUpperCase(),
      natureza_juridica: string(dados.natureza_juridica),
      porte: string(dados.porte),
      qsa: Array.isArray(dados.qsa) ? dados.qsa : [],
      fonteCadastro: "receitaws",
    };
  } catch {
    return consultarCnpjWs(digits);
  }
}
