import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const historico = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: historico }));

import {
  inspecionarTarefaChecklist,
  reconciliarTarefaChecklist,
} from "@/lib/bpm/checklists/reconciliacao-tarefa";

const checklistBase = {
  id: "checklist-1",
  cardId: "card-1",
  templateNome: "Documentos de embarque",
  card: { pipelineId: "pipeline-1", responsavelId: 7 },
  itens: [
    { id: "item-1", status: "PENDENTE", responsavelId: 9 },
    { id: "item-2", status: "PENDENTE", responsavelId: null },
  ],
};

function client(params?: { checklist?: typeof checklistBase | null; tarefa?: Record<string, unknown> | null }) {
  const checklist = params && "checklist" in params ? params.checklist : checklistBase;
  const tarefa = params && "tarefa" in params ? params.tarefa : null;
  return {
    bpmCardChecklist: { findUnique: vi.fn().mockResolvedValue(checklist) },
    bpmTarefa: {
      findUnique: vi.fn().mockResolvedValue(tarefa),
      create: vi.fn().mockResolvedValue({ id: "tarefa-1" }),
      update: vi.fn().mockResolvedValue({ id: "tarefa-1" }),
    },
    bpmCardHistorico: { create: vi.fn() },
  };
}

describe("reconciliação checklist → tarefa", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cria uma única tarefa pendente com origem e responsável derivados", async () => {
    const tx = client();
    const resultado = await reconciliarTarefaChecklist({ checklistId: "checklist-1", usuarioId: 5 }, tx as never);

    expect(resultado).toMatchObject({ acao: "CRIADA", tarefaId: "tarefa-1", status: "PENDENTE" });
    expect(tx.bpmTarefa.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        cardChecklistId: "checklist-1",
        titulo: "Checklist: Documentos de embarque",
        tipo: "CHECKLIST",
        status: "PENDENTE",
        responsavelId: 9,
      }),
    }));
    expect(historico).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(historico.mock.calls)).not.toContain("observacao");
  });

  it("é idempotente e não grava histórico quando o estado já coincide", async () => {
    const tx = client({
      tarefa: {
        id: "tarefa-1", cardId: "card-1", titulo: "Checklist: Documentos de embarque",
        tipo: "CHECKLIST", status: "PENDENTE", responsavelId: 9, concluidaEm: null,
      },
    });
    await expect(reconciliarTarefaChecklist({ checklistId: "checklist-1" }, tx as never))
      .resolves.toMatchObject({ acao: "IGNORADA", motivo: "SEM_ALTERACAO" });
    expect(tx.bpmTarefa.create).not.toHaveBeenCalled();
    expect(tx.bpmTarefa.update).not.toHaveBeenCalled();
    expect(historico).not.toHaveBeenCalled();
  });

  it("conclui e reabre a mesma tarefa conforme os itens", async () => {
    const concluido = client({
      checklist: { ...checklistBase, itens: checklistBase.itens.map((item) => ({ ...item, status: "CONCLUIDO" })) },
      tarefa: {
        id: "tarefa-1", cardId: "card-1", titulo: "Checklist: Documentos de embarque",
        tipo: "CHECKLIST", status: "PENDENTE", responsavelId: 7, concluidaEm: null,
      },
    });
    const agora = new Date("2026-09-08T14:30:00Z");
    await expect(reconciliarTarefaChecklist({ checklistId: "checklist-1", agora }, concluido as never))
      .resolves.toMatchObject({ acao: "CONCLUIDA", tarefaId: "tarefa-1" });
    expect(concluido.bpmTarefa.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CONCLUIDA", concluidaEm: agora }),
    }));

    const reaberto = client({
      tarefa: {
        id: "tarefa-1", cardId: "card-1", titulo: "Checklist: Documentos de embarque",
        tipo: "CHECKLIST", status: "CONCLUIDA", responsavelId: 9, concluidaEm: agora,
      },
    });
    await expect(reconciliarTarefaChecklist({ checklistId: "checklist-1" }, reaberto as never))
      .resolves.toMatchObject({ acao: "REABERTA", tarefaId: "tarefa-1" });
    expect(reaberto.bpmTarefa.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PENDENTE", concluidaEm: null }),
    }));
  });

  it("preserva campos não gerenciados ao sincronizar responsável", async () => {
    const tx = client({
      tarefa: {
        id: "tarefa-1", cardId: "card-1", titulo: "Checklist: Documentos de embarque",
        tipo: "CHECKLIST", status: "PENDENTE", responsavelId: 7, concluidaEm: null,
      },
    });
    await reconciliarTarefaChecklist({ checklistId: "checklist-1" }, tx as never);
    const data = tx.bpmTarefa.update.mock.calls[0][0].data;
    expect(data.responsavel).toEqual({ connect: { id: 9 } });
    expect(data).not.toHaveProperty("descricao");
    expect(data).not.toHaveProperty("prioridade");
    expect(data).not.toHaveProperty("prazo");
  });

  it("trata checklist ausente como ignorado e o dry-run não escreve", async () => {
    const tx = client({ checklist: null });
    await expect(inspecionarTarefaChecklist("ausente", tx as never))
      .resolves.toMatchObject({ acao: "IGNORADA", motivo: "CHECKLIST_NAO_ENCONTRADO" });
    expect(tx.bpmTarefa.create).not.toHaveBeenCalled();
    expect(historico).not.toHaveBeenCalled();
  });

  it("resolve colisão P2002 pelo vínculo único sem duplicar", async () => {
    const tx = client();
    const concorrente = {
      id: "tarefa-concorrente", cardId: "card-1", titulo: "Checklist: Documentos de embarque",
      tipo: "CHECKLIST", status: "PENDENTE", responsavelId: 9, concluidaEm: null,
    };
    tx.bpmTarefa.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(concorrente);
    tx.bpmTarefa.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("unique", {
      code: "P2002",
      clientVersion: Prisma.prismaVersion.client,
    }));

    await expect(reconciliarTarefaChecklist({ checklistId: "checklist-1" }, tx as never))
      .resolves.toMatchObject({ acao: "IGNORADA", tarefaId: "tarefa-concorrente" });
    expect(tx.bpmTarefa.create).toHaveBeenCalledTimes(1);
    expect(tx.bpmTarefa.update).not.toHaveBeenCalled();
  });
});
