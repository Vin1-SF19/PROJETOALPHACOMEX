import { describe, expect, it } from "vitest";

import {
  BPM_PIPELINE_EVENT,
  canalPipelineBpm,
  criarBpmRealtimePayload,
  extrairPipelineIdCanalBpm,
} from "@/lib/bpm/realtime";

describe("realtime do AlphaCRM", () => {
  it("gera e interpreta o canal privado canônico do pipeline", () => {
    const pipelineId = "cm123_pipeline-1";
    const canal = canalPipelineBpm(pipelineId);

    expect(canal).toBe("private-alpha-crm-pipeline-cm123_pipeline-1");
    expect(extrairPipelineIdCanalBpm(canal)).toBe(pipelineId);
    expect(BPM_PIPELINE_EVENT).toBe("alpha-crm-atualizado");
  });

  it("rejeita nomes de canal e IDs inválidos", () => {
    expect(extrairPipelineIdCanalBpm("private-alpha-crm-pipeline-")).toBeNull();
    expect(extrairPipelineIdCanalBpm("private-alpha-crm-pipeline-id/injetado")).toBeNull();
    expect(extrairPipelineIdCanalBpm("private-outro-canal-id")).toBeNull();
    expect(() => canalPipelineBpm("id/injetado")).toThrow();
  });

  it("constrói payload com somente os campos permitidos", () => {
    const payload = criarBpmRealtimePayload({
      pipelineId: "pipeline-1",
      tipo: "CARD_MOVIDO",
      agora: new Date("2026-08-12T12:34:56.000Z"),
    });

    expect(payload).toEqual({
      pipelineId: "pipeline-1",
      tipo: "CARD_MOVIDO",
      timestamp: "2026-08-12T12:34:56.000Z",
    });
    expect(payload).not.toHaveProperty("cardId");
    expect(Object.keys(payload).sort()).toEqual(["pipelineId", "timestamp", "tipo"]);
  });

  it("omite cardId em alterações de configuração do pipeline", () => {
    const payload = criarBpmRealtimePayload({
      pipelineId: "pipeline-1",
      tipo: "ETAPA_ALTERADA",
      agora: new Date("2026-08-12T12:34:56.000Z"),
    });

    expect(payload).toEqual({
      pipelineId: "pipeline-1",
      tipo: "ETAPA_ALTERADA",
      timestamp: "2026-08-12T12:34:56.000Z",
    });
    expect(Object.keys(payload).sort()).toEqual(["pipelineId", "timestamp", "tipo"]);
  });
});
