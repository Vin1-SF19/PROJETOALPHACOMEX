import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { idTarefaProximoContato, sincronizarProximoContatoAgenda } from "@/lib/bpm/proximo-contato-agenda";

function clienteTarefas() {
  let registro: { prazo: Date; responsavelId: number; status: string } | null = null;
  const findUnique = vi.fn(async () => registro);
  const upsert = vi.fn(async ({ create, update }: { create: { prazo: Date; responsavelId: number; status: string }; update: { prazo: Date; responsavelId: number; status: string } }) => {
    registro = { prazo: create.prazo, responsavelId: create.responsavelId, status: create.status };
    if (upsert.mock.calls.length > 1) registro = { prazo: update.prazo, responsavelId: update.responsavelId, status: update.status };
  });
  const updateMany = vi.fn(async () => { if (registro) registro.status = "CONCLUIDA"; return { count: 1 }; });
  return { bpmTarefa: { findUnique, upsert, updateMany } };
}

describe("tarefa de Próximo Contato em Em tratativas", () => {
  it("cria uma tarefa estável, evita duplicata e reage a data, responsável e saída", async () => {
    const tx = clienteTarefas();
    const base = {
      cardId: "card-1", etapaNome: "Em tratativas", status: "ATIVO",
      proximoContatoEm: new Date("2026-09-30T15:00:00Z"), responsavelId: 7,
      empresaNome: "Empresa Teste",
    };
    await sincronizarProximoContatoAgenda(base, tx as never);
    expect(tx.bpmTarefa.upsert).toHaveBeenCalledOnce();
    expect(tx.bpmTarefa.upsert.mock.calls[0]?.[0]).toMatchObject({
      where: { id: idTarefaProximoContato(base.cardId) },
      create: { responsavelId: 7, tipo: "CRM_PROXIMO_CONTATO", status: "PENDENTE", titulo: "Próximo contato — Empresa Teste" },
    });
    await sincronizarProximoContatoAgenda(base, tx as never);
    expect(tx.bpmTarefa.upsert).toHaveBeenCalledOnce();
    await sincronizarProximoContatoAgenda({ ...base, responsavelId: 8 }, tx as never);
    expect(tx.bpmTarefa.upsert).toHaveBeenCalledTimes(2);
    await sincronizarProximoContatoAgenda({ ...base, etapaNome: "Fechado" }, tx as never);
    expect(tx.bpmTarefa.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: idTarefaProximoContato(base.cardId), status: "PENDENTE" } }));
  });
});
