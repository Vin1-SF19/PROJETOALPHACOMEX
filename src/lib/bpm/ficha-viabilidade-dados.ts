import type { FichaAlphaDados, FichaAlphaViabilidade } from "@/components/GerarFicha";
import { transcricaoRealRegistrada } from "@/lib/bpm/reuniao-agendada";

type PessoaFicha = { principal: boolean; pessoa: { nome: string; celular: string; email: string | null; telefoneExtra: string | null } };
type CampoFicha = { id: string; chave: string | null; nome: string };

export type CardFonteFicha = {
  id: string;
  dataReuniao: Date | null;
  transcricaoReuniao: string | null;
  responsavel: { nome: string };
  empresa: {
    razaoSocial: string; nomeFantasia: string | null; cnpj: string | null;
    uf: string | null; dataConstituicao: string | null;
    capitalSocial: string | null; regimeTributario: string | null;
    pessoas: PessoaFicha[];
  };
  reunioes: Array<{ emailCliente: string | null }>;
  campoValores: Array<{ campoId: string; valor: string | null }>;
};

export type ConsultaFonteFicha = {
  cnpj: string; regimeEA: string | null; submodalidade: string | null;
  situacao: string | null; capitalSocial: number | null;
  nomeResponsavel: string | null; telefoneContato: string | null;
  observacoes: string | null; dadosBrutos: unknown;
} | null;

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function primeiro(...valores: unknown[]): string {
  return valores.map(texto).find(Boolean) ?? "";
}

function dataBr(valor: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : valor;
}

function valorCapital(valor: string | null, fallback: number | null): number | undefined {
  if (!valor?.trim()) return fallback ?? undefined;
  const limpo = valor.replace(/[^\d,.-]/g, "");
  const numero = Number(limpo.includes(",") ? limpo.replaceAll(".", "").replace(",", ".") : limpo);
  return Number.isFinite(numero) ? numero : fallback ?? undefined;
}

export function montarFichaAlphaDoCard(params: {
  card: CardFonteFicha;
  campos: CampoFicha[];
  consulta: ConsultaFonteFicha;
}): { dados: FichaAlphaDados; userLogado: string } {
  const { card, campos } = params;
  const cnpj = card.empresa.cnpj?.replace(/\D/g, "") ?? "";
  // Consulta de Pré-Análise só complementa a empresa do próprio card.
  const consulta = cnpj && params.consulta?.cnpj.replace(/\D/g, "") === cnpj ? params.consulta : null;
  const bruto = objeto(consulta?.dadosBrutos);
  const rfbRaiz = objeto(bruto.rfb);
  const rfb = objeto(rfbRaiz.dados ?? bruto.rfb);
  const radarRaiz = objeto(bruto.radar);
  const radar = objeto(radarRaiz.dados ?? bruto.radar);
  const empresaquiRaiz = objeto(bruto.empresaqui);
  const empresaqui = objeto(empresaquiRaiz.dados ?? bruto.empresaqui);
  const extra = objeto(bruto.extra);
  const valores = new Map(card.campoValores.map(({ campoId, valor }) => [campoId, texto(valor)]));
  const valor = (slug: string, nome: string) => {
    const campo = campos.find((item) => item.chave === `alpha.radar.viabilidade.${slug}`)
      ?? campos.find((item) => item.nome === nome);
    return campo ? valores.get(campo.id) ?? "" : "";
  };
  const valorPorNome = (...nomes: string[]) => {
    const campo = campos.find((item) => nomes.includes(item.nome));
    return campo ? valores.get(campo.id) ?? "" : "";
  };
  const pessoa = card.empresa.pessoas.find((item) => item.principal)?.pessoa
    ?? card.empresa.pessoas[0]?.pessoa;
  const dataReuniao = card.dataReuniao;
  const formatadorData = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
  const formatadorHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false });
  const resumo = valor("resumo_reuniao", "Resumo da reunião");
  const valorAcordado = valor("valor_acordado", "Valor acordado no contrato");
  const valorNumerico = Number(valorAcordado.replace(",", "."));
  const viabilidade: FichaAlphaViabilidade = {
    radarPretendido: valor("radar_pretendido", "Radar pretendido"),
    faturamento5Anos: valor("faturamento_5_anos", "Faturamento nos últimos 5 anos"),
    armazenamento: valor("armazenamento", "Armazenamento"),
    faturasTitularidade: valor("faturas_titularidade", "Faturas sob titularidade da empresa"),
    atuacaoEmpresa: valor("atuacao_empresa", "Atuação da empresa"),
    tributosSemestre: valor("tributos_semestre", "Tributos pagos no último semestre"),
    valorAcordado: valorAcordado && Number.isFinite(valorNumerico)
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorNumerico)
      : valorAcordado,
    formaPagamento: valor("forma_pagamento", "Forma de pagamento"),
    exportador: valor("exportador", "Exportador"),
    complexidade: valor("complexidade_revisao", "Nível de complexidade da revisão"),
    historicoTentativas: valor("historico_tentativas", "Histórico de tentativas anteriores"),
    embasamento: valor("embasamento_processo", "Embasamento do processo"),
    resumoReuniao: resumo,
    transcricaoRegistrada: transcricaoRealRegistrada(card.transcricaoReuniao),
  };
  const dados: FichaAlphaDados = {
    rfb: { dados: {
      razaoSocial: card.empresa.razaoSocial,
      nomeFantasia: primeiro(card.empresa.nomeFantasia, rfb.nomeFantasia),
      cnpj: card.empresa.cnpj ?? "",
      uf: primeiro(card.empresa.uf, rfb.uf),
      dataConstituicao: dataBr(primeiro(card.empresa.dataConstituicao, rfb.dataConstituicao)),
      capitalSocial: valorCapital(card.empresa.capitalSocial, consulta?.capitalSocial ?? null),
      natureza_juridica: texto(rfb.natureza_juridica),
    } },
    radar: {
      situacao: primeiro(radar.situacao, consulta?.situacao),
      submodalidade: primeiro(radar.submodalidade, consulta?.submodalidade),
    },
    empresaqui: { dados: { regimeEA: primeiro(card.empresa.regimeTributario, empresaqui.regimeEA, consulta?.regimeEA) } },
    extra: {
      nomeResponsavel: primeiro(valorPorNome("Nome do responsável"), pessoa?.nome, extra.nomeResponsavel, consulta?.nomeResponsavel),
      telefone: primeiro(pessoa?.celular, pessoa?.telefoneExtra, extra.telefone, consulta?.telefoneContato),
      email: primeiro(pessoa?.email, card.reunioes[0]?.emailCliente, extra.email),
      dataSituacao: dataReuniao ? formatadorData.format(dataReuniao) : primeiro(extra.dataSituacao),
      horaSituacao: dataReuniao ? formatadorHora.format(dataReuniao) : primeiro(extra.horaSituacao),
      mesProtocolo: dataBr(primeiro(valor("mes_protocolar", "Mês para protocolar"), extra.mesProtocolo)),
      origemLead: primeiro(valorPorNome("Canal de origem", "Canal/origem do cliente", "Origem do cliente"), extra.origemLead),
      origemLeadDetalhe: texto(extra.origemLeadDetalhe),
      observacoes: primeiro(resumo, extra.observacoes, consulta?.observacoes),
    },
    viabilidade,
  };
  return { dados, userLogado: card.responsavel.nome };
}
