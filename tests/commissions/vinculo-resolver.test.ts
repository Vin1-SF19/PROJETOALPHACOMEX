import { describe, expect, it } from "vitest";
import { resolverVinculoNaData } from "@/lib/commissions/vinculo-resolver";
import type { ContratoColaboradorRecord } from "@/lib/commissions/vinculo-resolver";

function contrato(overrides: Partial<ContratoColaboradorRecord>): ContratoColaboradorRecord {
  return {
    id: "c1",
    usuarioId: 1,
    tipo: "CLT",
    dataInicio: new Date("2026-01-01T00:00:00.000Z"),
    dataFim: null,
    ...overrides,
  };
}

describe("resolverVinculoNaData", () => {
  it("resolve CLT corretamente quando vigente e dataFim é null (vínculo ainda ativo)", () => {
    const c = contrato({ tipo: "CLT", dataInicio: new Date("2026-01-01T00:00:00.000Z"), dataFim: null });
    const result = resolverVinculoNaData([c], 1, new Date("2026-07-28T00:00:00.000Z"));
    expect(result).toEqual({ status: "RESOLVIDO", vinculo: "CLT", contratoId: "c1" });
  });

  it("resolve PJ corretamente com dataFim futura definida", () => {
    const c = contrato({
      tipo: "PJ",
      dataInicio: new Date("2026-01-01T00:00:00.000Z"),
      dataFim: new Date("2026-12-31T00:00:00.000Z"),
    });
    const result = resolverVinculoNaData([c], 1, new Date("2026-07-28T00:00:00.000Z"));
    expect(result).toEqual({ status: "RESOLVIDO", vinculo: "PJ", contratoId: "c1" });
  });

  it("normaliza case/espaço: ' clt ' vira CLT", () => {
    const c = contrato({ tipo: " clt " });
    const result = resolverVinculoNaData([c], 1, new Date("2026-07-28T00:00:00.000Z"));
    expect(result).toEqual({ status: "RESOLVIDO", vinculo: "CLT", contratoId: "c1" });
  });

  it("vínculo vencido (dataFim no passado) → SEM_VINCULO_VIGENTE", () => {
    const c = contrato({
      dataInicio: new Date("2026-01-01T00:00:00.000Z"),
      dataFim: new Date("2026-03-01T00:00:00.000Z"),
    });
    const result = resolverVinculoNaData([c], 1, new Date("2026-07-28T00:00:00.000Z"));
    expect(result.status).toBe("SEM_VINCULO_VIGENTE");
  });

  it("sem nenhum registro para o usuário → SEM_VINCULO_VIGENTE", () => {
    const result = resolverVinculoNaData([], 1, new Date("2026-07-28T00:00:00.000Z"));
    expect(result.status).toBe("SEM_VINCULO_VIGENTE");
  });

  it("tipo não reconhecido (não normaliza para CLT nem PJ) → divergência explícita, nunca lança exceção", () => {
    const c = contrato({ tipo: "Efetivo" });
    const result = resolverVinculoNaData([c], 1, new Date("2026-07-28T00:00:00.000Z"));
    expect(result.status).toBe("TIPO_NAO_RECONHECIDO");
    if (result.status === "TIPO_NAO_RECONHECIDO") {
      expect(result.valorOriginal).toBe("Efetivo");
    }
  });

  it("múltiplos vínculos vigentes simultâneos → divergência, nunca escolhe um sozinho", () => {
    const c1 = contrato({ id: "c1", tipo: "CLT" });
    const c2 = contrato({ id: "c2", tipo: "PJ" });
    const result = resolverVinculoNaData([c1, c2], 1, new Date("2026-07-28T00:00:00.000Z"));
    expect(result.status).toBe("MULTIPLOS_VINCULOS_VIGENTES");
  });

  it("troca de cargo/vínculo ao longo do tempo: resolve o vínculo correto por vigência histórica", () => {
    const antigo = contrato({
      id: "antigo",
      tipo: "CLT",
      dataInicio: new Date("2025-01-01T00:00:00.000Z"),
      dataFim: new Date("2026-03-31T00:00:00.000Z"),
    });
    const novo = contrato({
      id: "novo",
      tipo: "PJ",
      dataInicio: new Date("2026-04-01T00:00:00.000Z"),
      dataFim: null,
    });

    const antesTroca = resolverVinculoNaData([antigo, novo], 1, new Date("2026-02-01T00:00:00.000Z"));
    expect(antesTroca).toEqual({ status: "RESOLVIDO", vinculo: "CLT", contratoId: "antigo" });

    const depoisTroca = resolverVinculoNaData([antigo, novo], 1, new Date("2026-07-28T00:00:00.000Z"));
    expect(depoisTroca).toEqual({ status: "RESOLVIDO", vinculo: "PJ", contratoId: "novo" });
  });
});
