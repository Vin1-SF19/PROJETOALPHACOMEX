import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { materializarExecucoesEventosBpm } from "@/lib/bpm/automacoes/eventos";
import { obterStatusSla } from "@/lib/bpm/sla";
import { calcularTempoRestanteVisual } from "@/components/bpm/sla/SlaStatusBadge";

const CARD_ID = "cm12345678901234567890123";
const PIPELINE_ID = "cm12345678901234567890124";

describe("alertas visuais e automação de SLA", () => {
  it("congela o contador visual durante a pausa e usa o deadline quando ativo", () => {
    const agora = new Date("2026-09-04T12:00:00.000Z").getTime();
    expect(calcularTempoRestanteVisual({
      deadline: "2026-09-04T13:00:00.000Z",
      tempoRestanteMs: 3_600_000,
      pausadoEm: null,
    }, agora)).toBe(3_600_000);
    expect(calcularTempoRestanteVisual({
      deadline: "2026-09-04T13:00:00.000Z",
      tempoRestanteMs: 900_000,
      pausadoEm: "2026-09-04T11:45:00.000Z",
    }, agora)).toBe(900_000);
  });

  it("persiste a transição, o disparo idempotente e o evento de domínio ao vencer", async () => {
    const agora = new Date("2026-09-04T12:00:01.000Z");
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const update = vi.fn().mockResolvedValue({});
    const criarLog = vi.fn().mockResolvedValue({ id: "evento-sla-1" });
    const criarDisparo = vi.fn().mockResolvedValue({ id: "disparo-1" });
    const criarEventoDominio = vi.fn().mockResolvedValue({ id: "dominio-1" });
    const client = {
      bpmSlaInstancia: {
        findMany: vi.fn().mockResolvedValue([{
          id: "sla-1",
          cardId: CARD_ID,
          tarefaId: null,
          slaConfigId: "config-1",
          status: "DENTRO_PRAZO",
          statusAnterior: null,
          inicioContagem: new Date("2026-09-04T10:00:00.000Z"),
          prazoFinal: new Date("2026-09-04T12:00:00.000Z"),
          deadline: new Date("2026-09-04T12:00:00.000Z"),
          pausadoEm: null,
          concluidoEm: null,
          vencidoEm: null,
          updatedAt: new Date("2026-09-04T10:00:00.000Z"),
          card: { pipelineId: PIPELINE_ID },
          eventos: [],
          slaConfig: {
            nome: "Prazo fiscal",
            alertaLimites: [{
              ativo: true,
              cor: "VERMELHO",
              ordem: 2,
              statusResultante: "ATRASADO",
              tipoLimite: "ATRASO",
              unidade: "MINUTOS",
              valor: 0,
            }],
          },
        }]),
        updateMany,
        update,
      },
      bpmSlaEventoLog: { create: criarLog },
      bpmSlaDisparo: { create: criarDisparo },
      bpmEventoDominio: { create: criarEventoDominio, findUnique: vi.fn() },
    };

    const resultado = await obterStatusSla({ cardId: CARD_ID }, client as never, agora);

    expect(resultado[0]).toMatchObject({ status: "ATRASADO", cor: "VERMELHO", statusAlterado: true });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "ATRASADO", statusAnterior: "DENTRO_PRAZO" }),
    }));
    expect(criarDisparo).toHaveBeenCalledWith({ data: expect.objectContaining({ tipoDisparo: "ALERTA_VENCIDO" }) });
    expect(criarEventoDominio).toHaveBeenCalledWith({ data: expect.objectContaining({
      tipo: "SLA_STATUS_ALTERADO",
      entidadeTipo: "SLA",
      cardId: CARD_ID,
      pipelineId: PIPELINE_ID,
    }) });
  });

  it("materializa automação filtrada para SLA atrasado", async () => {
    const criarExecucao = vi.fn().mockResolvedValue({ id: "execucao-1" });
    const client = {
      bpmEventoDominio: {
        findMany: vi.fn().mockResolvedValue([{
          id: "evento-1",
          tipo: "SLA_STATUS_ALTERADO",
          cardId: CARD_ID,
          pipelineId: PIPELINE_ID,
          correlationId: "sla:sla-1",
          causationId: null,
          profundidade: 0,
          valorAnteriorJson: JSON.stringify({ status: "PROXIMO_VENCIMENTO" }),
          valorNovoJson: JSON.stringify({ status: "ATRASADO" }),
        }]),
      },
      bpmAutomacaoVersao: {
        findMany: vi.fn().mockResolvedValue([{
          id: "versao-1",
          automacaoId: "automacao-1",
          gatilhoTipo: "SLA_STATUS_ALTERADO",
          gatilhoConfigJson: JSON.stringify({ slaStatus: "ATRASADO" }),
          automacao: { etapaId: "etapa-1" },
        }]),
      },
      bpmAutomacaoExecucao: { findFirst: vi.fn().mockResolvedValue(null), create: criarExecucao },
    };

    const resultado = await materializarExecucoesEventosBpm(100, client as never);
    expect(resultado.criadas).toBe(1);
    expect(criarExecucao).toHaveBeenCalledWith({ data: expect.objectContaining({
      gatilhoTipo: "SLA_STATUS_ALTERADO",
      cardId: CARD_ID,
      eventoId: "evento-1",
    }) });
  });

  it("está conectado ao Kanban, ao card aberto e ao realtime", () => {
    const board = readFileSync(resolve(process.cwd(), "src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx"), "utf8");
    const layout = readFileSync(resolve(process.cwd(), "src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx"), "utf8");
    const realtime = readFileSync(resolve(process.cwd(), "src/lib/bpm/realtime.ts"), "utf8");
    expect(board).toContain("<SlaStatusBadge sla={card.sla}");
    expect(board).toContain('card.sla?.status === "ATRASADO"');
    expect(layout).toContain("<PainelSlaCard cardId={card.id}");
    expect(realtime).toContain('"SLA_STATUS_ALTERADO"');
  });

  it("liga todos os momentos configuráveis aos fluxos transacionais reais", () => {
    const cards = readFileSync(resolve(process.cwd(), "src/actions/bpm/Cards.ts"), "utf8");
    const tarefas = readFileSync(resolve(process.cwd(), "src/actions/bpm/Tarefas.ts"), "utf8");
    expect(cards).toContain('"CRIACAO_CARD", tx, novoCard.createdAt');
    expect(cards).toContain('"PRIMEIRA_VISUALIZACAO", tx, agora');
    expect(tarefas).toContain('"CRIACAO_TAREFA", tx, criada.createdAt');
    expect(tarefas).toContain('"TAREFA_CONCLUIDA", tx');
  });
});
