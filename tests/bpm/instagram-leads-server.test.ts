import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hash } from "bcryptjs";
import { INSTAGRAM_ENDPOINT_SLUG, prepararLeadInstagram } from "@/lib/bpm/instagram-leads";
const db = vi.hoisted(() => ({ bpmWebhookEndpoint: { findUnique: vi.fn() }, bpmWebhookEntrada: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn() }, bpmEtapa: { findMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ default: db }));
import { autenticarInstagram, buscarInstagramLeadsPendentes, receberInstagramLead } from "@/lib/bpm/instagram-leads-server";

const token = "a".repeat(43);
const endpoint = { id: "endpoint", ativo: true, caminhoSlug: INSTAGRAM_ENDPOINT_SLUG, automacaoId: null, pipelineId: "canonical",
  pipeline: { nome: "Revisão de Radar", ativo: true }, segredoHash: await hash(token, 4) };
const lead = { id: "l:example", full_name: "Contato Exemplo", created_time: "2026-10-21T12:00:00Z" };
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("INSTAGRAM_LEADS_ENDPOINT_ID", "endpoint"); db.bpmWebhookEndpoint.findUnique.mockResolvedValue(endpoint); });
afterEach(() => vi.unstubAllEnvs());

describe("inbox Instagram", () => {
  it("autentica por bcrypt e rejeita segredo errado", async () => {
    expect(await autenticarInstagram("Bearer " + token)).toMatchObject({ id: "endpoint" });
    await expect(autenticarInstagram("Bearer " + "b".repeat(43))).rejects.toMatchObject({ status: 401 });
    await expect(autenticarInstagram(null)).rejects.toMatchObject({ status: 401 });
  });
  it("header ausente não consulta banco nem executa bcrypt", async () => {
    await expect(autenticarInstagram(null)).rejects.toMatchObject({ status: 401 });
    expect(db.bpmWebhookEndpoint.findUnique).not.toHaveBeenCalled();
  });
  it("falha fechada com endpoint inativo ou de automação genérica", async () => {
    db.bpmWebhookEndpoint.findUnique.mockResolvedValue({ ...endpoint, ativo: false });
    await expect(autenticarInstagram("Bearer " + token)).rejects.toMatchObject({ status: 503 });
    db.bpmWebhookEndpoint.findUnique.mockResolvedValue({ ...endpoint, automacaoId: "outra" });
    await expect(autenticarInstagram("Bearer " + token)).rejects.toMatchObject({ status: 503 });
  });
  it("não lê leads do endpoint em pipeline homônimo de outro ID", async () => {
    expect(await buscarInstagramLeadsPendentes("outra")).toEqual([]);
    expect(db.bpmWebhookEntrada.findMany).not.toHaveBeenCalled();
  });
  it("sem config fica vazio sem consultar dados", async () => {
    vi.stubEnv("INSTAGRAM_LEADS_ENDPOINT_ID", "");
    expect(await buscarInstagramLeadsPendentes("canonical")).toEqual([]);
    expect(db.bpmWebhookEndpoint.findUnique).not.toHaveBeenCalled();
  });
  it("deduplica retries e não reabre promovidos", async () => {
    db.bpmWebhookEntrada.findUnique.mockResolvedValue({ id: "entrada", statusRecebimento: "PROCESSADO", payloadSanitizadoJson: JSON.stringify(prepararLeadInstagram(lead)), eventoId: "evento", evento: { cardId: "card" } });
    expect(await receberInstagramLead("endpoint", lead)).toMatchObject({ duplicate: true, status: "promoted", cardId: "card" });
    expect(db.bpmWebhookEntrada.create).not.toHaveBeenCalled();
  });
  it("corrida de unicidade retorna a entrada vencedora", async () => {
    db.bpmWebhookEntrada.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "vencedora", statusRecebimento: "AUTENTICADO", payloadSanitizadoJson: JSON.stringify(prepararLeadInstagram(lead)), eventoId: null, evento: null });
    db.bpmWebhookEntrada.create.mockRejectedValue({ code: "P2002" });
    expect(await receberInstagramLead("endpoint", lead)).toMatchObject({ leadId: "vencedora", duplicate: true, status: "pending" });
  });
  it("não confirma entrega para um ID que tenha rejeição/registro inválido preexistente", async () => {
    db.bpmWebhookEntrada.findUnique.mockResolvedValue({ id: "rejeitado", statusRecebimento: "REJEITADO", payloadSanitizadoJson: null, eventoId: null, evento: null });
    await expect(receberInstagramLead("endpoint", lead)).rejects.toMatchObject({ status: 409, codigo: "ENTRADA_INCONSISTENTE" });
    expect(db.bpmWebhookEntrada.create).not.toHaveBeenCalled();
  });
  it("não confirma entrega quando o envelope de uma chave pertence a outro ID", async () => {
    db.bpmWebhookEntrada.findUnique.mockResolvedValue({ id: "inconsistente", statusRecebimento: "AUTENTICADO", eventoId: null, evento: null,
      payloadSanitizadoJson: JSON.stringify(prepararLeadInstagram({ ...lead, id: "l:outro" })) });
    await expect(receberInstagramLead("endpoint", lead)).rejects.toMatchObject({ status: 409 });
  });
});
