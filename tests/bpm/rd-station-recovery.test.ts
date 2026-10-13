import { describe, expect, it, vi } from "vitest";
import { carregarEtapasRd, completarEtapasHistoricasRd } from "@/lib/bpm/rd-station-stages";
import { resolverServicoRd } from "@/lib/bpm/rd-station-service";
import { repararNomeEtapaRd, camposProtegidosHistoricoRd } from "@/lib/bpm/rd-station-recovery";
import { apresentarEventoRd, combinarHistoricosRd, ordenarHistoricoRd } from "@/lib/bpm/rd-station-display";

describe("catálogo RD por funil", () => {
  it("recupera etapas históricas fora dos funis atuais e distingue remoção de falha de API", async () => {
    const names = new Map([["known", "Conhecida"]]);
    const request = vi.fn().mockResolvedValueOnce({ name: "Histórica" }).mockRejectedValueOnce(new Error("RD_HTTP_404"));
    expect([...(await completarEtapasHistoricasRd(names, ["known", "old", "old", "removed"], request))]).toEqual(["removed"]);
    expect(names.get("old")).toBe("Histórica");
    expect(request).toHaveBeenCalledTimes(2);
    await expect(completarEtapasHistoricasRd(names, ["private"], vi.fn().mockRejectedValue(new Error("RD_HTTP_401")))).rejects.toThrow("401");
  });
  it("busca cada funil e respeita paginação de 12 etapas", async () => {
    const request = vi.fn(async (_path, params) => ({
      has_more: params.deal_pipeline_id === "a" && params.page === 1,
      deal_stages: [{ id: `${params.deal_pipeline_id}-${params.page}`, name: `Etapa ${params.page}` }],
    }));
    const names = await carregarEtapasRd(["a", "a", "b"], request);
    expect([...names.keys()]).toEqual(["a-1", "a-2", "b-1"]);
    expect(request).toHaveBeenNthCalledWith(2, "deal_stages", { deal_pipeline_id: "a", page: 2, limit: 12 });
  });
  it("não aceita catálogo parcial após falha de API", async () => {
    await expect(carregarEtapasRd(["a", "b"], vi.fn().mockResolvedValueOnce({ has_more: false, deal_stages: [] }).mockRejectedValueOnce(new Error("RD_HTTP_401")))).rejects.toThrow("401");
  });
  it("interrompe paginação que nunca termina", async () => {
    await expect(carregarEtapasRd(["a"], async () => ({ has_more: true, deal_stages: [] }))).rejects.toThrow("não concluída");
  });
});

describe("serviço por negócio RD", () => {
  const modalidade = (value: string) => ({ deal_custom_fields: [{ custom_field: { label: "Radar pretendido " }, value }] });
  it("distingue serviços de dois negócios sem usar CNPJ/funil como serviço padrão", () => {
    expect(resolverServicoRd(modalidade("Modalidade ilimitada")).servico).toBe("Revisão RADAR - ILIMITADO");
    expect(resolverServicoRd(modalidade("Modalidade de 150 mil dólares semestrais")).servico).toBe("Revisão RADAR - 150K");
    expect(resolverServicoRd({}).servico).toBeNull();
  });
  it("produtos repetidos do mesmo serviço não geram dois serviços/cards", () => {
    const product = { name: "Habilitar o RADAR de US$ 50 mil semestrais" };
    expect(resolverServicoRd({ deal_products: [product, product] }).candidatos).toEqual(["Habilitação RADAR - 50K"]);
  });
  it("produto e modalidade divergentes ficam para revisão", () => {
    const result = resolverServicoRd({ ...modalidade("Modalidade ilimitada"), deal_products: [{ name: "Habilitar o RADAR de US$ 50 mil semestrais" }] });
    expect(result).toMatchObject({ servico: null, motivo: "servicos_divergentes" });
  });
  it("não associa produtos desconhecidos por similaridade nem ignora um segundo produto", () => {
    expect(resolverServicoRd({ ...modalidade("Habilitação"), deal_products: [{ name: "Assessoria a definir" }] })).toMatchObject({ servico: null, motivo: "valor_nao_mapeado" });
  });
});

describe("reparação de histórico sem perda", () => {
  it("reversão automática permite nova prévia sem apagar proteção de edições humanas", () => {
    const fields = camposProtegidosHistoricoRd([
      { id: "rdrollback_1", autorId: null, camposAlteradosJson: '{"sourceStageName":true}' },
      { id: "rdrepair_1", autorId: null, camposAlteradosJson: '{"sourceStageName":true}' },
      { id: "manual-1", autorId: null, camposAlteradosJson: '{"title":true}' },
    ]);
    expect([...fields]).toEqual(["title"]);
  });
  it("preenche nome de etapa preservando data, conteúdo e título corrigidos", () => {
    const original = { title: "Título ajustado", content: "Nota", date: "2020-01-01" };
    expect(repararNomeEtapaRd(original, "Documentação", new Set(["title"]))).toEqual({ ...original, sourceStageName: "Documentação" });
    expect(original).not.toHaveProperty("sourceStageName");
    expect(repararNomeEtapaRd({ title: "Mudança de etapa RD" }, "Revisão", new Set()).title).toBe("Revisão");
  });
  const event = (id: string, date: string | null) => ({ id, tipo: "ACTIVITY_UNKNOWN", data: "2020-01-01", projecao: { date, content: "Texto importado" } });
  it("usa título legível para atividades sem tipo, sem esconder seu texto", () => {
    expect(apresentarEventoRd(event("a", null))).toMatchObject({ titulo: "Atividade RD Station", conteudo: "Texto importado", data: "" });
  });
  it("ordena por data corrigida e preserva remoção explícita da data", () => {
    expect(ordenarHistoricoRd([event("sem", ""), event("b", "2026-02-01"), event("a", "2026-01-01")]).map((e) => e.id)).toEqual(["a", "b", "sem"]);
  });
  it("intercala eventos Alpha e RD na aba Histórico sem perder eventos sem data", () => {
    const merged = combinarHistoricosRd([{ id: "alpha", data: new Date("2026-02-01") }], [event("antigo", "2026-01-01"), event("novo", "2026-03-01"), event("sem", null)]);
    expect(merged.map((e) => e.item.id)).toEqual(["novo", "alpha", "antigo", "sem"]);
  });
});
