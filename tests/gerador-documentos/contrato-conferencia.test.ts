import { describe, expect, it } from "vitest";
import { clausulasAtualizaveisContrato, valoresContratoParaConferencia } from "@/lib/gerador-documentos/contrato-conferencia";
import { VARIAVEIS_CONTRATO_PADRAO } from "@/lib/gerador-documentos/contrato-padrao";

describe("conferência de contrato automático", () => {
  it("marca dados ausentes e atualiza apenas cláusulas ainda não editadas", () => {
    const definicoes = VARIAVEIS_CONTRATO_PADRAO.filter((item) => item.nome === "data_assinatura");
    const fonte = "Assinado em {{data_assinatura}}.";
    const pendente = valoresContratoParaConferencia(definicoes, {}).data_assinatura;
    expect(pendente).toContain("PENDENTE DE CONFERÊNCIA");
    const clausulas = [
      { id: "original", conteudoOriginal: fonte, conteudo: `Assinado em ${pendente}.`, reescritoPorIA: false },
      { id: "manual", conteudoOriginal: fonte, conteudo: "Texto revisto pelo usuário", reescritoPorIA: false },
      { id: "ia", conteudoOriginal: fonte, conteudo: `Assinado em ${pendente}.`, reescritoPorIA: true },
    ];
    const resultado = clausulasAtualizaveisContrato({ definicoes, anteriores: {}, novos: { data_assinatura: "2026-09-25" }, clausulas });
    expect(resultado).toEqual([{ id: "original", conteudo: "Assinado em 25/09/2026." }]);
  });
});
