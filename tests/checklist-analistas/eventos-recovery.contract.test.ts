import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { criarFixtureChecklist } from "./sqlite-fixture";
const state = vi.hoisted(() => ({ db: undefined as unknown as PrismaClient }));
vi.mock("@/lib/prisma", () => ({ get default() { return state.db; } }));
vi.mock("../../auth", () => ({ auth: vi.fn() }));
import { atualizarItem } from "@/lib/checklist/service";
import { listarEventos, marcarEventoLido } from "@/lib/checklist/eventos";
import { checklistPaginaEventosSchema } from "@/lib/checklist/client/notificacoes";
let fixture: Awaited<ReturnType<typeof criarFixtureChecklist>>;
const owner = { kind: "INTERNO", id: 1, sessionVersion: 0 } as const;
beforeAll(async () => { fixture = await criarFixtureChecklist(); state.db = fixture.db; }, 30000);
afterAll(async () => { await fixture?.close(); });

describe.sequential("recovery — produtor SQLite real → contrato do poller", () => {
  it("evento de edição real é aceito pelo mesmo parser usado no shell", async () => {
    const f = await fixture.atendimento();
    await atualizarItem(owner, { itemId: f.item.id, expectedRevision: 0, mutationId: randomUUID(), patch: { status: "OK" } });
    const page = await listarEventos(owner, { somenteNaoLidos: true });
    expect(page.items.some((event) => event.empresaId === f.empresa.id)).toBe(true);
    const wirePage = JSON.parse(JSON.stringify(page));
    expect(checklistPaginaEventosSchema.safeParse(wirePage).success).toBe(true);
  });
  it("cursor recupera mais de50 eventos JSON sem perdas e leitura durável remove somente o evento confirmado", async () => {
    const f = await fixture.atendimento();
    const stamp = new Date("2026-10-22T12:00:00.000Z");
    await state.db.checklistEvento.createMany({ data: Array.from({ length: 61 }, (_, index) => ({ id: `synthetic-recovery-${String(index).padStart(3, "0")}`, mutationId: randomUUID(), payloadHash: "synthetic", agregadoTipo: "ATENDIMENTO", agregadoId: f.empresa.id, revision: index + 1, tipo: "CHECKLIST_ITEM_ATUALIZADO", empresaId: f.empresa.id, atorTipo: "INTERNO", atorUsuarioId: 1, createdAt: stamp, dados: { itemId: f.item.id, depois: { status: "OK" } } })) });
    const found: string[] = [];
    let cursor: { createdAt: string; id: string } | undefined;
    do {
      const page = await listarEventos(owner, { limit: 20, cursor, somenteNaoLidos: true });
      expect(checklistPaginaEventosSchema.safeParse(JSON.parse(JSON.stringify(page))).success).toBe(true);
      found.push(...page.items.filter((event) => event.empresaId === f.empresa.id).map((event) => event.eventId));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(found).toHaveLength(61);
    expect(new Set(found).size).toBe(61);
    const first = await marcarEventoLido(owner, found[0]);
    const again = await marcarEventoLido(owner, found[0]);
    expect(again.lidoEm).toEqual(first.lidoEm);
    expect(await state.db.checklistEventoLeitura.count({ where: { eventoId: found[0], usuarioId: owner.id } })).toBe(1);
    const remaining = await listarEventos(owner, { somenteNaoLidos: true, limit: 100 });
    expect(remaining.items.some((event) => event.eventId === found[0])).toBe(false);
    const otherActor = await listarEventos({ ...owner, id: 2 }, { somenteNaoLidos: true, limit: 100 });
    expect(otherActor.items.some((event) => event.eventId === found[0])).toBe(true);
  });
});
