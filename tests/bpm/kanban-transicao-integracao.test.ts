import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { verificarTransicaoPermitidaBpm } from "@/lib/bpm/requisitos-etapa-server";

const client = {
  bpmTransicaoEtapa: { findUnique: vi.fn() },
};

describe("transição canônica do Kanban", () => {
  beforeEach(() => vi.clearAllMocks());

  it("aceita uma aresta canônica manual ativa", async () => {
    client.bpmTransicaoEtapa.findUnique.mockResolvedValue({ permitida: true, origem: "MANUAL" });
    await expect(verificarTransicaoPermitidaBpm("origem", "destino", "MANUAL", client as never))
      .resolves.toEqual({ permitida: true });
    expect(client.bpmTransicaoEtapa.findUnique).toHaveBeenCalledWith({
      where: { etapaOrigemId_etapaDestinoId: { etapaOrigemId: "origem", etapaDestinoId: "destino" } },
      select: { permitida: true, origem: true },
    });
  });

  it("falha fechada quando a aresta canônica não existe", async () => {
    client.bpmTransicaoEtapa.findUnique.mockResolvedValue(null);
    await expect(verificarTransicaoPermitidaBpm("origem", "destino", "MANUAL", client as never))
      .resolves.toEqual({ permitida: false, motivo: "Esta transição não está definida no pipeline." });
  });

  it("bloqueia uma aresta canônica desativada", async () => {
    client.bpmTransicaoEtapa.findUnique.mockResolvedValue({ permitida: false, origem: "AMBOS" });
    await expect(verificarTransicaoPermitidaBpm("origem", "destino", "MANUAL", client as never))
      .resolves.toEqual({ permitida: false, motivo: "Esta transição foi desativada pelo administrador." });
  });

  it("respeita a origem manual/automação da aresta canônica", async () => {
    client.bpmTransicaoEtapa.findUnique.mockResolvedValue({ permitida: true, origem: "AUTOMACAO" });
    await expect(verificarTransicaoPermitidaBpm("origem", "destino", "MANUAL", client as never))
      .resolves.toEqual({ permitida: false, motivo: "Esta transição só é permitida pelo Motor de Automações." });
    await expect(verificarTransicaoPermitidaBpm("origem", "destino", "AUTOMACAO", client as never))
      .resolves.toEqual({ permitida: true });
  });

  it("não consulta persistência quando origem e destino são iguais", async () => {
    await expect(verificarTransicaoPermitidaBpm("mesma", "mesma", "MANUAL", client as never))
      .resolves.toEqual({ permitida: true });
    expect(client.bpmTransicaoEtapa.findUnique).not.toHaveBeenCalled();
  });
});
