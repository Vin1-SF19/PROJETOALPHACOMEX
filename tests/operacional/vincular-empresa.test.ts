import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { compare } from "bcryptjs";
import { criarFixtureChecklist } from "../checklist-analistas/sqlite-fixture";
const state = vi.hoisted(() => ({ db: undefined as unknown as PrismaClient, auth: vi.fn() }));
vi.mock("../../auth", () => ({ auth: state.auth }));
vi.mock("@/lib/prisma", () => ({ get default() { return state.db; } }));
import { buscarClienteParaVincularOperacional, vincularEmpresaAoCliente } from "@/actions/ClientesOperacional";
let fixture: Awaited<ReturnType<typeof criarFixtureChecklist>>;
beforeAll(async () => { fixture = await criarFixtureChecklist(); state.db = fixture.db; }, 30000);
afterAll(async () => { await fixture?.close(); });
beforeEach(() => { state.auth.mockResolvedValue({ user: { id: "3", authSessionVersion: 0 } }); });

describe("vínculo operacional — master existente e criação atômica de acesso", () => {
  it("consulta rejeita CNPJ incompleto sem criar master", async () => {
    const count = await state.db.cliente.count();
    expect(await buscarClienteParaVincularOperacional("123")).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await state.db.cliente.count()).toBe(count);
  });
  it("consulta de CNPJ ausente orienta CRM e NUNCA cria master", async () => {
    const count = await state.db.cliente.count();
    expect(await buscarClienteParaVincularOperacional("12.345.678/0001-90")).toMatchObject({ ok: false, error: { code: "NOT_FOUND", message: expect.stringContaining("CRM") } });
    expect(await state.db.cliente.count()).toBe(count);
  });
  it("consulta normaliza CNPJ e retorna ID canônico obrigatório na confirmação", async () => {
    const cliente = await state.db.cliente.create({ data: { cnpj: "98765432000101", razaoSocial: "EMPRESA CONFIRMADA", nomeFantasia: "CONFIRMADA" } });
    expect(await buscarClienteParaVincularOperacional("98.765.432/0001-01")).toMatchObject({ ok: true, data: { id: cliente.id, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial, nomeFantasia: "CONFIRMADA" } });
  });
  it("criação recusa payload antigo sem master confirmado/analista/CAS de intenção", async () => {
    const before = await state.db.operacionalClientes.count();
    expect(await vincularEmpresaAoCliente({ cnpj: "" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(await state.db.operacionalClientes.count()).toBe(before);
  });
  it("master ausente não cria conta nem atendimento", async () => {
    const counts = [await state.db.cliente.count(), await state.db.clienteOperacional.count(), await state.db.operacionalClientes.count()];
    expect(await vincularEmpresaAoCliente({ mutationId: randomUUID(), clienteId: 999999999, analistaId: 1, novaConta: { nome: "Synthetic", email: "missingmaster@example.invalid" } })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect([await state.db.cliente.count(), await state.db.clienteOperacional.count(), await state.db.operacionalClientes.count()]).toEqual(counts);
  });
  it("conta ausente não cria atendimento", async () => {
    const f = await fixture.atendimento();
    const before = await state.db.operacionalClientes.count();
    expect(await vincularEmpresaAoCliente({ mutationId: randomUUID(), clienteId: f.cliente.id, clienteOperacionalId: "acesso-inexistente", analistaId: 1 })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await state.db.operacionalClientes.count()).toBe(before);
  });
  it("vincula master e conta existentes mantendo identidades distintas e replay único", async () => {
    const f = await fixture.atendimento();
    const input = { mutationId: randomUUID(), clienteId: f.cliente.id, clienteOperacionalId: f.conta.id, analistaId: 2 };
    const result = await vincularEmpresaAoCliente(input);
    expect(result).toMatchObject({ ok: true, data: { atendimento: { clienteId: f.cliente.id, contaPortal: { id: f.conta.id }, analista: { id: 2 }, revision: 1 }, replayed: false } });
    const replay = await vincularEmpresaAoCliente(input);
    expect(replay).toMatchObject({ ok: true, data: { replayed: true } });
    expect(await state.db.operacionalClientes.count({ where: { clienteId: f.cliente.id } })).toBe(2);
    expect(await state.db.checklistEvento.count({ where: { mutationId: input.mutationId } })).toBe(1);
  });
  it("email duplicado é conflito e não deixa atendimento parcial", async () => {
    const f = await fixture.atendimento();
    const counts = [await state.db.clienteOperacional.count(), await state.db.operacionalClientes.count()];
    expect(await vincularEmpresaAoCliente({ mutationId: randomUUID(), clienteId: f.cliente.id, analistaId: 1, novaConta: { nome: "Duplicado", email: f.conta.email } })).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect([await state.db.clienteOperacional.count(), await state.db.operacionalClientes.count()]).toEqual(counts);
  });
  it("acesso novo nasce junto do atendimento com bcrypt12 e segredo exibido uma única vez", async () => {
    const f = await fixture.atendimento();
    const email = `${randomUUID()}@example.invalid`;
    const input = { mutationId: randomUUID(), clienteId: f.cliente.id, analistaId: 1, novaConta: { nome: "Novo acesso", email } };
    const result = await vincularEmpresaAoCliente(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.data.credencialInicial).toMatch(/^[A-Za-z0-9_-]{24}$/);
    const conta = await state.db.clienteOperacional.findUniqueOrThrow({ where: { email } });
    expect(conta.senha).toBe("");
    expect(conta.senhaHash).toMatch(/^\$2[aby]\$12\$/);
    expect(await compare(result.data.credencialInicial!, conta.senhaHash!)).toBe(true);
    const replay = await vincularEmpresaAoCliente(input);
    expect(replay).toMatchObject({ ok: true, data: { replayed: true } });
    expect(replay).not.toHaveProperty("data.credencialInicial");
  });
  it("falha após criar conta reverte conta/atendimento/evento na mesma transação", async () => {
    const f = await fixture.atendimento();
    const email = `${randomUUID()}@example.invalid`;
    const mutationId = randomUUID();
    const before = await state.db.operacionalClientes.count();
    expect(await vincularEmpresaAoCliente({ mutationId, clienteId: f.cliente.id, analistaId: 1, novaConta: { nome: "Rollback", email }, tipo: "DISPONIBILIDADE_FINANCEIRA" })).toMatchObject({ ok: false, error: { code: "MODEL_EMPTY" } });
    expect(await state.db.clienteOperacional.findUnique({ where: { email } })).toBeNull();
    expect(await state.db.operacionalClientes.count()).toBe(before);
    expect(await state.db.checklistEvento.count({ where: { mutationId } })).toBe(0);
  });
  it("nenhuma fachada permite consulta ou criação sem sessão", async () => {
    const f = await fixture.atendimento();
    state.auth.mockResolvedValue(null);
    expect(await buscarClienteParaVincularOperacional(f.cliente.cnpj!)).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(await vincularEmpresaAoCliente({ mutationId: randomUUID(), clienteId: f.cliente.id, clienteOperacionalId: f.conta.id, analistaId: 1 })).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
  });
});
