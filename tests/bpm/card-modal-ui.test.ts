import { describe, expect, it } from "vitest";
import { followUpBloqueiaFechamento } from "@/lib/bpm/card-modal-ui";

describe("CRM - fechamento do card com follow-up", () => {
  it.each(["CARREGANDO", "ERRO", "EM_ANDAMENTO"] as const)("bloqueia Em Tratativa no estado %s", (estado) => {
    expect(followUpBloqueiaFechamento("Em Tratativa", estado, true)).toBe(true);
  });

  it.each(["NAO_INICIADO", "CONCLUIDO"] as const)("libera quando o backend confirma %s", (estado) => {
    expect(followUpBloqueiaFechamento("Em Tratativa", estado, true)).toBe(false);
  });

  it("não prende participante somente leitura", () => {
    expect(followUpBloqueiaFechamento("Em Tratativa", "EM_ANDAMENTO", false)).toBe(false);
  });

  it("não interfere em outras etapas", () => {
    expect(followUpBloqueiaFechamento("Agendar Reunião", "CARREGANDO", true)).toBe(false);
  });
});
