import { describe, expect, it } from "vitest";
import { intencaoNotificacaoBpmDaUrl } from "@/lib/bpm/notificacoes-navegacao";
describe("destino de notificação CRM", () => {
  it("preserva tarefa/card e distingue ID virtual de CUID", () => {
    expect(intencaoNotificacaoBpmDaUrl("/PainelAlpha/AlphaCRM/pipeline/p?origemLead=instagram&leadId=id-comum")).toEqual({ pipelineId: "p", origemLead: "instagram", leadId: "id-comum" });
    expect(intencaoNotificacaoBpmDaUrl("/PainelAlpha/AlphaCRM/pipeline/p?cardId=cm12345678901234567890123&recepcaoId=r1")).toEqual({ pipelineId: "p", cardId: "cm12345678901234567890123", recepcaoId: "r1" });
  });
  it("rejeita ambiguidades, origens externas, IDs vazios e intentos misturados", () => {
    for (const url of [
      "https://outro.test/PainelAlpha/AlphaCRM/pipeline/p?origemLead=instagram&leadId=a",
      "/PainelAlpha/AlphaCRM/pipeline/p?origemLead=instagram&leadId=a&leadId=b",
      "/PainelAlpha/AlphaCRM/pipeline/p?origemLead=instagram&leadId=a&tarefaId=t",
      "/PainelAlpha/AlphaCRM/pipeline/p?origemLead=instagram&leadId=a&cardId=cm12345678901234567890123",
      "/PainelAlpha/AlphaCRM/pipeline/p?origemLead=outro&leadId=a",
      "/PainelAlpha/AlphaCRM/pipeline/p?origemLead=instagram&leadId=",
    ]) expect(intencaoNotificacaoBpmDaUrl(url)).toBeNull();
  });
});
