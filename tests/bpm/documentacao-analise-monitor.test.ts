import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  habilitado: vi.fn(), cards: vi.fn(), historico: vi.fn(), criarTarefa: vi.fn(), atualizarTarefas: vi.fn(),
  materializar: vi.fn(), notificar: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmFormularioComponente: { findFirst: mocks.habilitado },
  bpmCard: { findMany: mocks.cards },
  bpmCardHistorico: { findFirst: mocks.historico },
  bpmTarefa: { create: mocks.criarTarefa, updateMany: mocks.atualizarTarefas },
} }));
vi.mock("@/lib/bpm/checklists/service", () => ({ materializarChecklistsAplicaveisCard: mocks.materializar }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: mocks.notificar }));

import { monitorarDocumentacaoEmAnalise } from "@/lib/bpm/documentacao-analise-monitor";

describe("monitor documental", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.habilitado.mockResolvedValue({ id: "form-checklist" });
    mocks.historico.mockResolvedValue(null);
    mocks.atualizarTarefas.mockResolvedValue({ count: 0 });
    mocks.materializar.mockResolvedValue({ checklists: [] });
    mocks.notificar.mockResolvedValue(undefined);
  });

  it("percorre além de 200 cards e não duplica o alerta semanal ao reexecutar", async () => {
    const cards = Array.from({ length: 201 }, (_, indice) => ({
      id: `card-${String(indice).padStart(3, "0")}`, responsavelId: 7,
      createdAt: new Date("2026-09-01T12:00:00.000Z"),
    }));
    mocks.cards.mockImplementation(({ cursor }: { cursor?: { id: string } }) => {
      const indice = cursor ? cards.findIndex((card) => card.id === cursor.id) + 1 : 0;
      return Promise.resolve(cards.slice(indice, indice + 200));
    });
    const ids = new Set<string>();
    mocks.criarTarefa.mockImplementation(({ data }: { data: { id: string } }) => {
      if (ids.has(data.id)) throw new Prisma.PrismaClientKnownRequestError("duplicado", {
        code: "P2002", clientVersion: "6.19.3",
      });
      ids.add(data.id);
      return Promise.resolve({ id: data.id });
    });
    const agora = new Date("2026-09-15T12:00:00.000Z");

    expect(await monitorarDocumentacaoEmAnalise(agora)).toEqual({ cards: 201, pendencias: 0, atualizacoes: 201 });
    expect(await monitorarDocumentacaoEmAnalise(agora)).toEqual({ cards: 201, pendencias: 0, atualizacoes: 0 });
    expect(ids.size).toBe(201);
    expect(mocks.notificar).toHaveBeenCalledTimes(201);
  });
});
