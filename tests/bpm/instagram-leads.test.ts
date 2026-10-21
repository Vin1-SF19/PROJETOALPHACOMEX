import { describe, expect, it } from "vitest";
import { INSTAGRAM_COLUNAS as C, INSTAGRAM_SPREADSHEET_ID, anotacaoLeadInstagram, chaveLeadInstagram, instagramIngestSchema,
  instagramLinhaSchema, leadInstagramEhTeste, lerLeadInstagram, prepararLeadInstagram, radarInstagram } from "@/lib/bpm/instagram-leads";

export const linha = {
  id: "l:00000000000000001", created_time: "2026-10-21T09:00:00-03:00", full_name: "Contato Exemplo",
  email: "contato@example.com", platform: "ig" as const,
  [C.radar]: "limitada_usd_50k_semestrais", [C.telefone]: "(11) 99999-0000", [C.cnpj]: "11.222.333/0001-81",
  [C.volume]: "acima_de_150_mil_dólares", [C.prazo]: "\u2060em_até_6_meses", campaign_name: "Campanha exemplo",
};

describe("de/para e envelope Instagram", () => {
  it.each([
    ["ilimitado", "Revisão de Radar Ilimitado"],
    ["limitada_usd_50k_semestrais", "Habilitação de Radar 50k"],
    ["limitada_usd_150k_semestrais", "Revisão de Radar Limitado a USD150k"],
    ["não_tenho_empresa,_estou_em_fase_de_constituição", null], ["nova resposta", null],
  ])("converte M %s em %s", (raw, esperado) => expect(radarInstagram(raw)).toBe(esperado));

  it("M determina Radar mesmo com N indicando volume superior; dados originais são preservados", () => {
    const dados = prepararLeadInstagram(linha);
    expect(dados.radarPretendido).toBe("Habilitação de Radar 50k");
    expect(dados.cnpj).toBe("11222333000181");
    expect(dados.telefone).toBe("11999990000");
    expect(dados.prazo).toBe("em até 6 meses");
    expect(dados.linha[C.prazo]).toBe("\u2060em_até_6_meses");
    expect(anotacaoLeadInstagram(dados)).toContain("Captado em: 2026-10-21T09:00:00-03:00");
    expect(anotacaoLeadInstagram(dados)).toContain("acima de 150 mil dólares");
  });

  it("não transforma contato/CNPJ inválido em dado válido ou perde a resposta", () => {
    const dados = prepararLeadInstagram({ ...linha, [C.cnpj]: "123", [C.telefone]: "sem telefone", email: "invalido" });
    expect(dados).toMatchObject({ cnpj: null, telefone: null, email: null, cnpjOriginal: "123", telefoneOriginal: "sem telefone" });
    expect(dados.linha.email).toBe("invalido");
  });

  it("fonte é fixa; IDs numéricos são recusados e campos de atribuição/segredos são removidos", () => {
    const input = { spreadsheetId: INSTAGRAM_SPREADSHEET_ID, sheetId: 0, lead: { ...linha, responsavelId: 7, authorization: "segredo", status_crm: "integrado" } };
    const parsed = instagramIngestSchema.parse(input);
    expect(parsed.lead.id).toBe("l:00000000000000001");
    expect(parsed.lead).not.toHaveProperty("authorization");
    expect(parsed.lead).not.toHaveProperty("responsavelId");
    expect(parsed.lead).not.toHaveProperty("status_crm");
    expect(instagramIngestSchema.safeParse({ ...input, spreadsheetId: "outra" }).success).toBe(false);
    expect(instagramLinhaSchema.safeParse({ ...linha, id: 9007199254740992 }).success).toBe(false);
    expect(instagramLinhaSchema.safeParse({ ...linha, platform: "fb" }).success).toBe(false);
  });

  it("não confia em valores derivados de envelope persistido e ignora testes do Meta", () => {
    const dados = prepararLeadInstagram(linha);
    expect(lerLeadInstagram(JSON.stringify({ ...dados, cnpj: "123", radarPretendido: "inventado" }))).toEqual(dados);
    expect(lerLeadInstagram("{invalido")).toBeNull();
    expect(leadInstagramEhTeste({ ...linha, full_name: "<test lead: dummy data for full_name>" })).toBe(true);
    expect(chaveLeadInstagram(linha.id)).toContain(linha.id);
  });
});
