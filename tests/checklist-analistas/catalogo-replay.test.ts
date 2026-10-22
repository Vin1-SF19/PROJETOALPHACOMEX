import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { criarFixtureChecklist } from "./sqlite-fixture";

const state = vi.hoisted(() => ({ db: undefined as unknown as PrismaClient }));
vi.mock("@/lib/prisma", () => ({ get default() { return state.db; } }));
vi.mock("../../auth", () => ({ auth: vi.fn() }));
import { publicarModelo, revisarModelo } from "@/lib/checklist/catalogo";

const leader = { kind: "INTERNO", id: 3, sessionVersion: 0 } as const;
const otherLeader = { ...leader, id: 9 };
let fixture: Awaited<ReturnType<typeof criarFixtureChecklist>>;
beforeAll(async () => {
  fixture = await criarFixtureChecklist();
  state.db = fixture.db;
  await state.db.usuarios.create({ data: {
    id: otherLeader.id, nome: "Other synthetic leader", usuario: "leader9",
    email: "leader9@example.invalid", senha: "fixture",
    role: "Líder Operacional", permissoes: "checkList",
  } });
}, 30000);
afterAll(async () => { await fixture?.close(); });

function model() {
  return {
    mutationId: randomUUID(), expectedRevision: 0, escopo: "GLOBAL",
    codigo: `REPLAY_${randomUUID()}`, nome: "Original", descricao: null,
    secao: "CONSTITUIÇÃO REGULAR", obrigatorio: true, ordem: 10, ativo: true,
  };
}
async function snapshot(identidadeId: string) {
  const [identity, events, audits, versions] = await Promise.all([
    state.db.modeloChecklistIdentidade.findUniqueOrThrow({
      where: { id: identidadeId },
      include: { revisoes: { orderBy: { versao: "asc" } } },
    }),
    state.db.checklistEvento.findMany({
      where: { agregadoId: identidadeId }, orderBy: { revision: "asc" },
    }),
    state.db.auditoria.count(),
    state.db.modeloItemChecklist.count(),
  ]);
  return { identity, events, audits, versions };
}

describe.sequential("catálogo — replay da intenção original em SQLite real", () => {
  it("TI publica e edita; PUBLICAR revalida o cadastro antes de replay e novas intenções", async () => {
    const ti = { ...leader, id: 6 };
    const publication = model();
    const initial = await publicarModelo(ti, publication);
    expect(await publicarModelo(ti, publication)).toEqual(initial);
    const edit = { ...publication, identidadeId: initial.identidadeId,
      expectedRevision: 1, mutationId: randomUUID(), nome: "Revisado pelo TI" };
    const updated = await publicarModelo(ti, edit);
    expect(updated.revision).toBe(2);
    const confirmed = await snapshot(initial.identidadeId);
    expect(confirmed.identity.revisoes[1]).toMatchObject({ nome: edit.nome, autorId: ti.id });
    expect(await publicarModelo(ti, edit)).toEqual(updated);
    await expect(publicarModelo(ti, { ...edit, nome: "Intenção divergente" }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    await expect(publicarModelo(leader, edit)).rejects.toMatchObject({ code: "CONFLICT" });
    for (const { data, code } of [
      { data: { authSessionVersion: 1 }, code: "UNAUTHENTICATED" },
      { data: { status: "INATIVO" }, code: "UNAUTHENTICATED" },
      { data: { role: "Admin" }, code: "FORBIDDEN" },
      { data: { role: "CEO" }, code: "FORBIDDEN" },
      { data: { role: "Operacional" }, code: "FORBIDDEN" },
    ]) {
      await state.db.usuarios.update({ where: { id: ti.id }, data });
      try {
        await expect(publicarModelo(ti, edit)).rejects.toMatchObject({ code });
        await expect(publicarModelo(ti, model())).rejects.toMatchObject({ code });
      } finally {
        await state.db.usuarios.update({ where: { id: ti.id }, data: {
          authSessionVersion: 0, status: "ATIVO", role: "TI", permissoes: "checkList",
        } });
      }
      expect(await snapshot(initial.identidadeId)).toEqual(confirmed);
    }
    // Role normalization follows the canonical role helper, including legacy T.I.
    await state.db.usuarios.update({ where: { id: ti.id }, data: { role: "T.I" } });
    try {
      expect(await publicarModelo(ti, edit)).toEqual(updated);
    } finally {
      await state.db.usuarios.update({ where: { id: ti.id }, data: { role: "TI" } });
    }
    expect(await snapshot(initial.identidadeId)).toEqual(confirmed);
  });
  for (const [actorName, actor, originalRole] of [
    ["líder", leader, "Líder Operacional"],
    ["TI", { ...leader, id: 6 }, "TI"],
  ] as const) {
    for (const operation of ["DESATIVAR", "ORDENAR"] as const) {
      it(`${actorName} ${operation}: recupera rev2 após outro líder publicar rev3 sem escrever novamente`, async () => {
        const publication = model();
        const initial = await publicarModelo(actor, publication);
        const input = {
          identidadeId: initial.identidadeId, expectedRevision: 1,
          mutationId: randomUUID(), ...(operation === "ORDENAR" ? { ordem: 9 } : {}),
        };
        const first = await revisarModelo(actor, input, operation);
        expect(first).toMatchObject({ identidadeId: initial.identidadeId, revision: 2 });
        const confirmed = await snapshot(initial.identidadeId);
        expect(confirmed.identity.revisoes).toHaveLength(2);
        expect(confirmed.events).toHaveLength(2);
        expect(await revisarModelo(actor, input, operation)).toEqual(first);
        expect(await snapshot(initial.identidadeId)).toEqual(confirmed);

        await publicarModelo(otherLeader, {
          ...publication, identidadeId: initial.identidadeId,
          expectedRevision: 2, mutationId: randomUUID(),
          nome: "Editado por outro líder", ordem: 30, ativo: true,
        });
        const concurrent = await snapshot(initial.identidadeId);
        expect(concurrent.identity.revision).toBe(3);
        expect(concurrent.identity.revisoes).toHaveLength(3);
        expect(concurrent.identity.revisoes[2]).toMatchObject({
          nome: "Editado por outro líder", ordem: 30, ativo: true, autorId: otherLeader.id,
        });
        expect(concurrent.events).toHaveLength(3);
        expect(await revisarModelo(actor, { ...input }, operation)).toEqual(first);
        expect(await snapshot(initial.identidadeId)).toEqual(concurrent);

        // The same journal key still binds requested fields, operation, target and actor.
        for (const altered of [
          { ...input, ordem: 99 },
          { ...input, expectedRevision: 3 },
          { ...input, identidadeId: "another-identity" },
        ]) {
          await expect(revisarModelo(actor, altered, operation))
            .rejects.toMatchObject({ code: "CONFLICT" });
        }
        await expect(revisarModelo(actor, { ...input, ordem: 9 },
          operation === "DESATIVAR" ? "ORDENAR" : "DESATIVAR"))
          .rejects.toMatchObject({ code: "CONFLICT" });
        await expect(revisarModelo(otherLeader, input, operation))
          .rejects.toMatchObject({ code: "CONFLICT" });
        await expect(publicarModelo(actor, { ...publication, ...input }))
          .rejects.toMatchObject({ code: "CONFLICT" });
        await expect(revisarModelo(actor, { ...input, mutationId: randomUUID() }, operation))
          .rejects.toMatchObject({ code: "CONFLICT" });
        expect(await snapshot(initial.identidadeId)).toEqual(concurrent);

        const fresh = await revisarModelo(actor, {
          ...input, expectedRevision: 3, mutationId: randomUUID(),
        }, operation);
        expect(fresh).toMatchObject({ identidadeId: initial.identidadeId, revision: 4 });
        const current = await snapshot(initial.identidadeId);
        expect(current.identity.revisoes).toHaveLength(4);
        expect(current.identity.revisoes[3]).toMatchObject({
          nome: "Editado por outro líder", ordem: operation === "ORDENAR" ? 9 : 30,
          ativo: operation !== "DESATIVAR",
        });
        expect(current.events).toHaveLength(4);
        expect(current.audits).toBe(concurrent.audits + 1);
        expect(current.versions).toBe(concurrent.versions + 1);
      });

      it(`${actorName} ${operation}: revalida sessão, status, papel e módulo persistidos antes do replay`, async () => {
        const initial = await publicarModelo(actor, model());
        const input = {
          identidadeId: initial.identidadeId, expectedRevision: 1,
          mutationId: randomUUID(), ...(operation === "ORDENAR" ? { ordem: 9 } : {}),
        };
        const first = await revisarModelo(actor, input, operation);
        const confirmed = await snapshot(initial.identidadeId);
        for (const { data, code } of [
          { data: { authSessionVersion: 1 }, code: "UNAUTHENTICATED" },
          { data: { status: "INATIVO" }, code: "UNAUTHENTICATED" },
          { data: { role: "Admin" }, code: "FORBIDDEN" },
          { data: { role: "CEO" }, code: "FORBIDDEN" },
          { data: { role: "Analista Operacional" }, code: "FORBIDDEN" },
          // TI retains the existing administrative read bypass; module loss is
          // effective after the persisted administrative role is revoked.
          { data: { role: "Operacional", permissoes: "" }, code: "FORBIDDEN" },
        ]) {
          await state.db.usuarios.update({ where: { id: actor.id }, data });
          try {
            await expect(revisarModelo(actor, input, operation)).rejects.toMatchObject({ code });
          } finally {
            await state.db.usuarios.update({ where: { id: actor.id }, data: {
              authSessionVersion: 0, status: "ATIVO", role: originalRole, permissoes: "checkList",
            } });
          }
          expect(await snapshot(initial.identidadeId)).toEqual(confirmed);
        }
        if (originalRole === "Líder Operacional") {
          await state.db.usuarios.update({ where: { id: actor.id }, data: { permissoes: "" } });
          try {
            await expect(revisarModelo(actor, input, operation)).rejects.toMatchObject({ code: "FORBIDDEN" });
          } finally {
            await state.db.usuarios.update({ where: { id: actor.id }, data: { permissoes: "checkList" } });
          }
          expect(await snapshot(initial.identidadeId)).toEqual(confirmed);
        }
        expect(await revisarModelo(actor, input, operation)).toEqual(first);
      });
    }
  }
});
