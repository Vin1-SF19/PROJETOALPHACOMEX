import { describe, expect, it, vi } from "vitest";
import { capacidadesObrigatoriasPorEtapa, camposPublicadosPorEtapa } from "@/lib/bpm/campos-formulario-publicado";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: {} }));

describe("requisitos da composição publicada", () => {
  it("inclui apenas campos da etapa presentes no formulário ativo", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { campoId: "campo-visivel", secao: { formulario: { etapaId: "origem" } } },
      { campoId: "campo-destino", secao: { formulario: { etapaId: "destino" } } },
    ]);
    const mapa = await camposPublicadosPorEtapa(["origem", "destino"], { bpmFormularioComponente: { findMany } } as never);
    expect(mapa.get("origem")?.has("campo-visivel")).toBe(true);
    expect(mapa.get("origem")?.has("campo-destino")).toBe(false);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      tipo: "CAMPO", secao: { formulario: { ativo: true, etapaId: { in: ["origem", "destino"] } } },
    }) }));
  });

  it("permite desmarcar obrigações de blocos sem retirar o controle do card", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { capability: "MEETING_TRANSCRIPT", configJson: null, secao: { formulario: { etapaId: "origem" } } },
      { capability: "FOLLOW_UP_SCHEDULER", configJson: '{"obrigatorioSaida":false}', secao: { formulario: { etapaId: "origem" } } },
    ]);
    const mapa = await capacidadesObrigatoriasPorEtapa(["origem"], { bpmFormularioComponente: { findMany } } as never);
    expect(mapa.get("origem")?.has("MEETING_TRANSCRIPT")).toBe(true);
    expect(mapa.get("origem")?.has("FOLLOW_UP_SCHEDULER")).toBe(false);
  });
});
