import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = process.cwd();
const ler = (arquivo: string) => readFileSync(resolve(raiz, arquivo), "utf8");

const modalCard = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx");
const perfilModal = ler("src/app/PainelAlpha/AlphaCRM/CardModal/EmpresaPerfilModal.tsx");
const rotaLegada = ler("src/app/PainelAlpha/AlphaCRM/empresa/[empresaId]/page.tsx");

describe("CRM - perfil da empresa em modal", () => {
  it("abre o perfil no modal do card, sem link para rota dedicada", () => {
    expect(modalCard).toContain("<EmpresaPerfilModal");
    expect(modalCard).toContain("onClick={() => setPerfilEmpresaAberto(true)}");
    expect(modalCard).not.toContain("/PainelAlpha/AlphaCRM/empresa/");
  });

  it("carrega o perfil sob demanda com loading, erro recuperável e scroll", () => {
    expect(perfilModal).toContain("ObterPerfilEmpresaBpm(empresaId)");
    expect(perfilModal).toContain('role="status"');
    expect(perfilModal).toContain('role="alert"');
    expect(perfilModal).toContain("Tentar novamente");
    expect(perfilModal).toContain("z-[60]");
    expect(perfilModal).toContain("overflow-y-auto");
  });

  it("troca o card pelo callback principal, sem aninhar CardFullViewModal", () => {
    expect(perfilModal).toContain("onAbertoChange(false);");
    expect(perfilModal).toContain("onAbrirCard(cardId);");
    expect(perfilModal).not.toContain("<CardFullViewModal");
  });

  it("mantém a rota antiga apenas como redirecionamento sem consulta de dados", () => {
    expect(rotaLegada).toContain('redirect("/PainelAlpha/AlphaCRM")');
    expect(rotaLegada).not.toContain("ObterPerfilEmpresaBpm");
    expect(rotaLegada).not.toContain("auth(");
  });
});
