import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: {} }));

import { calcularProximaRecorrencia } from "@/lib/bpm/automacoes/agenda";
import { materializarExecucoesEventosBpm, publicarEventoBpm, sanitizarPayloadAutomacao } from "@/lib/bpm/automacoes/eventos";
import { chamadaHttpSchema, validarGrafoAutomacao, validarParametrosAcaoCentral } from "@/lib/bpm/automacoes/central-schemas";
import { executarHttpSeguro } from "@/lib/bpm/automacoes/safe-http";

const FIM = { id: "fim", tipo: "FIM" as const };

describe("Motor Central de Automações", () => {
  it("valida fluxo sequencial e branch IF/THEN/ELSE", () => {
    const grafo = validarGrafoAutomacao({
      inicioId: "if", nos: [
        { id: "if", tipo: "CONDICAO", condicao: { operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "card", campo: "status" }, operador: "igual", valor: "ATIVO" }] }, entaoId: "nota", senaoId: "fim" },
        { id: "nota", tipo: "ACAO", acaoTipo: "ADICIONAR_ANOTACAO", parametros: { texto: "Ativo" }, proximoId: "fim" },
        FIM,
      ],
    });
    expect(grafo.nos).toHaveLength(3);
  });

  it("rejeita ciclos, referências inválidas e nós inacessíveis", () => {
    expect(() => validarGrafoAutomacao({ inicioId: "a", nos: [{ id: "a", tipo: "ESPERA", minutos: 1, proximoId: "a" }] })).toThrow(/acíclico/);
    expect(() => validarGrafoAutomacao({ inicioId: "a", nos: [{ id: "a", tipo: "ACAO", acaoTipo: "ADICIONAR_ANOTACAO", parametros: { texto: "x" }, proximoId: "ausente" }] })).toThrow(/inexistente/);
    expect(() => validarGrafoAutomacao({ inicioId: "fim", nos: [FIM, { id: "solto", tipo: "FIM" }] })).toThrow(/inacessíveis/);
  });

  it("valida parâmetros estritos por catálogo de ação", () => {
    expect(validarParametrosAcaoCentral("CRIAR_TAREFA", { titulo: "Ligar", prioridade: "ALTA" })).toMatchObject({ titulo: "Ligar", prioridade: "ALTA" });
    expect(() => validarParametrosAcaoCentral("MOVER_CARD", { etapaId: "não-cuid" })).toThrow();
    expect(() => validarParametrosAcaoCentral("ADICIONAR_ANOTACAO", { texto: "ok", shell: "rm" })).toThrow();
  });

  it("remove segredos e limita estruturas no payload de eventos", () => {
    const limpo = sanitizarPayloadAutomacao({ token: "secreto", Authorization: "Bearer x", nome: "Alpha", nested: { senha: "123", valor: true } });
    expect(limpo).toEqual({ nome: "Alpha", nested: { valor: true } });
  });

  it("aceita somente HTTPS e bloqueia headers de credenciais na configuração", () => {
    expect(chamadaHttpSchema.safeParse({ url: "https://example.com/hook", metodo: "POST", headers: {}, corpo: { ok: true } }).success).toBe(true);
    expect(chamadaHttpSchema.safeParse({ url: "não é url", metodo: "DELETE" }).success).toBe(false);
  });

  it("calcula recorrência horária e respeita data limite", () => {
    const base = new Date("2026-09-04T10:00:00.000Z");
    expect(calcularProximaRecorrencia({ tipo: "INTERVALO_HORAS", intervaloHoras: 2 }, base)?.toISOString()).toBe("2026-09-04T12:00:00.000Z");
    expect(calcularProximaRecorrencia({ tipo: "INTERVALO_HORAS", intervaloHoras: 2, ate: "2026-09-04T11:00:00.000Z" }, base)).toBeNull();
    expect(calcularProximaRecorrencia({ tipo: "DIARIA", hora: "09:00" }, new Date("2026-09-04T13:00:00.000Z"), "America/Sao_Paulo")?.toISOString()).toBe("2026-09-05T12:00:00.000Z");
  });

  it("deduplica a publicação de evento pela chave de idempotência", async () => {
    const existente = { id: "evento-existente" };
    const client = {
      bpmEventoDominio: {
        create: vi.fn().mockRejectedValue({ code: "P2002" }),
        findUnique: vi.fn().mockResolvedValue(existente),
      },
    };
    const resultado = await publicarEventoBpm({
      tipo: "CARD_CRIADO",
      entidadeTipo: "CARD",
      entidadeId: "cm12345678901234567890123",
      cardId: "cm12345678901234567890123",
      pipelineId: "cm12345678901234567890124",
      atorTipo: "SISTEMA",
      ocorridoEm: new Date("2026-09-04T12:00:00.000Z"),
      correlationId: "corr-1",
      profundidade: 0,
      idempotencyKey: "card:1:criado",
    }, client as never);
    expect(resultado).toBe(existente);
    expect(client.bpmEventoDominio.findUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: "card:1:criado" },
    });
  });

  it("materializa somente uma execução efetiva e ignora reentrada causal", async () => {
    const create = vi.fn().mockResolvedValue({ id: "exec-1" });
    const client = {
      bpmAutomacaoVersao: { findMany: vi.fn().mockResolvedValue([{
        id: "versao-1", automacaoId: "automacao-1", gatilhoTipo: "CARD_CRIADO",
        gatilhoConfigJson: "{}", automacao: { etapaId: "etapa-1", pipelineId: "pipeline-1" },
      }]) },
      bpmEventoDominio: { findMany: vi.fn().mockResolvedValue([{
        id: "evento-1", tipo: "CARD_CRIADO", cardId: "card-1",
        correlationId: "corr-1", causationId: null, profundidade: 0,
        valorAnteriorJson: null, valorNovoJson: "{}",
      }]) },
      bpmAutomacaoExecucao: { findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "anterior" }), create },
    };
    expect(await materializarExecucoesEventosBpm(10, client as never)).toMatchObject({ criadas: 1 });
    expect(await materializarExecucoesEventosBpm(10, client as never)).toMatchObject({ criadas: 0 });
    expect(create).toHaveBeenLastCalledWith({ data: expect.objectContaining({
      status: "IGNORADA",
      resultadoJson: expect.stringContaining("VERSAO_JA_EXECUTADA_NA_CADEIA"),
    }) });
  });

  it("bloqueia HTTP sem TLS antes de qualquer chamada externa", async () => {
    await expect(executarHttpSeguro({
      url: "http://127.0.0.1/admin",
      metodo: "GET",
      headers: {},
      timeoutMs: 1_000,
    }, "http-test-1")).rejects.toThrow(/HTTPS/);
  });
});
