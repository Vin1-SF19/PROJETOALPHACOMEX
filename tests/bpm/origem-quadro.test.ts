import { describe, expect, it } from "vitest";
import {
  corOrigemQuadro, filtroDoSelectOrigemQuadro, normalizarOrigemQuadro, origemCorrespondeFiltro,
  origemNativaQuadro, origemNolossQuadro, origensDisponiveisQuadro, valorSelectOrigemQuadro,
  SEM_ORIGEM_QUADRO, TODAS_ORIGENS_QUADRO,
} from "@/lib/bpm/origem-quadro";
import { selecionarPaginaQuadro, type EntradaManifestoQuadro } from "@/lib/bpm/quadro-paginado";

describe("origem do quadro", () => {
  it("obtém opções do manifesto inteiro e não inclui canais do catálogo sem cards", () => {
    const entradas = Array.from({ length: 381 }, (_, i): EntradaManifestoQuadro => ({ id: `card-${i}`, etapaId: "entrada", revision: "1", nome: i === 380 ? "Empresa especial" : `Empresa ${i}`, cnpj: null, servico: null, responsaveis: [{ id: i === 380 ? 2 : 1, nome: "Pessoa" }], origem: i === 380 ? "Callix" : "Instagram" }));
    expect(selecionarPaginaQuadro(entradas).ids).toHaveLength(30);
    expect(origensDisponiveisQuadro(entradas)).toEqual(["Callix", "Instagram"]);
    expect(selecionarPaginaQuadro(entradas, { origem: "Callix", responsavelId: 2, busca: "especial" })).toEqual({ ids: ["card-380"], totais: { entrada: 1 } });
    expect(origensDisponiveisQuadro(entradas)).not.toContain("China");
    expect(origensDisponiveisQuadro(entradas)).not.toContain(null);
  });

  it("distingue Todas, Sem origem e origens personalizadas parecidas com sentinelas", () => {
    for (const origem of [undefined, null, "__all__", "__alpha_origem_todas__", "__alpha_origem_ausente__", "origem:Instagram", "Canal / novo", "Instagram"]) {
      expect(filtroDoSelectOrigemQuadro(valorSelectOrigemQuadro(origem))).toBe(origem);
    }
    expect(TODAS_ORIGENS_QUADRO).not.toBe(SEM_ORIGEM_QUADRO);
    expect(origemCorrespondeFiltro("Instagram", undefined)).toBe(true);
    expect(origemCorrespondeFiltro("Instagram", null)).toBe(false);
    expect(origemCorrespondeFiltro(undefined, null)).toBe(true);
    expect(filtroDoSelectOrigemQuadro("origem:%invalid")).toBeUndefined();
  });

  it("normaliza apenas grafia óbvia e não funde canais comerciais diferentes", () => {
    expect(origensDisponiveisQuadro([{ origem: " instagram " }, { origem: "Instagram" }, { origem: "website" }, { origem: "SITE" }, { origem: "Prospecção Ativa" }])).toEqual(["Instagram", "Prospecção ativa", "Site"]);
    expect(normalizarOrigemQuadro("   ")).toBeNull();
    expect(origemCorrespondeFiltro("Callix", "Discadora")).toBe(false);
    expect(origemCorrespondeFiltro("Feiras e Eventos", "Evento")).toBe(false);
    expect(origemCorrespondeFiltro("Google e Outros Buscadores", "Tráfego Pago (Google)")).toBe(false);
    expect(origensDisponiveisQuadro([{ origem: null }, {}, { origem: "Callix" }])).toEqual(["Callix", null]);
  });

  it("combina origem, busca e responsável antes de totais e limites por coluna", () => {
    const entradas = Array.from({ length: 90 }, (_, i): EntradaManifestoQuadro => ({ id: String(i), etapaId: i < 80 ? "primeira" : "segunda", revision: "1", nome: i % 2 ? "Alvo" : "Outra", cnpj: null, servico: null, responsaveis: [{ id: i % 3 ? 7 : 8, nome: "Pessoa" }], origem: i % 4 ? "Instagram" : null }));
    const filtros = { origem: "Instagram", busca: "alvo", responsavelId: 7, limites: { primeira: 5, segunda: 2 } };
    const elegiveis = entradas.filter((e) => e.origem === "Instagram" && e.nome === "Alvo" && e.responsaveis[0].id === 7);
    const primeira = elegiveis.filter((e) => e.etapaId === "primeira");
    const segunda = elegiveis.filter((e) => e.etapaId === "segunda");
    expect(selecionarPaginaQuadro(entradas, filtros)).toEqual({ ids: [...primeira.slice(0, 5), ...segunda.slice(0, 2)].map((e) => e.id), totais: { primeira: primeira.length, segunda: segunda.length } });
    expect(selecionarPaginaQuadro(entradas, { ...filtros, limites: { primeira: 30, segunda: 30 } }).ids).toEqual(elegiveis.map((e) => e.id));
    expect(selecionarPaginaQuadro(entradas, { origem: null }).totais).toEqual({ primeira: 20, segunda: 3 });
  });

  it("combina origem com Meus e sem vínculos sem retirar opções de colegas autorizados", () => {
    const base = { etapaId: "entrada", revision: "1", nome: "Empresa", cnpj: null, servico: null };
    const entradas = [{ ...base, id: "meu", origem: "Instagram", responsaveis: [{ id: 1, nome: "Eu" }] }, { ...base, id: "colega", origem: "Callix", responsaveis: [{ id: 2, nome: "Colega" }] }, { ...base, id: "livre", origem: "Callix", responsaveis: [] }];
    const acesso = { userId: 1, admin: false, setores: [], responsaveis: [{ id: 2, nome: "Colega" }] };
    expect(origensDisponiveisQuadro(entradas)).toEqual(["Callix", "Instagram"]);
    expect(selecionarPaginaQuadro(entradas, { acesso, origem: "Callix" }).ids).toEqual(["livre"]);
    expect(selecionarPaginaQuadro(entradas, { acesso, visao: "TODOS", origem: "Callix" }).ids).toEqual(["colega", "livre"]);
  });

  it("usa origem unívoca do próprio card, sem substituir pela origem de outro contexto", () => {
    const campoValores = [{ valor: "Callix", campo: { nome: "Origem do cliente", ativo: true } }];
    expect(origemNativaQuadro({ empresaId: 7, campoValores, servicoContexto: { clienteServico: { clienteId: 7, origemLead: "Instagram" } } })).toBe("Callix");
    expect(origemNativaQuadro({ empresaId: 7, campoValores: [...campoValores, { valor: "Discadora", campo: { nome: "Canal de origem", ativo: true } }], servicoContexto: { clienteServico: { clienteId: 7, origemLead: "Callix" } } })).toBeNull();
    expect(origemNativaQuadro({ empresaId: 7, campoValores: [{ valor: "Não é origem", campo: { nome: "Observações" } }, { valor: "Evento", campo: { nome: "Canal de origem", ativo: false } }] })).toBeNull();
  });

  it("usa somente contexto explícito coerente com a empresa e recusa ambiguidades", () => {
    expect(origemNativaQuadro({ empresaId: 7, servicoContexto: { clienteServico: { clienteId: 7, origemLead: "Instagram", canalAquisicao: "instagram" } } })).toBe("Instagram");
    expect(origemNativaQuadro({ empresaId: 7, servicoContexto: { contratoComercial: { clienteId: 7, canalAquisicao: "Evento" } } })).toBe("Evento");
    expect(origemNativaQuadro({ empresaId: 7, servicoContexto: { clienteServico: { clienteId: 99, origemLead: "Instagram" } } })).toBeNull();
    expect(origemNativaQuadro({ empresaId: 7, servicoContexto: { clienteServico: { clienteId: 7, origemLead: "Callix" }, contratoComercial: { clienteId: 7, canalAquisicao: "Evento" } } })).toBeNull();
    expect(origemNativaQuadro({ empresaId: 7 })).toBeNull();
  });

  it("classifica NoLoss somente pelos dados conhecidos, sem transformar UTM ausente em Site", () => {
    expect(origemNolossQuadro({ utmSource: "website", utmMedium: "Pago" })).toBe("Site");
    expect(origemNolossQuadro({ utmSource: "", utmMedium: "Instagram" })).toBe("Instagram");
    expect(origemNolossQuadro({ utmSource: null, utmMedium: null })).toBe("NoLoss");
  });

  it("mantém as cores por origem independentemente da ordem e cria tons próprios para legados", () => {
    const origens = ["Instagram", "Site", "Callix", "Discadora", "Feiras e Eventos", "Evento", "China", "WhatsApp", "Orgânico", "Indicação Parceiro", "Indicação Cliente", "Outro", "Prospecção ativa", "Tráfego Pago (Meta - Instagram)", "Tráfego Pago (Google)", "NoLoss", "Redes Sociais", "Contato por Telefone", "Google e Outros Buscadores", "teste"];
    const cores = origens.map(corOrigemQuadro);
    expect(new Set(cores.map((cor) => cor.fundo)).size).toBe(origens.length);
    for (const origem of [...origens].reverse()) expect(corOrigemQuadro(origem)).toEqual(cores[origens.indexOf(origem)]);
    expect(corOrigemQuadro("Instagram").fundo).toContain("270");
    expect(corOrigemQuadro("Site").fundo).toContain("217");
    expect(corOrigemQuadro(" instagram ")).toEqual(corOrigemQuadro("Instagram"));
  });
});
