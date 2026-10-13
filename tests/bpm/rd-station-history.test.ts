import { describe, expect, it } from "vitest";
import { corrigirProjecaoHistoricoRd, projetarEventosHistoricoRd } from "@/lib/bpm/rd-station-history";

describe("projetarEventosHistoricoRd", () => {
  it("preserva payloads e datas de etapa/atividade, ordenando cronologicamente", () => {
    const stage = { id: "history-2", deal_stage_id: "stage-b", start_date: "2026-01-03T10:00:00Z", end_date: null };
    const activity = { id: "activity-1", type: "note", created_at: "2026-01-02T10:00:00Z", text: "Anotação sintética" };
    const result = projetarEventosHistoricoRd({ deal_stage_histories: [stage] }, [activity], new Map([["stage-b", "Em tratativas"]]));
    expect(result.map((event) => event.sourceKey)).toEqual(["activity:activity-1", "stage:history-2"]);
    expect(result[1].raw).toEqual(stage);
    expect(result[1].projection).toMatchObject({ title: "Em tratativas", sourceStageId: "stage-b", date: stage.start_date });
    expect(result[0].raw).toEqual(activity);
  });

  it("não inventa timestamps e coloca eventos sem data após os datados", () => {
    const missingDate = { _id: "activity-missing", type: "email", subject: "Sem data" };
    const dated = { _id: "activity-dated", type: "call", date: "2026-03-01T00:00:00Z" };
    const result = projetarEventosHistoricoRd({ deal_stage_histories: [] }, [missingDate, dated], new Map());
    expect(result[0].sourceKey).toBe("activity:activity-dated");
    expect(result[1].occurredAt).toBeNull();
    expect(result[1].projection.date).toBeNull();
  });

  it("gera chave estável quando a API não fornece identificador do evento", () => {
    const event = { type: "note", text: "Synthetic payload" };
    const first = projetarEventosHistoricoRd({}, [event], new Map())[0];
    const second = projetarEventosHistoricoRd({}, [event], new Map())[0];
    expect(first.sourceKey).toBe(second.sourceKey);
    expect(first.sourceEventId).toBeNull();
  });

  it("corrige a projeção sem alterar o payload original", () => {
    const original = { title: "Stage RD", content: null, date: "2026-01-01", sourceStageId: "stage-1" };
    const result = corrigirProjecaoHistoricoRd(original, { title: "Etapa revisada", content: "Representação corrigida", date: "2026-01-02" });
    expect(result.title).toBe("Etapa revisada");
    expect(result.sourceStageId).toBe("stage-1");
    expect(original).toEqual({ title: "Stage RD", content: null, date: "2026-01-01", sourceStageId: "stage-1" });
  });
});
