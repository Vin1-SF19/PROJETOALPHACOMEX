import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: {} }));

import { carregarCamposAplicaveisCardEtapa, type CampoAplicavelEtapaBpm } from "@/lib/bpm/requisitos-etapa-server";
import { carregarOrigemMesmoCard, resolverParceiroOrigem, salvarParceiroOrigem } from "@/lib/bpm/origem-cliente-server";

// Identities observed by the audit; fixtures contain only synthetic negotiation data.
const cardId = "cmvi5ztja000007l8livtiw1o";
const origemNovoLeadId = "cmul8ww6j0005l6ihoegkoyrs";
const origemFechadoId = "cmulqa366002pmaihxlwwxy0i";
const etapaId = "draft-stage-2484d2bc-34dd-49b6-baf8-e53d58f07a83";
const pipelineId = "cmuih48la000009gmzw3wwuzf";
const campoFechado: CampoAplicavelEtapaBpm = {
  id: origemFechadoId, nome: "Origem do cliente", chave: "alpha.radar.contrato.canal_origem_do_cliente",
  tipo: "selecao", pipelineId, etapaId, opcoesJson: null, obrigatorio: false, ordem: 0,
  escopo: "CARD", valor: null, visivel: true, editavel: true, somenteLeitura: false,
};
type Valor = { campoId: string; valor: string | null; campo: { nome: string; chave: string | null } };
type Indicacao = { parceiroId: number; status: string };
let valores: Valor[];
let indicacao: Indicacao | null;
let vinculos: Array<{ cardOrigem: { empresaId: number; indicacaoOrigem: Indicacao | null } }>;
let mapeamentos: Array<{ campoOrigemId: string; campoDestinoId: string; modo: string; ativo: boolean;
  campoOrigem: { id: string; escopo: string; fonteEntidade: null; fonteAtributo: null; entidadeGlobal: null } }>;

function valor(campoId: string, texto: string | null, nome = "Canal de origem"): Valor {
  return { campoId, valor: texto, campo: { nome, chave: campoId === origemFechadoId ? campoFechado.chave ?? null : null } };
}

const client = {
  bpmCardCampoValor: { findMany: vi.fn() }, bpmCampoMapeamento: { findMany: vi.fn() },
  bpmCard: { findUnique: vi.fn() }, bpmCardHistorico: { create: vi.fn() },
  indicacao: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
};

beforeEach(() => {
  vi.resetAllMocks();
  valores = [valor(origemNovoLeadId, "Orgânico")]; indicacao = null; vinculos = []; mapeamentos = [];
  client.bpmCardCampoValor.findMany.mockImplementation(async ({ where }: { where: { cardId: string; campoId?: { in: string[] } } }) =>
    where.cardId !== cardId ? [] : valores.filter(v => !where.campoId || where.campoId.in.includes(v.campoId)));
  client.bpmCampoMapeamento.findMany.mockImplementation(async () => mapeamentos);
  client.bpmCard.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => where.id === cardId
    ? { empresaId: 3066, indicacaoOrigem: indicacao, vinculosDestino: vinculos } : null);
  client.indicacao.findUnique.mockImplementation(async ({ where }: { where: { bpmCardId: string } }) => where.bpmCardId === cardId ? indicacao : null);
});

async function campo() {
  const result = await carregarCamposAplicaveisCardEtapa(cardId, pipelineId, etapaId, client as never, undefined, [campoFechado]);
  expect(result).toHaveLength(1);
  return result[0];
}

function mapearDe(id: string) {
  mapeamentos = [{ campoOrigemId: id, campoDestinoId: origemFechadoId, modo: "COPIAR", ativo: true,
    campoOrigem: { id, escopo: "CARD", fonteEntidade: null, fonteAtributo: null, entidadeGlobal: null } }];
}

describe("origem do Novo Lead no fechamento da mesma negociação", () => {
  it.each(["Orgânico", "WhatsApp", "Feira de negócios — canal personalizado"])("reapresenta %s sem fingir uma gravação do campo destino", async (origem) => {
    valores = [valor(origemNovoLeadId, origem)];
    expect(await campo()).toMatchObject({ id: origemFechadoId, valor: origem });
    expect(valores.some(v => v.campoId === origemFechadoId)).toBe(false);
    expect(client.bpmCardHistorico.create).not.toHaveBeenCalled(); expect(client.indicacao.create).not.toHaveBeenCalled();
    expect(client.bpmCardCampoValor.findMany.mock.calls.every(([arg]) => arg.where.cardId === cardId)).toBe(true);
  });
  it.each(["", "Instagram"])("preserva escolha posterior explícita, inclusive limpeza: %j", async (escolha) => {
    valores.push(valor(origemFechadoId, escolha, "Origem do cliente"));
    expect((await campo()).valor).toBe(escolha);
  });
  it.each(["", "Evento"])("mapeamento existente precede fallback legado: %j", async (escolha) => {
    const fonte = "cmumx32p90005ezih6tcqr5vq";
    valores.push(valor(fonte, escolha, "Origem configurada")); mapearDe(fonte);
    expect(await campo()).toMatchObject({ valor: escolha, campoOrigemId: fonte, mapeamentoModo: "COPIAR" });
  });
  it("escolha do destino prevalece também sobre um mapeamento ativo", async () => {
    valores.push(valor(origemFechadoId, "WhatsApp", "Origem do cliente")); mapearDe(origemNovoLeadId);
    expect((await campo()).valor).toBe("WhatsApp");
  });
  it("não escolhe silenciosamente entre aliases legados contraditórios", async () => {
    valores.push(valor("origem-alternativa", "Indicação Cliente", "Origem do lead"));
    expect(await carregarOrigemMesmoCard(cardId, client as never)).toBeNull();
    expect((await campo()).valor).toBeNull();
  });
  it("aliases concordantes e espaços nas bordas não tornam a origem ambígua", async () => {
    valores = [valor(origemNovoLeadId, " Orgânico "), valor("origem-alternativa", "Orgânico", "Origem do lead")];
    expect((await campo()).valor).toBe("Orgânico");
  });
  it("não usa campo de outro conceito como origem nem consulta outros cards", async () => {
    valores = [valor("qualificacao", "Orgânico", "Qualificação")];
    expect((await campo()).valor).toBeNull();
    expect(await carregarOrigemMesmoCard("outro-card", client as never)).toBeNull();
    expect(client.bpmCardCampoValor.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { cardId: "outro-card", campo: { ativo: true } } }));
  });
  it.each([null, "", "   "])("ausência real de origem permanece vazia: %j", async (origem) => {
    valores = [valor(origemNovoLeadId, origem)];
    expect((await campo()).valor).toBeNull();
  });
});

describe("parceiro herdado pertence à mesma empresa e não duplica indicação", () => {
  beforeEach(() => { valores = [valor(origemNovoLeadId, "Indicação Parceiro")]; });
  const vinculo = (empresaId: number, parceiroId: number, status = "ATIVA") => ({ cardOrigem: {
    empresaId, indicacaoOrigem: { parceiroId, status },
  } });

  it("reapresenta parceiro da própria indicação e não de outra origem", async () => {
    indicacao = { parceiroId: 7, status: "ATIVA" }; vinculos = [vinculo(3066, 9)];
    expect(await campo()).toMatchObject({ valor: "Indicação Parceiro", parceiroOrigemId: 7 });
  });
  it("herda parceiro único de negociação vinculada da mesma empresa", async () => {
    vinculos = [vinculo(3066, 7), vinculo(3066, 7)];
    expect(await campo()).toMatchObject({ valor: "Indicação Parceiro", parceiroOrigemId: 7 });
    expect(await resolverParceiroOrigem(undefined, [campoFechado], { [origemFechadoId]: "Indicação Parceiro" }, cardId, client as never))
      .toEqual({ campoId: origemFechadoId, parceiroId: 7 });
  });
  it.each(["outro-cliente", "inativa", "divergente"])("não adota parceiro indevido: %s", async (caso) => {
    vinculos = caso === "outro-cliente" ? [vinculo(9999, 7)] : caso === "inativa" ? [vinculo(3066, 7, "DESVINCULADA")]
      : [vinculo(3066, 7), vinculo(3066, 9)];
    expect((await campo()).parceiroOrigemId).toBeNull();
    expect(await resolverParceiroOrigem(undefined, [campoFechado], { [origemFechadoId]: "Indicação Parceiro" }, cardId, client as never))
      .toEqual({ campoId: origemFechadoId, parceiroId: null });
  });
  it("salvar a origem herdada não cria nova indicação/comissão no destino", async () => {
    vinculos = [vinculo(3066, 7)];
    await salvarParceiroOrigem({ campoId: origemFechadoId, parceiroId: 7 }, { id: cardId, empresaId: 3066, servico: "Radar" }, 1, client as never);
    expect(client.indicacao.create).not.toHaveBeenCalled(); expect(client.indicacao.update).not.toHaveBeenCalled();
    expect(client.bpmCardHistorico.create).not.toHaveBeenCalled();
  });
  it("troca de parceiro herdado não altera nem duplica a indicação da negociação", async () => {
    vinculos = [vinculo(3066, 7)];
    await expect(salvarParceiroOrigem({ campoId: origemFechadoId, parceiroId: 9 }, { id: cardId, empresaId: 3066, servico: "Radar" }, 1, client as never))
      .rejects.toThrow("Altere o parceiro no card comercial de origem");
    expect(client.indicacao.create).not.toHaveBeenCalled(); expect(client.indicacao.update).not.toHaveBeenCalled();
  });
});
