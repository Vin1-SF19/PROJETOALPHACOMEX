import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ db: null as unknown as import("@prisma/client").PrismaClient, auth: vi.fn(), acesso: vi.fn(), notificar: vi.fn(), falharOutbox: false }));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: m.acesso }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: m.notificar }));
vi.mock("@/lib/bpm/automacoes/eventos", async original => {
  const real = await original<typeof import("@/lib/bpm/automacoes/eventos")>();
  return { ...real, publicarEventoBpm: async (...args: Parameters<typeof real.publicarEventoBpm>) => {
    if (m.falharOutbox) throw new Error("Falha fictícia de outbox"); return real.publicarEventoBpm(...args);
  } };
});
vi.mock("@/lib/prisma", () => ({ default: new Proxy({}, { get: (_target, key) => {
  const value = m.db[key as keyof typeof m.db]; return typeof value === "function" ? value.bind(m.db) : value;
} }) }));
import { SalvarCadastroEmpresaCardBpm } from "@/actions/bpm/EmpresaCadastro";
import { PreencherCnpjCardNoloss } from "@/actions/bpm/NolossLeads";
import { ConfirmarVinculoEmpresaCardBpm } from "@/actions/bpm/CnpjEmpresaVinculo";
import { carregarDadosEmpresaCard } from "@/lib/bpm/dados-empresa-server";
import { proporVinculoEmpresaPorCnpj } from "@/lib/bpm/cnpj-empresa-vinculo-server";
import { ACAO_VINCULO_EMPRESA, type PropostaVinculoEmpresa } from "@/lib/bpm/cnpj-empresa-vinculo";
import { revalidatePath } from "next/cache";
let folder: string, cardId: string, outroCardId: string, origemId: number, destinoId: number, pipelineId: string, etapaId: string;
const cnpj = "11222333000181";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (file: string) => { exec(sql: string): void; close(): void } };
function criarTabelas(file: string) {
  const sqlite = new DatabaseSync(file);
  try {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const modelos = ["Cliente", "usuarios", "BpmCard", "BpmPipeline", "BpmEtapa", "NolossLead", "Pessoa", "PessoaClienteVinculo", "ClienteServico", "ConsultaPreAnalise", "radar_fiscal", "BpmCardMembro", "BpmCardHistorico", "HistoricoAlteracaoCliente", "BpmCardServicoContexto", "ContratoComercial", "Indicacao", "BpmCardVinculo", "ChecklistCrmVinculo", "OperacionalClientes", "BpmEventoDominio", "BpmAutomacaoExecucao"];
    for (const modelo of modelos) {
      const corpo = schema.match(new RegExp(`model ${modelo} \\{([\\s\\S]*?)\\n\\}`))?.[1];
      if (!corpo) throw new Error(`Modelo ausente: ${modelo}`);
      const colunas = corpo.split("\n").flatMap(linha => {
        const item = linha.trim().match(/^(\w+)\s+(String|Int|Float|Boolean|DateTime|BigInt|Decimal|Bytes|Json)(\?)?\s*(.*)$/);
        if (!item) return [];
        const [, nome, tipo, opcional, atributos] = item;
        const tipos: Record<string, string> = { String: "TEXT", Int: "INTEGER", Float: "REAL", Boolean: "BOOLEAN", DateTime: "DATETIME", BigInt: "INTEGER", Decimal: "REAL", Bytes: "BLOB", Json: "TEXT" };
        const valor = atributos.match(/@default\(("[^"]*"|true|false|\d+|now\(\))\)/)?.[1];
        const padrao = valor === "now()" ? "CURRENT_TIMESTAMP" : valor === "true" ? "1" : valor === "false" ? "0" : valor ?? (!opcional ? tipo === "DateTime" ? "CURRENT_TIMESTAMP" : ["Int", "Boolean", "Float", "Decimal", "BigInt"].includes(tipo) ? "0" : "''" : undefined);
        return [`"${nome}" ${tipos[tipo]}${atributos.includes("@id") ? " PRIMARY KEY" : ""}${atributos.includes("@unique") ? " UNIQUE" : ""}${!opcional ? " NOT NULL" : ""}${padrao ? ` DEFAULT ${padrao}` : ""}`];
      });
      for (const unica of corpo.matchAll(/@@unique\(\[([^\]]+)\]/g)) colunas.push(`UNIQUE(${unica[1]})`);
      const tabela = corpo.match(/@@map\("([^"\n]+)"\)/)?.[1] ?? modelo;
      sqlite.exec(`CREATE TABLE "${tabela}" (${colunas.join(",")});`);
    }
  } finally { sqlite.close(); }
}
beforeAll(async () => {
  folder = mkdtempSync(path.join(tmpdir(), "cnpj-vinculo-test-")); const url = `file:${path.join(folder, "fixture.db")}`;
  criarTabelas(path.join(folder, "fixture.db"));
  m.db = new PrismaClient({ adapter: new PrismaLibSQL({ url }), log: [] });
  const u = await m.db.usuarios.create({ data: { nome: "Autora legítima", usuario: "autora", email: "autora@example.invalid", senha: "fixture", role: "Admin" } });
  origemId = (await m.db.cliente.create({ data: { razaoSocial: "Contato do lead", capitalSocial: "100" } })).id;
  destinoId = (await m.db.cliente.create({ data: { razaoSocial: "Empresa existente", cnpj, capitalSocial: "900000" } })).id;
  pipelineId = (await m.db.bpmPipeline.create({ data: { nome: "Revisão de Radar" } })).id;
  etapaId = (await m.db.bpmEtapa.create({ data: { pipelineId, nome: "Agendar Reunião", ordem: 1 } })).id;
  cardId = (await m.db.bpmCard.create({ data: { empresaId: origemId, pipelineId, etapaId, responsavelId: u.id } })).id;
  outroCardId = (await m.db.bpmCard.create({ data: { empresaId: origemId, pipelineId, etapaId, responsavelId: u.id } })).id;
  await m.db.nolossLead.create({ data: { nolossContactId: "lead-ficticio", promotedCardId: cardId, promotedClienteId: origemId, status: "promoted", nome: "Lead original", email: "lead@example.invalid", telefone: "11999990000", promotedAt: new Date("2026-10-20T10:00:00Z"), promotedByUserId: u.id } });
  await m.db.nolossLead.create({ data: { nolossContactId: "outro-lead", promotedCardId: outroCardId, promotedClienteId: origemId, status: "promoted", email: "outro@example.invalid" } });
  const pessoa = await m.db.pessoa.create({ data: { nome: "Contato humano", celular: "11999990000", email: "lead@example.invalid" } });
  await m.db.pessoaClienteVinculo.create({ data: { pessoaId: pessoa.id, clienteId: origemId } });
}, 30000);
afterAll(async () => { await m.db?.$disconnect(); if (folder) rmSync(folder, { recursive: true, force: true }); });
beforeEach(async () => {
  vi.restoreAllMocks(); m.falharOutbox = false; m.auth.mockResolvedValue({ user: { id: "1", role: "Admin" } }); m.acesso.mockReset().mockResolvedValue(undefined); m.notificar.mockReset().mockResolvedValue(undefined);
  await m.db.bpmEventoDominio.deleteMany(); await m.db.bpmCardHistorico.deleteMany(); await m.db.historicoAlteracaoCliente.deleteMany();
  await m.db.bpmCardServicoContexto.deleteMany(); await m.db.clienteServico.deleteMany(); await m.db.bpmCardVinculo.deleteMany();
  await m.db.bpmCard.update({ where: { id: cardId }, data: { empresaId: origemId, versao: 0 } });
  await m.db.cliente.update({ where: { id: origemId }, data: { cnpj: null, razaoSocial: "Contato do lead" } });
  await m.db.cliente.update({ where: { id: destinoId }, data: { status: "ATIVO", cnpj, razaoSocial: "Empresa existente" } });
  await m.db.nolossLead.updateMany({ where: { promotedCardId: cardId }, data: { promotedClienteId: origemId } });
});
const confirmar = (proposta: PropostaVinculoEmpresa) => ConfirmarVinculoEmpresaCardBpm({ proposta, confirmar: true });
async function proposta(modo: "EDITOR" | "NOLOSS" = "EDITOR") {
  return (await proporVinculoEmpresaPorCnpj({ cardId, modo, cnpj }, { id: 1, role: "Admin" }))!;
}
async function snapshot() { return { clientes: await m.db.cliente.findMany({ orderBy: { id: "asc" } }), cards: await m.db.bpmCard.findMany({ orderBy: { id: "asc" } }), pessoas: await m.db.pessoa.findMany(), contatos: await m.db.pessoaClienteVinculo.findMany(), leads: await m.db.nolossLead.findMany({ orderBy: { id: "asc" } }) }; }

it.each(["EDITOR", "NOLOSS"] as const)("oferece confirmação %s sem escrever ou aplicar rascunho", async modo => {
  const antes = await snapshot();
  const dados = (await carregarDadosEmpresaCard(cardId))!;
  dados.edicao.cadastro.empresa.cnpj = cnpj; dados.edicao.cadastro.empresa.razaoSocial = "Nunca gravar no destino";
  const res = modo === "EDITOR" ? await SalvarCadastroEmpresaCardBpm({ cardId, ...dados.edicao }) : await PreencherCnpjCardNoloss(cardId, "11.222.333/0001-81");
  expect(res).toMatchObject({ success: false, code: "CNPJ_EMPRESA_EXISTENTE", propostaVinculo: { modo, empresaOrigemId: origemId, empresaDestinoId: destinoId, cnpj } });
  expect(await snapshot()).toEqual(antes); expect(await m.db.bpmCardHistorico.count()).toBe(0);
});
it.each(["EDITOR", "NOLOSS"] as const)("confirma %s alterando só card e referência NoLoss necessária, sem mesclar empresas", async modo => {
  const antes = await snapshot(); const p = await proposta(modo); const res = await confirmar(p);
  expect(res).toMatchObject({ success: true, data: { empresa: { id: destinoId, razaoSocial: "Empresa existente", capitalSocial: 900000 } } });
  const depois = await snapshot(); expect(depois.clientes).toEqual(antes.clientes); expect(depois.pessoas).toEqual(antes.pessoas); expect(depois.contatos).toEqual(antes.contatos);
  expect(depois.cards.find(c => c.id === outroCardId)).toEqual(antes.cards.find(c => c.id === outroCardId));
  expect(depois.cards.find(c => c.id === cardId)).toMatchObject({ empresaId: destinoId, versao: 1, pipelineId, etapaId });
  const original = antes.leads.find(l => l.promotedCardId === cardId)!;
  expect(depois.leads.find(l => l.id === original.id)).toEqual({ ...original, promotedClienteId: destinoId });
  expect(depois.leads.find(l => l.promotedCardId === outroCardId)).toEqual(antes.leads.find(l => l.promotedCardId === outroCardId));
  const audit = await m.db.bpmCardHistorico.findFirstOrThrow({ where: { acao: ACAO_VINCULO_EMPRESA } });
  expect(audit.usuarioId).toBe(1); expect(JSON.parse(audit.valorNovoJson!)).toMatchObject({ autor: "Autora legítima", rascunhoAplicado: false, snapshot: p.snapshot });
  const outbox = await m.db.bpmEventoDominio.findFirstOrThrow(); expect(JSON.parse(outbox.valorNovoJson!)).toMatchObject({ automacoesSuprimidas: true });
  expect(outbox.atorExecucaoId).toBeNull(); expect(await m.db.bpmAutomacaoExecucao.count()).toBe(0);
});
it("exige confirmação explícita e proposta íntegra", async () => {
  const p = await proposta();
  expect((await ConfirmarVinculoEmpresaCardBpm({ proposta: p, confirmar: false })).success).toBe(false);
  expect((await confirmar({ ...p, empresaDestinoNome: "Outro nome" })).success).toBe(false);
  expect((await confirmar({ ...p, empresaDestinoId: origemId })).success).toBe(false);
  expect((await m.db.bpmCard.findUniqueOrThrow({ where: { id: cardId } })).empresaId).toBe(origemId);
});
it.each(["card", "origem", "destino"])("recusa confirmação atrasada após alteração de %s", async alvo => {
  const p = await proposta();
  if (alvo === "card") await m.db.bpmCard.update({ where: { id: cardId }, data: { versao: { increment: 1 } } });
  else await m.db.cliente.update({ where: { id: alvo === "origem" ? origemId : destinoId }, data: { nomeFantasia: "Atualizado depois" } });
  expect(await confirmar(p)).toMatchObject({ success: false, code: "VINCULO_EMPRESA_CONFLITO" });
  expect(await m.db.bpmCardHistorico.count()).toBe(0);
});
it("revalida acesso e estado ativo do destino na confirmação", async () => {
  const p = await proposta(); m.acesso.mockRejectedValueOnce(new Error("Não autorizado"));
  expect(await confirmar(p)).toMatchObject({ success: false, error: "Não autorizado" });
  await m.db.cliente.update({ where: { id: destinoId }, data: { status: "ARQUIVADO" } });
  expect(await confirmar(p)).toMatchObject({ success: false, error: expect.stringContaining("arquivada") });
});
it("bloqueia vínculo incompatível a processo ou serviço sem reescrever essas identidades", async () => {
  await m.db.bpmCardVinculo.create({ data: { cardOrigemId: cardId, cardDestinoId: outroCardId } });
  await expect(proposta()).rejects.toThrow("outro processo"); await m.db.bpmCardVinculo.deleteMany();
  const servico = await m.db.clienteServico.create({ data: { clienteId: origemId, servico: "Serviço original" } });
  await m.db.bpmCardServicoContexto.create({ data: { cardId, clienteServicoId: servico.id } });
  await expect(proposta()).rejects.toThrow("serviço ou contrato");
  expect((await m.db.bpmCard.findUniqueOrThrow({ where: { id: cardId } })).empresaId).toBe(origemId);
});
it("replay e concorrência confirmam uma vez, sem duplicar auditoria ou outbox", async () => {
  const p = await proposta(); const resultados = await Promise.all([confirmar(p), confirmar(p)]);
  expect(resultados.map(r => r.success)).toEqual([true, true]); expect((await confirmar(p)).success).toBe(true);
  expect(await m.db.bpmCardHistorico.count({ where: { acao: ACAO_VINCULO_EMPRESA } })).toBe(1);
  expect(await m.db.bpmEventoDominio.count()).toBe(1);
});
it("falha de outbox desfaz o vínculo, referência NoLoss e auditoria", async () => {
  const p = await proposta(); const antes = await snapshot(); m.falharOutbox = true;
  expect((await confirmar(p)).success).toBe(false); expect(await snapshot()).toEqual(antes); expect(await m.db.bpmCardHistorico.count()).toBe(0);
});
it("falha visual após commit mantém resposta de sucesso", async () => {
  const p = await proposta(); vi.mocked(revalidatePath).mockImplementationOnce(() => { throw new Error("Cache fictício"); }); m.notificar.mockRejectedValueOnce(new Error("Transporte fictício"));
  expect((await confirmar(p)).success).toBe(true);
  expect((await m.db.bpmCard.findUniqueOrThrow({ where: { id: cardId } })).empresaId).toBe(destinoId);
});
it.each([null, ""])("preenchimento NoLoss sem duplicado aceita pendência %j e não falha por transporte póscommit", async vazio => {
  await m.db.cliente.update({ where: { id: destinoId }, data: { cnpj: null } });
  await m.db.cliente.update({ where: { id: origemId }, data: { cnpj: vazio } });
  m.notificar.mockRejectedValueOnce(new Error("Transporte fictício após commit"));
  expect(await PreencherCnpjCardNoloss(cardId, "11.222.333/0001-81")).toMatchObject({ success: true });
  expect((await m.db.cliente.findUniqueOrThrow({ where: { id: origemId } })).cnpj).toBe(cnpj);
  expect((await m.db.bpmCard.findUniqueOrThrow({ where: { id: cardId } })).empresaId).toBe(origemId);
  expect(await m.db.bpmCardHistorico.count({ where: { acao: "CNPJ_PREENCHIDO_NOLOSS" } })).toBe(1);
});
