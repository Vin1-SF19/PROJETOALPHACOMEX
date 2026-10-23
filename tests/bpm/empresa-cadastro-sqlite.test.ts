import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ db: null as unknown as import("@prisma/client").PrismaClient, auth: vi.fn(), acesso: vi.fn(), notificar: vi.fn() }));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: m.acesso }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: m.notificar }));
vi.mock("@/lib/prisma", () => ({ default: new Proxy({}, { get: (_target, key) => {
  const value = m.db[key as keyof typeof m.db]; return typeof value === "function" ? value.bind(m.db) : value;
} }) }));
import { carregarDadosEmpresaCard } from "@/lib/bpm/dados-empresa-server";
import { SalvarCadastroEmpresaCardBpm } from "@/actions/bpm/EmpresaCadastro";
import { revalidatePath } from "next/cache";

let folder: string;
let cardId: string;
let outroCardId: string;
let empresaId: number;
beforeAll(async () => {
  folder = mkdtempSync(path.join(tmpdir(), "crm-empresa-editor-test-"));
  const url = `file:${path.join(folder, "fixture.db")}`;
  // Banco descartável novo: jamais usa .env ou URL do workspace/projeto.
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, stdio: "pipe",
  });
  m.db = new PrismaClient({ adapter: new PrismaLibSQL({ url }), log: [] });
  const usuario = await m.db.usuarios.create({ data: { nome: "Autora original", usuario: "fixture", email: "fixture@example.invalid", senha: "fixture", role: "Admin" } });
  const empresa = await m.db.cliente.create({ data: { razaoSocial: "Empresa de teste", capitalSocial: "25000", situacaoCadastral: "ATIVA" } }); empresaId = empresa.id;
  const pipeline = await m.db.bpmPipeline.create({ data: { nome: "Revisão de Radar" } });
  const etapa = await m.db.bpmEtapa.create({ data: { pipelineId: pipeline.id, nome: "Agendar Reunião", ordem: 1 } });
  cardId = (await m.db.bpmCard.create({ data: { pipelineId: pipeline.id, etapaId: etapa.id, empresaId, responsavelId: usuario.id } })).id;
  outroCardId = (await m.db.bpmCard.create({ data: { pipelineId: pipeline.id, etapaId: etapa.id, empresaId, responsavelId: usuario.id } })).id;
}, 30000);
afterAll(async () => { await m.db?.$disconnect(); if (folder) rmSync(folder, { recursive: true, force: true }); });
beforeEach(async () => {
  vi.restoreAllMocks(); m.auth.mockResolvedValue({ user: { id: "1", role: "Admin" } }); m.acesso.mockReset().mockResolvedValue(undefined); m.notificar.mockReset().mockResolvedValue(undefined);
  await m.db.bpmCardHistorico.deleteMany(); await m.db.historicoAlteracaoCliente.deleteMany();
  await m.db.cliente.deleteMany({ where: { id: { not: empresaId } } });
  await m.db.cliente.update({ where: { id: empresaId }, data: { cnpj: null, razaoSocial: "Empresa de teste", nomeFantasia: null, capitalSocial: "25000", situacaoCadastral: "ATIVA", perfilCadastralJson: { versao: 0 } } });
});
async function comando(id = cardId) {
  const dados = (await carregarDadosEmpresaCard(id))!;
  return { cardId: id, ...dados.edicao, cadastro: structuredClone(dados.edicao.cadastro) };
}

describe("salvamento empresarial em SQLite real isolado", () => {
  it("falhas visuais após commit não reportam falha nem desfazem cadastro e auditorias", async () => {
    const p = await comando(); p.cadastro.empresa.nomeFantasia = "Gravação confirmada";
    vi.mocked(revalidatePath).mockImplementationOnce(() => { throw new Error("Cache indisponível (fixture)"); });
    m.notificar.mockRejectedValueOnce(new Error("Notificação indisponível (fixture)"));
    expect(await SalvarCadastroEmpresaCardBpm(p)).toMatchObject({ success: true });
    expect((await m.db.cliente.findUniqueOrThrow({ where: { id: empresaId } })).nomeFantasia).toBe("Gravação confirmada");
    expect(await m.db.historicoAlteracaoCliente.count()).toBe(1); expect(await m.db.bpmCardHistorico.count()).toBe(1);
    expect((await carregarDadosEmpresaCard(cardId))?.edicao.cadastro.empresa.nomeFantasia).toBe("Gravação confirmada");
  });
  it("salva CEP formatado da consulta, recarrega oito dígitos e espelha o valor normalizado nas auditorias", async () => {
    const p = await comando(); p.cadastro.empresa.endereco.cep = "01.001-000";
    const resposta = await SalvarCadastroEmpresaCardBpm(p);
    expect(resposta).toMatchObject({ success: true, data: { empresa: { endereco: { cep: "01001000" } } } });
    const recarregado = await carregarDadosEmpresaCard(cardId);
    expect(recarregado?.edicao.cadastro.empresa.endereco.cep).toBe("01001000");
    expect(await m.db.historicoAlteracaoCliente.findMany()).toMatchObject([
      { campo: "empresa.endereco.cep", valorAnterior: null, valorNovo: "01001000", userId: 1, nomeUsuarioNaEpoca: "Autora original" },
    ]);
    const historicos = await m.db.bpmCardHistorico.findMany({ where: { acao: "DADOS_EMPRESA_ATUALIZADOS" } });
    expect(historicos).toHaveLength(1);
    expect(JSON.parse(historicos[0].valorNovoJson!)).toMatchObject({ campo: "empresa.endereco.cep", valor: "01001000", autor: "Autora original" });
  });
  it("recusa texto inválido no CEP sem modificar cadastro, versão ou auditorias", async () => {
    const p = await comando(); p.cadastro.empresa.endereco.cep = "abc01001000";
    const antes = await m.db.cliente.findUniqueOrThrow({ where: { id: empresaId } });
    expect(await SalvarCadastroEmpresaCardBpm(p)).toMatchObject({ success: false, error: "CEP inválido." });
    const depois = await m.db.cliente.findUniqueOrThrow({ where: { id: empresaId } });
    expect(depois.updatedAt).toEqual(antes.updatedAt); expect(depois.perfilCadastralJson).toEqual(antes.perfilCadastralJson);
    expect(await m.db.historicoAlteracaoCliente.count()).toBe(0); expect(await m.db.bpmCardHistorico.count()).toBe(0);
  });
  it("primeiro save de contato sem CNPJ preserva capital/situação canônicos e audita cada campo", async () => {
    const p = await comando(); p.cadastro.contatos.push({ tipo: "E-mail", valor: "novo@example.invalid", titular: "Empresa" });
    const res = await SalvarCadastroEmpresaCardBpm(p);
    expect(res.success).toBe(true);
    const empresa = await m.db.cliente.findUniqueOrThrow({ where: { id: empresaId } });
    expect(empresa).toMatchObject({ cnpj: null, capitalSocial: "25000", situacaoCadastral: "ATIVA" });
    const audit = await m.db.historicoAlteracaoCliente.findMany();
    expect(audit).toHaveLength(3); expect(audit.every((a) => a.nomeUsuarioNaEpoca === "Autora original" && a.userId === 1 && a.criadoEm instanceof Date)).toBe(true);
    expect(new Set(audit.map((a) => a.loteId)).size).toBe(1);
    expect(audit.find((a) => a.campo === "contatos.0.valor")).toMatchObject({ valorAnterior: null, valorNovo: "novo@example.invalid" });
    expect(await m.db.bpmCardHistorico.count({ where: { acao: "DADOS_EMPRESA_ATUALIZADOS" } })).toBe(3);
    const recarregado = await carregarDadosEmpresaCard(cardId);
    expect(recarregado?.contatos[0].valor).toBe("novo@example.invalid"); expect(recarregado?.edicao.versaoEsperada).not.toBe(p.versaoEsperada);
    expect(m.acesso).toHaveBeenCalledTimes(2); expect(m.acesso.mock.calls[1][4]).toBeDefined();
  });
  it("grava antes/depois reais e não cria auditoria em no-op", async () => {
    const p = await comando(); expect((await SalvarCadastroEmpresaCardBpm(p)).success).toBe(true); expect(await m.db.bpmCardHistorico.count()).toBe(0);
    p.cadastro.empresa.capitalSocial = 80000;
    expect((await SalvarCadastroEmpresaCardBpm(p)).success).toBe(true);
    expect(await m.db.historicoAlteracaoCliente.findFirst()).toMatchObject({ campo: "empresa.capitalSocial", valorAnterior: "25000", valorNovo: "80000" });
    const h = await m.db.bpmCardHistorico.findFirstOrThrow(); expect(JSON.parse(h.valorNovoJson!)).toMatchObject({ autor: "Autora original", rotulo: "Capital social", valor: "80000" });
  });
  it("duas edições em cards diferentes da mesma empresa não se sobrescrevem", async () => {
    const a = await comando(); const b = await comando(outroCardId);
    a.cadastro.empresa.nomeFantasia = "Primeira edição"; b.cadastro.empresa.nomeFantasia = "Outra edição";
    expect((await SalvarCadastroEmpresaCardBpm(a)).success).toBe(true);
    expect(await SalvarCadastroEmpresaCardBpm(b)).toMatchObject({ success: false, error: expect.stringContaining("alterados durante") });
    expect((await m.db.cliente.findUniqueOrThrow({ where: { id: empresaId } })).nomeFantasia).toBe("Primeira edição");
    expect(await m.db.historicoAlteracaoCliente.count()).toBe(1);
  });
  it("CNPJ de outra empresa não mescla nem modifica qualquer cadastro/auditoria", async () => {
    await m.db.cliente.create({ data: { cnpj: "11222333000181", razaoSocial: "Outra empresa" } });
    const p = await comando(); p.cadastro.empresa.cnpj = "11222333000181";
    expect(await SalvarCadastroEmpresaCardBpm(p)).toMatchObject({ success: false, error: expect.stringContaining("outra empresa") });
    expect((await m.db.cliente.findUniqueOrThrow({ where: { id: empresaId } })).cnpj).toBeNull(); expect(await m.db.historicoAlteracaoCliente.count()).toBe(0);
  });
  it("falha na auditoria desfaz também o cadastro e o perfil", async () => {
    await m.db.$executeRawUnsafe('CREATE TRIGGER fixture_audit_failure BEFORE INSERT ON "BpmCardHistorico" BEGIN SELECT RAISE(ABORT, \'fixture failure\'); END');
    try {
      const p = await comando(); p.cadastro.empresa.nomeFantasia = "Não pode persistir";
      expect((await SalvarCadastroEmpresaCardBpm(p)).success).toBe(false);
      expect((await m.db.cliente.findUniqueOrThrow({ where: { id: empresaId } })).nomeFantasia).toBeNull();
      expect(await m.db.historicoAlteracaoCliente.count()).toBe(0);
    } finally { await m.db.$executeRawUnsafe('DROP TRIGGER fixture_audit_failure'); }
  });
  it("acesso revogado na revalidação transacional impede qualquer alteração", async () => {
    const p = await comando(); p.cadastro.empresa.nomeFantasia = "Não pode persistir";
    m.acesso.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Não autorizado"));
    expect(await SalvarCadastroEmpresaCardBpm(p)).toMatchObject({ success: false, error: "Não autorizado" });
    expect((await m.db.cliente.findUniqueOrThrow({ where: { id: empresaId } })).nomeFantasia).toBeNull(); expect(await m.db.bpmCardHistorico.count()).toBe(0);
  });
  it("não confia em empresaId de outro card e não usa autor enviado pelo cliente", async () => {
    const p = await comando(); p.empresaId += 10;
    expect((await SalvarCadastroEmpresaCardBpm(p)).success).toBe(false);
    expect((await SalvarCadastroEmpresaCardBpm({ ...p, autor: "Outra pessoa" })).success).toBe(false);
    expect(await m.db.historicoAlteracaoCliente.count()).toBe(0);
  });
});
