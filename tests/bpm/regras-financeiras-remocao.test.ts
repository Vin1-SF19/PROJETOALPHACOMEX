import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const raiz = process.cwd();
const ler = (arquivo: string) => readFileSync(resolve(raiz, arquivo), "utf8");

const arquivosExclusivos = [
  "src/actions/bpm/RegrasFinanceiras.ts",
  "src/app/PainelAlpha/AlphaCRM/admin/regras-financeiras/page.tsx",
  "src/components/bpm/regras-financeiras/PainelCalculoFinanceiro.tsx",
  "src/components/bpm/regras-financeiras/RegrasFinanceirasWorkspace.tsx",
  "src/lib/bpm/regras-financeiras/comissoes-card.ts",
  "src/lib/bpm/regras-financeiras/motor.ts",
  "src/lib/bpm/regras-financeiras/persistencia.ts",
  "src/lib/bpm/regras-financeiras/schemas.ts",
];

describe("remoção das regras financeiras configuráveis", () => {
  it("remove os módulos e a rota exclusivos", () => {
    for (const arquivo of arquivosExclusivos) {
      expect(existsSync(resolve(raiz, arquivo)), arquivo).toBe(false);
    }
  });

  it("remove os acessos visuais e as chamadas do runtime", () => {
    const admin = ler(
      "src/app/PainelAlpha/AlphaCRM/admin/AdminPipelinesListClient.tsx",
    );
    const painelCard = ler(
      "src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx",
    );
    const cards = ler("src/actions/bpm/Cards.ts");

    expect(admin).not.toContain("/admin/regras-financeiras");
    expect(admin).not.toContain("Regras Financeiras");
    expect(painelCard).not.toContain("PainelCalculoFinanceiro");
    expect(cards).not.toContain("calcularRegraTributariaDoCard");
    expect(cards).not.toContain("sincronizarComissoesDoCardFinanceiro");
  });

  it("mantém configurações históricas fora da listagem e do motor genéricos", () => {
    const legado = ler("src/lib/bpm/regras/legado.ts");
    const actions = ler("src/actions/bpm/Regras.ts");
    const contexto = ler("src/lib/bpm/regras/contexto.ts");

    expect(legado).toContain("[REGRA_FINANCEIRA_TRIBUTARIA:v1]");
    expect(legado).toContain("{ descricao: null }");
    expect(legado).toContain("startsWith");
    expect(actions).toContain("FILTRO_SEM_REGRAS_FINANCEIRAS_DESCONTINUADAS");
    expect(contexto).toContain("FILTRO_SEM_REGRAS_FINANCEIRAS_DESCONTINUADAS");
  });

  it("preserva o Pipeline Financeiro, as regras BPM e as comissões autônomas", () => {
    const pipeline = ler("src/lib/bpm/pipeline-financeiro.ts");
    const regras = ler("src/actions/bpm/Regras.ts");
    const comissoes = ler("src/lib/commissions/entry-generator.ts");

    expect(pipeline).toContain("validateCanonicalFinancialTransition");
    expect(pipeline).toContain("calcularRetencoesFinanceiras");
    expect(regras).toContain("ListarWorkspaceRegrasBpm");
    expect(comissoes).toContain("gerarLancamentosParaEvento");
    expect(existsSync(resolve(raiz, "tests/bpm/pipeline-financeiro.test.ts"))).toBe(true);
    expect(
      existsSync(
        resolve(
          raiz,
          "src/components/Comissoes/Configuracoes/ConstrutorRegras.tsx",
        ),
      ),
    ).toBe(true);
  });
});
