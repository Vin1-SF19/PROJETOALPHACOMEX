type JsonRecord = Record<string, unknown>;

export interface PessoaEmpresaFonte {
  id?: number;
  nome: string;
  telefone?: string | null;
  obs?: string | null;
  dataNascimento?: string | null;
  vinculo?: string | null;
}

export interface ClienteEmpresaFonte {
  id: number;
  status: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  dataConstituicao?: string | null;
  uf?: string | null;
  municipio?: string | null;
  regimeTributario?: string | null;
  servicos?: string | null;
  analistaResponsavel?: string | null;
  dataContratacao?: string | null;
  dataExito?: string | null;
  formaPagamento?: string | null;
  valorContrato?: number | null;
  closerNome?: string | null;
  origemLead?: string | null;
  canalAquisicao?: string | null;
  canalOutro?: string | null;
  socios: PessoaEmpresaFonte[];
}

export interface PreAnaliseEmpresaFonte {
  regimeEA?: string | null;
  qualificacao?: string | null;
  submodalidade?: string | null;
  capitalSocial?: number | null;
  nomeResponsavel?: string | null;
  telefoneContato?: string | null;
  observacoes?: string | null;
  dadosBrutos: unknown;
  updatedAt: Date | string;
}

export interface RadarFiscalEmpresaFonte {
  qualificacao?: string | null;
  situacao_cadastral?: string | null;
  data_abertura?: string | null;
  capital_social?: string | null;
  regime_receita?: string | null;
  regime_ea?: string | null;
  data_opcao_simples?: string | null;
  data_exclusao_simples?: string | null;
  divida_tributaria?: number | null;
  historico_regime?: string | null;
  cnaes?: string | null;
  qsa?: string | null;
  data_consulta?: string | null;
  perse_anexo?: string | null;
  perse?: string | null;
}

export interface ResponsavelBpmFonte {
  nome: string;
  papel: string;
}

export interface DadosEmpresaFontes {
  empresaPrincipal: ClienteEmpresaFonte;
  registrosCs: ClienteEmpresaFonte[];
  pessoasVinculadas: PessoaEmpresaFonte[];
  preAnalise: PreAnaliseEmpresaFonte | null;
  radarFiscal: RadarFiscalEmpresaFonte | null;
  responsaveisBpm: ResponsavelBpmFonte[];
}

export interface PessoaEmpresaConsolidada {
  nome: string;
  funcao: string | null;
  telefone: string | null;
  email: string | null;
  dataNascimento: string | null;
  observacoes: string | null;
  fontes: string[];
}

export interface ContatoEmpresaConsolidado {
  tipo: "Telefone" | "E-mail";
  valor: string;
  titular: string;
  fonte: string;
}

export interface ResponsavelEmpresaConsolidado {
  nome: string;
  papel: string;
  telefone: string | null;
  fonte: string;
}

export interface CnaeEmpresaConsolidado {
  codigo: string;
  descricao: string;
  tipo: "Principal" | "Secundário";
}

export interface HistoricoRegimeEmpresa {
  periodo: string;
  regime: string;
}

export interface DadosEmpresaConsolidado {
  empresa: {
    id: number;
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string | null;
    situacao: string | null;
    dataConstituicao: string | null;
    porte: string | null;
    naturezaJuridica: string | null;
    capitalSocial: number | null;
    endereco: {
      logradouro: string | null;
      numero: string | null;
      bairro: string | null;
      municipio: string | null;
      uf: string | null;
      cep: string | null;
    };
  };
  relacionamento: {
    status: string[];
    servicos: string[];
    analistas: string[];
    closers: string[];
    formasPagamento: string[];
    valoresContrato: number[];
    datasContratacao: string[];
    datasExito: string[];
    origens: string[];
  };
  pessoas: PessoaEmpresaConsolidada[];
  contatos: ContatoEmpresaConsolidado[];
  responsaveis: ResponsavelEmpresaConsolidado[];
  cnaes: CnaeEmpresaConsolidado[];
  regimeTributario: {
    atual: string | null;
    receita: string | null;
    simplesNacional: boolean | null;
    mei: boolean | null;
    dataOpcaoSimples: string | null;
    dataExclusaoSimples: string | null;
    historico: HistoricoRegimeEmpresa[];
  };
  radar: {
    situacao: string | null;
    submodalidade: string | null;
    qualificacao: string | null;
    perse: string | null;
    anexoPerse: string | null;
    dividaTributaria: number | null;
    consultadoEm: string | null;
  };
  fonteCartaoCnpj: "Pré-Análise" | "CS&NPS";
  atualizadoEm: string | null;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function asRecord(value: unknown): JsonRecord {
  const parsed = parseJson(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as JsonRecord
    : {};
}

function asArray(value: unknown): unknown[] {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed : [];
}

function stringValue(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string" && typeof value !== "number") continue;
    const texto = String(value).trim();
    if (texto && texto.toLowerCase() !== "null" && texto.toLowerCase() !== "undefined") {
      return texto;
    }
  }
  return null;
}

function numberValue(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") continue;
    const normalizado = value.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
    const numero = Number(normalizado);
    if (Number.isFinite(numero)) return numero;
  }
  return null;
}

function booleanValue(...values: unknown[]): boolean | null {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (typeof value !== "string") continue;
    const texto = value.trim().toLowerCase();
    if (["sim", "s", "true", "1"].includes(texto)) return true;
    if (["não", "nao", "n", "false", "0"].includes(texto)) return false;
  }
  return null;
}

function normalizeKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const texto = value?.trim();
    if (!texto) return [];
    const key = normalizeKey(texto);
    if (seen.has(key)) return [];
    seen.add(key);
    return [texto];
  });
}

function envelopeDados(value: unknown): JsonRecord {
  const envelope = asRecord(value);
  return Object.keys(asRecord(envelope.dados)).length > 0 ? asRecord(envelope.dados) : envelope;
}

function extrairCnaes(value: unknown, tipo: CnaeEmpresaConsolidado["tipo"]): CnaeEmpresaConsolidado[] {
  return asArray(value).flatMap((item) => {
    const registro = asRecord(item);
    const codigo = stringValue(registro.code, registro.codigo, registro.subclasse, registro.id);
    const descricao = stringValue(registro.text, registro.descricao, registro.nome);
    if (!codigo && !descricao) return [];
    return [{ codigo: codigo || "—", descricao: descricao || "Não informado", tipo }];
  });
}

function extrairHistorico(...values: unknown[]): HistoricoRegimeEmpresa[] {
  for (const value of values) {
    const parsed = parseJson(value);
    const itens = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "string"
        ? parsed.split(";").map((item) => item.trim()).filter(Boolean)
        : [];
    if (!itens.length) continue;
    return itens.flatMap((item) => {
      if (typeof item === "string") return [{ periodo: "—", regime: item }];
      const registro = asRecord(item);
      const periodo = stringValue(registro.Ano, registro.ano, registro.periodo, registro.exercicio) || "—";
      const regime = stringValue(registro.Regime, registro.regime, registro.descricao);
      return regime ? [{ periodo, regime }] : [];
    });
  }
  return [];
}

function dataIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const data = value instanceof Date ? value : new Date(value);
  return Number.isNaN(data.getTime()) ? stringValue(value) : data.toISOString();
}

export function normalizarDadosEmpresaBpm(fontes: DadosEmpresaFontes): DadosEmpresaConsolidado {
  const bruto = asRecord(fontes.preAnalise?.dadosBrutos);
  const rfb = envelopeDados(bruto.rfb);
  const regimeApi = envelopeDados(bruto.empresaqui);
  const radarEnvelope = asRecord(bruto.radar);
  const radar = envelopeDados(bruto.radar);
  const extra = asRecord(bruto.extra);
  const cliente = fontes.empresaPrincipal;
  const radarFiscal = fontes.radarFiscal;

  const cnaesRfb = [
    ...extrairCnaes(rfb.atividade_principal, "Principal"),
    ...extrairCnaes(rfb.atividades_secundarias, "Secundário"),
  ];
  const cnaesAgrupados = asRecord(rfb.cnaes);
  const cnaesFallback = [
    ...extrairCnaes(cnaesAgrupados.principal, "Principal"),
    ...extrairCnaes(cnaesAgrupados.secundarios, "Secundário"),
  ];
  const cnaesRadar = asRecord(parseJson(radarFiscal?.cnaes));
  const cnaes = [...cnaesRfb, ...cnaesFallback,
    ...extrairCnaes(cnaesRadar.principal, "Principal"),
    ...extrairCnaes(cnaesRadar.secundarios, "Secundário"),
    ...extrairCnaes(Array.isArray(parseJson(radarFiscal?.cnaes)) ? parseJson(radarFiscal?.cnaes) : [], "Secundário"),
  ].filter((item, index, lista) => lista.findIndex((outro) =>
    normalizeKey(`${outro.codigo}|${outro.descricao}`) === normalizeKey(`${item.codigo}|${item.descricao}`),
  ) === index);

  const pessoas = new Map<string, PessoaEmpresaConsolidada>();
  const adicionarPessoa = (pessoa: PessoaEmpresaConsolidada) => {
    const key = normalizeKey(pessoa.nome);
    if (!key) return;
    const existente = pessoas.get(key);
    if (!existente) {
      pessoas.set(key, pessoa);
      return;
    }
    pessoas.set(key, {
      nome: existente.nome,
      funcao: existente.funcao || pessoa.funcao,
      telefone: existente.telefone || pessoa.telefone,
      email: existente.email || pessoa.email,
      dataNascimento: existente.dataNascimento || pessoa.dataNascimento,
      observacoes: existente.observacoes || pessoa.observacoes,
      fontes: uniqueStrings([...existente.fontes, ...pessoa.fontes]),
    });
  };

  const pessoasInternas = [...fontes.registrosCs.flatMap((registro) => registro.socios), ...fontes.pessoasVinculadas];
  for (const pessoa of pessoasInternas) {
    adicionarPessoa({
      nome: pessoa.nome,
      funcao: stringValue(pessoa.vinculo),
      telefone: stringValue(pessoa.telefone),
      email: null,
      dataNascimento: stringValue(pessoa.dataNascimento),
      observacoes: stringValue(pessoa.obs),
      fontes: ["CS&NPS/BPM"],
    });
  }

  const qsa = [...asArray(rfb.qsa), ...asArray(radarFiscal?.qsa)];
  for (const item of qsa) {
    const socio = asRecord(item);
    const nome = stringValue(socio.nome, socio.nome_socio, socio.razao_social);
    if (!nome) continue;
    adicionarPessoa({
      nome,
      funcao: stringValue(socio.qual, socio.qualificacao, socio.qualificacao_socio, socio.cargo),
      telefone: stringValue(socio.telefone, socio.celular),
      email: stringValue(socio.email),
      dataNascimento: stringValue(socio.data_nascimento, socio.dataNascimento),
      observacoes: null,
      fontes: ["Cartão CNPJ"],
    });
  }

  const pessoasLista = Array.from(pessoas.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const contatos: ContatoEmpresaConsolidado[] = [];
  const adicionarContato = (contato: ContatoEmpresaConsolidado) => {
    const key = normalizeKey(`${contato.tipo}|${contato.valor}|${contato.titular}`);
    if (!contato.valor || contatos.some((item) => normalizeKey(`${item.tipo}|${item.valor}|${item.titular}`) === key)) return;
    contatos.push(contato);
  };

  const titularEmpresa = stringValue(rfb.nomeFantasia, cliente.nomeFantasia, rfb.razaoSocial, cliente.razaoSocial) || "Empresa";
  const telefoneEmpresa = stringValue(rfb.telefone);
  const emailEmpresa = stringValue(rfb.email);
  if (telefoneEmpresa) adicionarContato({ tipo: "Telefone", valor: telefoneEmpresa, titular: titularEmpresa, fonte: "Cartão CNPJ" });
  if (emailEmpresa) adicionarContato({ tipo: "E-mail", valor: emailEmpresa, titular: titularEmpresa, fonte: "Cartão CNPJ" });
  for (const pessoa of pessoasLista) {
    if (pessoa.telefone) adicionarContato({ tipo: "Telefone", valor: pessoa.telefone, titular: pessoa.nome, fonte: pessoa.fontes.join(" + ") });
    if (pessoa.email) adicionarContato({ tipo: "E-mail", valor: pessoa.email, titular: pessoa.nome, fonte: pessoa.fontes.join(" + ") });
  }

  const nomeContatoPreAnalise = stringValue(fontes.preAnalise?.nomeResponsavel, extra.nomeResponsavel);
  const telefoneContatoPreAnalise = stringValue(fontes.preAnalise?.telefoneContato, extra.telefone);
  if (telefoneContatoPreAnalise) {
    adicionarContato({
      tipo: "Telefone",
      valor: telefoneContatoPreAnalise,
      titular: nomeContatoPreAnalise || "Responsável da empresa",
      fonte: "Pré-Análise",
    });
  }

  const responsaveis: ResponsavelEmpresaConsolidado[] = [];
  const adicionarResponsavel = (responsavel: ResponsavelEmpresaConsolidado) => {
    const key = normalizeKey(`${responsavel.nome}|${responsavel.papel}|${responsavel.fonte}`);
    if (!responsavel.nome || responsaveis.some((item) => normalizeKey(`${item.nome}|${item.papel}|${item.fonte}`) === key)) return;
    responsaveis.push(responsavel);
  };
  for (const registro of fontes.registrosCs) {
    const analista = stringValue(registro.analistaResponsavel);
    const closer = stringValue(registro.closerNome);
    if (analista) adicionarResponsavel({ nome: analista, papel: "Analista responsável", telefone: null, fonte: "CS&NPS" });
    if (closer) adicionarResponsavel({ nome: closer, papel: "Closer", telefone: null, fonte: "CS&NPS" });
  }
  for (const responsavel of fontes.responsaveisBpm) {
    adicionarResponsavel({ nome: responsavel.nome, papel: responsavel.papel, telefone: null, fonte: "Alpha CRM" });
  }
  if (nomeContatoPreAnalise) {
    adicionarResponsavel({
      nome: nomeContatoPreAnalise,
      papel: "Responsável da empresa",
      telefone: telefoneContatoPreAnalise,
      fonte: "Pré-Análise",
    });
  }

  return {
    empresa: {
      id: cliente.id,
      cnpj: stringValue(rfb.cnpj, cliente.cnpj) || cliente.cnpj,
      razaoSocial: stringValue(rfb.razaoSocial, cliente.razaoSocial) || cliente.razaoSocial,
      nomeFantasia: stringValue(rfb.nomeFantasia, cliente.nomeFantasia),
      situacao: stringValue(rfb.situacao, radarFiscal?.situacao_cadastral, cliente.status),
      dataConstituicao: stringValue(rfb.dataConstituicao, radarFiscal?.data_abertura, cliente.dataConstituicao),
      porte: stringValue(rfb.porte),
      naturezaJuridica: stringValue(rfb.natureza_juridica, rfb.naturezaJuridica),
      capitalSocial: numberValue(rfb.capitalSocial, fontes.preAnalise?.capitalSocial, radarFiscal?.capital_social),
      endereco: {
        logradouro: stringValue(rfb.logradouro),
        numero: stringValue(rfb.numero),
        bairro: stringValue(rfb.bairro),
        municipio: stringValue(rfb.municipio, cliente.municipio),
        uf: stringValue(rfb.uf, cliente.uf),
        cep: stringValue(rfb.cep),
      },
    },
    relacionamento: {
      status: uniqueStrings(fontes.registrosCs.map((registro) => registro.status)),
      servicos: uniqueStrings(fontes.registrosCs.map((registro) => registro.servicos)),
      analistas: uniqueStrings(fontes.registrosCs.map((registro) => registro.analistaResponsavel)),
      closers: uniqueStrings(fontes.registrosCs.map((registro) => registro.closerNome)),
      formasPagamento: uniqueStrings(fontes.registrosCs.map((registro) => registro.formaPagamento)),
      valoresContrato: fontes.registrosCs.map((registro) => registro.valorContrato).filter((valor): valor is number => typeof valor === "number"),
      datasContratacao: uniqueStrings(fontes.registrosCs.map((registro) => registro.dataContratacao)),
      datasExito: uniqueStrings(fontes.registrosCs.map((registro) => registro.dataExito)),
      origens: uniqueStrings(fontes.registrosCs.flatMap((registro) => [registro.origemLead, registro.canalAquisicao, registro.canalOutro])),
    },
    pessoas: pessoasLista,
    contatos,
    responsaveis,
    cnaes,
    regimeTributario: {
      atual: stringValue(regimeApi.regimeEA, regimeApi.regime_ea, fontes.preAnalise?.regimeEA, radarFiscal?.regime_ea, cliente.regimeTributario, rfb.regimeTributario),
      receita: stringValue(regimeApi.regimeReceita, regimeApi.regime_receita, radarFiscal?.regime_receita, rfb.regimeTributario),
      simplesNacional: booleanValue(rfb.optante_simples, asRecord(rfb.simples).optante),
      mei: booleanValue(rfb.optante_simei),
      dataOpcaoSimples: stringValue(rfb.data_opcao, regimeApi.dataOpcao, radarFiscal?.data_opcao_simples),
      dataExclusaoSimples: stringValue(rfb.data_exclusaoSimples, regimeApi.dataExclusao, radarFiscal?.data_exclusao_simples),
      historico: extrairHistorico(regimeApi.historico_regime, regimeApi.historicoRegime, radarFiscal?.historico_regime),
    },
    radar: {
      situacao: stringValue(radar.situacao, radar.status),
      submodalidade: stringValue(radar.submodalidade, fontes.preAnalise?.submodalidade),
      qualificacao: stringValue(regimeApi.qualificacao, fontes.preAnalise?.qualificacao, radarFiscal?.qualificacao),
      perse: stringValue(regimeApi.perse, radarFiscal?.perse),
      anexoPerse: stringValue(regimeApi.perse_anexo, radarFiscal?.perse_anexo),
      dividaTributaria: numberValue(regimeApi.divida_tributaria, radarFiscal?.divida_tributaria),
      consultadoEm: stringValue(radarEnvelope.consultadoEm, radarFiscal?.data_consulta),
    },
    fonteCartaoCnpj: Object.keys(rfb).length > 0 ? "Pré-Análise" : "CS&NPS",
    atualizadoEm: dataIso(fontes.preAnalise?.updatedAt),
  };
}
