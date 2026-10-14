import { describe, expect, it } from "vitest";
import { initialSla, isoDate, originalEntry, SLA_TARGETS } from "../../scripts/lib/rd-sla-import";

const now = "2026-10-14T12:00:00.000Z";
const base = { etapaId: "alpha-current", createdAt: "2026-01-01T10:00:00.000Z", now, moves: [] as { etapaDestinoId: string; at: unknown }[] };
const rd = (histories: unknown[]) => ({ sourceStageId: "rd-stage", targetStageId: "alpha-current", rawJson: JSON.stringify({ deal_stage_histories: histories }) });
const open = (start_date: unknown, extra: Record<string, unknown> = {}) => ({ deal_stage_id: "rd-stage", start_date, end_date: null, ...extra });

describe("entrada original comprovada para SLA", () => {
  it("recusa destinos divergentes no mesmo instante sem depender da ordem dos registros", () => {
    const moves = [{ etapaDestinoId: "alpha-current", at: "2026-10-01T10:00:00Z" }, { etapaDestinoId: "other", at: "2026-10-01T07:00:00-03:00" }];
    expect(originalEntry({ ...base, moves })).toBeNull();
    expect(originalEntry({ ...base, moves: [...moves].reverse() })).toBeNull();
    expect(originalEntry({ ...base, moves: [moves[0], moves[0]] })?.source).toBe("MOVIMENTO_ALPHA");
  });
  it("prioriza o último movimento Alpha da etapa atual sobre o histórico RD e criação", () => {
    expect(originalEntry({ ...base, moves: [
      { etapaDestinoId: "alpha-current", at: "2026-10-01T10:00:00Z" },
      { etapaDestinoId: "other", at: "2026-10-02T10:00:00Z" },
      { etapaDestinoId: "alpha-current", at: "2026-10-03T10:00:00-03:00" },
    ], origin: rd([open("2026-01-01T10:00:00Z")]) })).toEqual({ date: "2026-10-03T13:00:00.000Z", source: "MOVIMENTO_ALPHA" });
  });
  it("não usa movimento antigo compatível se o último aponta outra etapa", () => {
    expect(originalEntry({ ...base, moves: [
      { etapaDestinoId: "alpha-current", at: "2026-10-01T10:00:00Z" },
      { etapaDestinoId: "other", at: "2026-10-02T10:00:00Z" },
    ], origin: rd([open("2026-01-01T10:00:00Z")]) })).toBeNull();
  });
  it.each([null, "inválida", "2026-10-15T00:00:00Z"])("movimento inválido/futuro %s não permite fallback para criação ou RD", (at) => {
    for (const origin of [undefined, rd([open("2026-01-01T10:00:00Z")])]) {
      expect(originalEntry({ ...base, origin, moves: [{ etapaDestinoId: "alpha-current", at }] })).toBeNull();
    }
  });
  it("um movimento sem data torna ambígua a ordem mesmo havendo outro válido", () => {
    expect(originalEntry({ ...base, moves: [
      { etapaDestinoId: "alpha-current", at: "2026-10-01T10:00:00Z" },
      { etapaDestinoId: "other", at: "inválida" },
    ] })).toBeNull();
  });
  it("sem movimentos escolhe a entrada RD aberta mais recente da etapa correspondente", () => {
    expect(originalEntry({ ...base, origin: rd([
      open("2026-10-03T10:00:00.001Z"), open("2026-10-03T10:00:00.002Z"),
      open("2026-10-04T10:00:00Z", { end_date: "2026-10-05T10:00:00Z" }),
      open("2026-10-06T10:00:00Z", { deal_stage_id: "outro-rd" }),
    ]) })).toEqual({ date: "2026-10-03T10:00:00.002Z", source: "HISTORICO_RD" });
  });
  it.each([null, "inválida", "2026-10-15T00:00:00Z"])("entrada RD aberta inválida/futura %s bloqueia em vez de escolher outra antiga", (date) => {
    expect(originalEntry({ ...base, origin: rd([open("2026-10-01T10:00:00Z"), open(date)]) })).toBeNull();
  });
  it("não inventa data de criação para origem RD sem entrada aberta ou com destino divergente", () => {
    expect(originalEntry({ ...base, origin: rd([]) })).toBeNull();
    expect(originalEntry({ ...base, origin: rd([open("2026-01-01", { end_date: "2026-01-02" })]) })).toBeNull();
    expect(originalEntry({ ...base, origin: { ...rd([open("2026-01-01")]), targetStageId: "outra-etapa" } })).toBeNull();
  });
  it("payload RD corrompido é exceção explícita, nunca fallback silencioso", () => {
    expect(() => originalEntry({ ...base, origin: { ...rd([]), rawJson: "{corrompido" } })).toThrow();
  });
  it("criação serve somente para card nativo sem movimentos e com data válida não futura", () => {
    expect(originalEntry(base)).toEqual({ date: base.createdAt, source: "CRIACAO_ALPHA_SEM_MOVIMENTOS" });
    for (const createdAt of [null, "inválida", "2026-10-15T00:00:00Z"]) expect(originalEntry({ ...base, createdAt })).toBeNull();
  });
  it("compara agora por instante normalizado, não pela representação de fuso", () => {
    expect(originalEntry({ ...base, createdAt: now, now: "2026-10-14T09:00:00-03:00" })).toEqual({ date: now, source: "CRIACAO_ALPHA_SEM_MOVIMENTOS" });
    expect(originalEntry({ ...base, now: "inválido" })).toBeNull();
  });
});

describe("prazo histórico de dias corridos", () => {
  it.each([1, 12])("soma exatamente %s dias de 24 horas, inclusive passagem de fim de semana", (days) => {
    const start = "2026-10-09T13:45:00.000Z";
    const expected = new Date(Date.parse(start) + days * 86400000).toISOString();
    expect(initialSla(start, days, expected)).toEqual({ inicioContagem: start, deadline: expected, prazoFinal: expected, status: "DENTRO_PRAZO", vencidoEm: null });
    expect(initialSla(start, days, new Date(Date.parse(expected) - 1).toISOString()).status).toBe("DENTRO_PRAZO");
    expect(initialSla(start, days, new Date(Date.parse(expected) + 1).toISOString())).toMatchObject({ status: "ATRASADO", vencidoEm: expected });
  });
  it("preserva atraso histórico, sem reiniciar relógio na data da migração", () => {
    expect(initialSla("2025-01-01T12:00:00.000Z", 12, now)).toMatchObject({ inicioContagem: "2025-01-01T12:00:00.000Z", deadline: "2025-01-13T12:00:00.000Z", vencidoEm: "2025-01-13T12:00:00.000Z", status: "ATRASADO" });
  });
  it.each([0, -1, 1.5, NaN])("recusa prazo inválido %s", (days) => {
    expect(() => initialSla(base.createdAt, days, now)).toThrow("Prazo inválido");
  });
  it("recusa datas inválidas e interpreta SQL DATETIME com frações como UTC", () => {
    expect(() => initialSla("inválida", 1, now)).toThrow();
    expect(() => initialSla(base.createdAt, 1, "inválida")).toThrow();
    expect(isoDate("2026-10-14 12:00:00.123")).toBe("2026-10-14T12:00:00.123Z");
    expect(isoDate(Date.parse(now))).toBe(now);
    expect(isoDate(null)).toBeNull();
  });
  it("mapeia dez destinos, incluindo cancelados, sem inferir nomes desconhecidos", () => {
    expect(new Set(Object.values(SLA_TARGETS).map(([p, e]) => `${p}/${e}`)).size).toBe(10);
    expect(SLA_TARGETS["CLIENTES CANCELADOS"]).toEqual(["Operacional", "Cliente cancelado"]);
    expect(SLA_TARGETS["unknown-stage"]).toBeUndefined();
  });
});
