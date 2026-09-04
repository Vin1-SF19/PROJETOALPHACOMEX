import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  condicaoDistribuicaoAtendida,
  selecionarResponsavelDistribuicao,
  type CandidatoDistribuicao,
} from "@/lib/bpm/automacoes/distribuicao-motor";
import {
  enfileirarAutomacoesCriacaoCardBpm,
  enfileirarAutomacoesCriacaoTarefaBpm,
  enfileirarAutomacoesDeferimentoBpm,
} from "@/lib/bpm/automacoes/fila";
import { salvarAutomacaoBpmSchema } from "@/lib/bpm/automacoes/schemas";

const PIPELINE_ID = "clw0000000000000pipeline";
const ETAPA_ID = "clw000000000000000etapa";

const candidatos: CandidatoDistribuicao[] = [
  { id: 10, nome: "Ana", ativo: true, elegivel: true, cargaCards: 3, cargaTarefas: 1 },
  { id: 20, nome: "Bia", ativo: true, elegivel: true, cargaCards: 1, cargaTarefas: 1 },
  { id: 30, nome: "Caio", ativo: false, elegivel: false, cargaCards: 0, cargaTarefas: 0, motivoExclusao: "Usuário inativo" },
];

function base(acaoTipo: string, parametros: unknown, gatilhoTipo = "CARD_CRIADO") {
  return {
    pipelineId: PIPELINE_ID,
    etapaId: ETAPA_ID,
    nome: "Regra automática",
    gatilhoTipo,
    tempoMinutos: null,
    acaoTipo,
    parametros,
    ativa: true,
  };
}

describe("motor de distribuição", () => {
  it("alterna round-robin somente entre candidatos ativos e elegíveis", () => {
    expect(selecionarResponsavelDistribuicao({ estrategia: "ROUND_ROBIN", candidatos, cursor: 0 }).selecionadoId).toBe(10);
    expect(selecionarResponsavelDistribuicao({ estrategia: "ROUND_ROBIN", candidatos, cursor: 1 }).selecionadoId).toBe(20);
    expect(selecionarResponsavelDistribuicao({ estrategia: "ROUND_ROBIN", candidatos, cursor: 2 }).selecionadoId).toBe(10);
  });

  it("seleciona menor carga e desempata pelo id", () => {
    expect(selecionarResponsavelDistribuicao({ estrategia: "MENOR_CARGA", candidatos }).selecionadoId).toBe(20);
    const empate = candidatos.map((item) => ({ ...item, cargaCards: item.ativo ? 1 : 0, cargaTarefas: 0 }));
    expect(selecionarResponsavelDistribuicao({ estrategia: "MENOR_CARGA", candidatos: empate }).selecionadoId).toBe(10);
  });

  it("não atribui responsável fixo removido, inativo ou sem permissão", () => {
    const resultado = selecionarResponsavelDistribuicao({
      estrategia: "RESPONSAVEL_FIXO",
      candidatos,
      responsavelFixoId: 30,
    });
    expect(resultado.aplicado).toBe(false);
    expect(resultado.motivo).toContain("indisponível");
  });

  it("compõe serviço, região, origem e parceiro pelo Motor de Regras", () => {
    const atendida = condicaoDistribuicaoAtendida({
      operador: "AND",
      condicoes: [
        { tipo: "condicao", campo: { fonte: "card", campo: "servico" }, operador: "igual", valor: "Radar" },
        { tipo: "condicao", campo: { fonte: "cliente", campo: "uf" }, operador: "igual", valor: "SP" },
        { tipo: "condicao", campo: { fonte: "contratacao", campo: "origemLead" }, operador: "igual", valor: "Evento" },
        { tipo: "condicao", campo: { fonte: "contratacao", campo: "indicadoPorParceiroId" }, operador: "igual", valor: 42 },
      ],
    }, {
      card: { servico: "Radar" },
      cliente: { uf: "SP" },
      contratacao: { origemLead: "Evento", indicadoPorParceiroId: 42 },
    });
    expect(atendida).toBe(true);
  });
});

describe("contratos configuráveis", () => {
  it("valida distribuição de card com prioridade, condição e catálogo de candidatos", () => {
    const resultado = salvarAutomacaoBpmSchema.safeParse(base("DISTRIBUIR_RESPONSAVEL", {
      versao: 1,
      prioridade: 2,
      entidade: "CARD",
      estrategia: "ROUND_ROBIN",
      candidatosIds: [10, 20],
      condicao: { operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "cliente", campo: "uf" }, operador: "igual", valor: "SP" }] },
    }));
    expect(resultado.success).toBe(true);
  });

  it("rejeita gatilho incompatível com distribuição de tarefa", () => {
    const resultado = salvarAutomacaoBpmSchema.safeParse(base("DISTRIBUIR_RESPONSAVEL", {
      entidade: "TAREFA",
      estrategia: "ROUND_ROBIN",
      candidatosIds: [10],
    }, "CARD_CRIADO"));
    expect(resultado.success).toBe(false);
  });

  it("persiste serviço alvo por id e uma ação registrada, sem nome hardcoded", () => {
    const resultado = salvarAutomacaoBpmSchema.safeParse(base("IDENTIFICAR_OPORTUNIDADE", {
      servicoAlvoId: 77,
      condicao: { operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "contratacao", campo: "status" }, operador: "igual", valor: "Deferido" }] },
      acao: { tipo: "CRIAR_TAREFA", titulo: "Contatar cliente", responsavelId: null, prazoDias: 1 },
    }, "PROCESSO_DEFERIDO"));
    expect(resultado.success).toBe(true);
    if (resultado.success && resultado.data.acaoTipo === "IDENTIFICAR_OPORTUNIDADE") {
      expect(resultado.data.parametros.servicoAlvoId).toBe(77);
    }
  });
});

describe("gatilhos duráveis", () => {
  function client() {
    return {
      bpmAutomacao: { findMany: vi.fn().mockResolvedValue([{ id: "auto-1" }]) },
      bpmAutomacaoExecucao: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "exec-1" }),
      },
      bpmCard: {
        findMany: vi.fn().mockResolvedValue([{ id: "card-1", pipelineId: PIPELINE_ID, etapaId: ETAPA_ID }]),
      },
    };
  }

  it("grava eventos idempotentes de card e tarefa", async () => {
    const banco = client();
    await enfileirarAutomacoesCriacaoCardBpm({ cardId: "card-1", pipelineId: PIPELINE_ID, etapaId: ETAPA_ID }, banco as never);
    await enfileirarAutomacoesCriacaoTarefaBpm({ tarefaId: "task-1", cardId: "card-1", pipelineId: PIPELINE_ID, etapaId: ETAPA_ID }, banco as never);
    expect(banco.bpmAutomacaoExecucao.create).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({ eventoChave: "CARD:card-1:CRIADO" }) });
    expect(banco.bpmAutomacaoExecucao.create).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({ eventoChave: "TAREFA:task-1:CRIADA" }) });
  });

  it("grava o evento real de deferimento para reavaliação segura", async () => {
    const banco = client();
    const total = await enfileirarAutomacoesDeferimentoBpm({ clienteId: 1, clienteServicoId: 88, servico: "Radar" }, banco as never);
    expect(total).toBe(1);
    expect(banco.bpmAutomacaoExecucao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventoChave: "DEFERIMENTO:88", gatilhoTipo: "PROCESSO_DEFERIDO" }),
    });
  });
});
