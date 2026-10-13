import { describe, expect, it } from "vitest";
import { textoLegivelRd } from "@/lib/bpm/rd-station-text";
import { apresentarEventoRd, apresentarAjusteServicoRd, ajustesLegiveisRd, periodoOriginalRd } from "@/lib/bpm/rd-station-display";

describe("texto amigável RD", () => {
  it("mostra o serviço recuperado e sua reversão sem JSON ou evidências técnicas", () => {
    const display = apresentarAjusteServicoRd("RD_STATION_SERVICE_RECOVERY", JSON.stringify({ servico: "RevisÃ£o RADAR", evidencias: [{ id: "private-id" }] }));
    expect(display).toEqual({ title: "Serviço identificado no RD Station", description: "Revisão RADAR", actor: "Sistema", metadata: { origem: "rd-station" } });
    expect(apresentarAjusteServicoRd("RD_STATION_SERVICE_ROLLBACK", '{"servico":null}')?.description).toBe("Serviço voltou a ficar sem definição.");
    expect(apresentarAjusteServicoRd("RD_STATION_SERVICE_RECOVERY", "inválido")?.description).toBe("Serviço atualizado a partir do histórico do negócio.");
    expect(apresentarAjusteServicoRd(null, '{}')).toBeNull();
  });
  it.each([
    ["emprÃ©stimo", "empréstimo"],
    ["DocumentaÃ§Ã£o em anÃ¡lise", "Documentação em análise"],
    ["Crédito aprovado: emprÃ©stimo e revisão", "Crédito aprovado: empréstimo e revisão"],
    ["emprÃƒÂ©stimo", "empréstimo"],
    ["â€œRevisÃ£oâ€\u009d", "“Revisão”"],
    ["R$ 50 mil — ação, crédito, João, 🚀", "R$ 50 mil — ação, crédito, João, 🚀"],
    ["漢字 e opções válidas", "漢字 e opções válidas"],
    ["Ó\u00a0© e Á\u00a9", "Ó\u00a0© e Á\u00a9"],
    ["Ã incompleto �", "Ã incompleto �"],
  ])("converte %s sem danificar caracteres corretos", (input, expected) => {
    expect(textoLegivelRd(input)).toBe(expected);
    expect(textoLegivelRd(expected)).toBe(expected);
  });
  it("corrige somente apresentação, mantendo a projeção recebida", () => {
    const projecao = { title: "RevisÃ£o", content: "emprÃ©stimo" };
    expect(apresentarEventoRd({ tipo: "ACTIVITY_UNKNOWN", data: null, projecao })).toMatchObject({ titulo: "Revisão", conteudo: "empréstimo" });
    expect(projecao.content).toBe("emprÃ©stimo");
  });
  it("extrai datas úteis do exemplo RD sem expor identificadores", () => {
    expect(periodoOriginalRd({ id: "private-id", deal_stage_id: "private-stage", start_date: "2025-09-28T08:45:35.880-03:00", end_date: "2025-09-29T14:16:01.472-03:00" })).toEqual({ entrada: "2025-09-28T08:45:35.880-03:00", saida: "2025-09-29T14:16:01.472-03:00" });
  });
  it("apresenta ajustes com rótulos e acentos corretos", () => {
    expect(ajustesLegiveisRd({ title: "Anterior", sourceStageId: "id" }, { title: "RevisÃ£o", sourceStageId: "outro-id" })).toEqual([{ campo: "Título", data: false, antes: "Anterior", depois: "Revisão" }]);
  });
});
