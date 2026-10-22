import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { criarFixtureChecklist } from "../checklist-analistas/sqlite-fixture";
const state = vi.hoisted(() => ({ db: undefined as unknown as PrismaClient, auth: vi.fn() }));
vi.mock("../../auth", () => ({ auth: state.auth }));
vi.mock("@/lib/prisma", () => ({ get default() { return state.db; } }));
import { listarEmpresasChecklist, obterEmpresaChecklist, atualizarEmpresaChecklist } from "@/actions/checklist";
let fixture: Awaited<ReturnType<typeof criarFixtureChecklist>>;
beforeAll(async () => { fixture = await criarFixtureChecklist(); state.db = fixture.db; }, 30000);
afterAll(async () => { await fixture?.close(); });
beforeEach(() => { state.auth.mockResolvedValue({ user: { id: "1", authSessionVersion: 0 } }); });

describe("Cliente master — projeções públicas e PATCH via actions reais", () => {
  it("lista os dados do master confirmado, separando identidade e revisão operacionais", async () => {
    const f = await fixture.atendimento();
    const result = await listarEmpresasChecklist({ clienteId: f.cliente.id });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.data.totalCount).toBe(1);
    expect(result.data.items).toEqual([expect.objectContaining({ id: f.empresa.id, clienteId: f.cliente.id, cnpj: f.cliente.cnpj, razaoSocial: f.cliente.razaoSocial, nomeFantasia: "MASTER", revision: 0 })]);
    expect(JSON.stringify(result)).not.toContain("senhaHash");
  });
  it("bloqueia sem sessão autenticada, mesmo com registro existente", async () => {
    const f = await fixture.atendimento();
    state.auth.mockResolvedValue(null);
    expect(await listarEmpresasChecklist({ clienteId: f.cliente.id })).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
  });
  it("detalhe distingue Cliente master da conta de login do Portal", async () => {
    const f = await fixture.atendimento();
    const result = await obterEmpresaChecklist(f.empresa.id);
    expect(result).toMatchObject({ ok: true, data: { clienteId: f.cliente.id, cliente: { id: f.cliente.id, cnpj: f.cliente.cnpj, razaoSocial: f.cliente.razaoSocial, regimeTributario: "Simples Nacional" }, contaPortal: { id: f.conta.id, nome: "Pessoa da conta", email: f.conta.email } } });
  });
  it("empresa ausente produz NOT_FOUND público seguro", async () => {
    expect(await obterEmpresaChecklist("inexistente")).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });
  it("PATCH altera somente negócio, preservando todos os dados cadastrais no master", async () => {
    const f = await fixture.atendimento();
    const before = await state.db.cliente.findUniqueOrThrow({ where: { id: f.cliente.id } });
    const result = await atualizarEmpresaChecklist({ empresaId: f.empresa.id, expectedRevision: 0, mutationId: randomUUID(), patch: { status: "EM_ANALISE", embasamento: "Novo fundamento", mesProtocolo: null, linkGrupo: null } });
    expect(result).toMatchObject({ ok: true, data: { revision: 1, status: "EM_ANALISE", embasamento: "Novo fundamento", mesProtocolo: null, linkGrupo: null } });
    expect(await state.db.cliente.findUniqueOrThrow({ where: { id: f.cliente.id } })).toEqual(before);
    expect(await state.db.operacionalClientes.findUniqueOrThrow({ where: { id: f.empresa.id } })).toMatchObject({ clienteId: f.cliente.id, clienteOperacionalId: f.conta.id, tipo: "RECEITA_BRUTA_DAS" });
  });
  it("PATCH cadastral forjado é rejeitado sem mutação, evento ou incremento de revisão", async () => {
    const f = await fixture.atendimento();
    const result = await atualizarEmpresaChecklist({ empresaId: f.empresa.id, expectedRevision: 0, mutationId: randomUUID(), patch: { status: "ATIVO", razaoSocial: "TENTATIVA DE BURLAR", cnpj: "FORJADO" } });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect((await state.db.cliente.findUniqueOrThrow({ where: { id: f.cliente.id } })).razaoSocial).toBe(f.cliente.razaoSocial);
    expect((await state.db.operacionalClientes.findUniqueOrThrow({ where: { id: f.empresa.id } })).revision).toBe(0);
    expect(await state.db.checklistEvento.count({ where: { empresaId: f.empresa.id } })).toBe(0);
  });
});
