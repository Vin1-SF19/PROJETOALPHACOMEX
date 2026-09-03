import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  acaoBpmExigeSomenteVisualizacao,
  resolverVisibilidadeEtapa,
} from "@/lib/bpm/visibilidade-etapa";

const regraComercial = {
  perfil: "COMERCIAL",
  podeVer: true,
  podeAgir: true,
};

describe("resolverVisibilidadeEtapa", () => {
  it("preserva o acesso atual quando a etapa não possui regras", () => {
    expect(resolverVisibilidadeEtapa("OPERACIONAL", [])).toEqual({
      podeVer: true,
      podeAgir: true,
      restrita: false,
    });
  });

  it("autoriza o perfil configurado normalizando caixa, espaços e acentos", () => {
    expect(
      resolverVisibilidadeEtapa("Líder Comercial", [
        { ...regraComercial, perfil: "LIDERCOMERCIAL" },
      ]),
    ).toEqual({ podeVer: true, podeAgir: true, restrita: true });
  });

  it("nega visualização e ação para perfil ausente da allow-list", () => {
    expect(resolverVisibilidadeEtapa("FINANCEIRO", [regraComercial])).toEqual({
      podeVer: false,
      podeAgir: false,
      restrita: true,
    });
  });

  it("permite somente leitura sem liberar ações", () => {
    expect(
      resolverVisibilidadeEtapa("COMERCIAL", [
        { ...regraComercial, podeAgir: false },
      ]),
    ).toEqual({ podeVer: true, podeAgir: false, restrita: true });
  });

  it.each(["Admin", "CEO", "TI"])(
    "mantém bypass administrativo para %s",
    (perfil) => {
      expect(resolverVisibilidadeEtapa(perfil, [regraComercial])).toEqual({
        podeVer: true,
        podeAgir: true,
        restrita: true,
      });
    },
  );

  it("separa ações de leitura das ações de trabalho", () => {
    expect(acaoBpmExigeSomenteVisualizacao("visualizar")).toBe(true);
    expect(acaoBpmExigeSomenteVisualizacao("visualizarHistorico")).toBe(true);
    expect(acaoBpmExigeSomenteVisualizacao("editarCard")).toBe(false);
    expect(acaoBpmExigeSomenteVisualizacao("moverEtapa")).toBe(false);
    expect(acaoBpmExigeSomenteVisualizacao("excluirCard")).toBe(false);
  });
});

describe("integração da visibilidade por coluna no CRM/BPM", () => {
  it("persiste a configuração com FK cascade e unicidade por etapa/perfil", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(schema).toContain("model BpmEtapaVisibilidade");
    expect(schema).toContain("etapa BpmEtapa @relation(fields: [etapaId], references: [id], onDelete: Cascade)");
    expect(schema).toContain("@@unique([etapaId, perfil])");
  });

  it("centraliza o enforcement no ownership e protege a etapa de destino", () => {
    const ownership = readFileSync("src/lib/bpm/ownership.ts", "utf8");
    const cards = readFileSync("src/actions/bpm/Cards.ts", "utf8");
    expect(ownership).toContain("acaoBpmExigeSomenteVisualizacao(acao)");
    expect(ownership).toContain("card.etapa.visibilidades");
    expect(cards).toContain("etapaId: { in: etapasVisiveis }");
    expect(cards).toContain("acessoOrigemAtual.perfilGlobal");
    expect(cards).toContain("destinoAtual.visibilidades");
  });

  it("expõe a configuração no admin do pipeline e desabilita arrasto sem ação", () => {
    const admin = readFileSync(
      "src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx",
      "utf8",
    );
    const board = readFileSync(
      "src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx",
      "utf8",
    );
    const modal = readFileSync(
      "src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx",
      "utf8",
    );
    expect(admin).toContain("<VisibilidadeEtapasSection");
    expect(board).toContain("arrastoDesabilitado || !c.podeAgirEtapa");
    expect(modal).toContain("card.permissaoEtapa?.podeAgir ?? true");
  });

  it("aplica a visibilidade no dashboard e na promoção de leads NoLoss", () => {
    const dashboard = readFileSync("src/actions/bpm/Dashboard.ts", "utf8");
    const noloss = readFileSync("src/actions/bpm/NolossLeads.ts", "utf8");
    expect(dashboard).toContain("filtroCardVisivel");
    expect(dashboard).toContain("resolverVisibilidadeEtapa");
    expect(noloss).toContain("VISIBILIDADE_ETAPA_NEGADA");
    expect(noloss).toContain("destinoAtual.visibilidades");
  });
});
