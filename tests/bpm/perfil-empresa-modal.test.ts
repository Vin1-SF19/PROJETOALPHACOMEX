import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = process.cwd();
const ler = (arquivo: string) => readFileSync(resolve(raiz, arquivo), "utf8");

const cardAbertoLayout = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx");
const perfilModalGlobal = ler("src/components/PerfilEmpresaGlobal/PerfilEmpresaModal.tsx");
const perfilProvider = ler("src/components/PerfilEmpresaGlobal/PerfilEmpresaProvider.tsx");
const crmLayoutClient = ler("src/app/PainelAlpha/AlphaCRM/CRMLayoutClient.tsx");
const rotaLegada = ler("src/app/PainelAlpha/AlphaCRM/empresa/[empresaId]/page.tsx");

describe("CRM - perfil da empresa no modal global (RM-2026-C02779)", () => {
  it("abre o perfil da empresa via modal global, sem link para rota dedicada", () => {
    expect(cardAbertoLayout).toContain("openPerfilEmpresa(");
    expect(cardAbertoLayout).not.toContain("EmpresaPerfilModal");
    expect(cardAbertoLayout).not.toContain("/PainelAlpha/AlphaCRM/empresa/");
  });

  it("monta o PerfilEmpresaProvider dentro do módulo AlphaCRM (mesma árvore React do iframe)", () => {
    expect(crmLayoutClient).toContain("PerfilEmpresaProvider");
  });

  it("carrega a timeline sob demanda com loading, erro recuperável e scroll", () => {
    expect(perfilModalGlobal).toContain("useClientTimeline(");
    expect(perfilModalGlobal).toContain('role="alert"');
    expect(perfilModalGlobal).toContain("Tentar novamente");
    expect(perfilModalGlobal).toContain("w-[80vw]");
    expect(perfilModalGlobal).toContain("overflow-y-auto");
  });

  it("permite trocar de card a partir de um evento da timeline sem aninhar CardFullViewModal", () => {
    expect(perfilProvider).toContain("onAbrirCard");
    expect(perfilModalGlobal).toContain("onAbrirCard");
    expect(perfilModalGlobal).not.toContain("<CardFullViewModal");
  });

  it("mantém a rota antiga apenas como redirecionamento sem consulta de dados", () => {
    expect(rotaLegada).toContain('redirect("/PainelAlpha/AlphaCRM")');
    expect(rotaLegada).not.toContain("ObterPerfilEmpresaBpm");
    expect(rotaLegada).not.toContain("auth(");
  });
});
