import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const arquivo = readFileSync(
  "src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx",
  "utf8",
);

describe("edição do serviço contratado no modal de dados do cliente", () => {
  it("edita o serviço principal usando o catálogo comercial", () => {
    expect(arquivo).toContain("SERVICOS_COMERCIAIS_PADRAO");
    expect(arquivo).toContain("atualizarFormCard(cliente.id, { servico })");
    expect(arquivo).toContain('label="Serviço"');
  });

  it("reflete imediatamente o serviço editado no card inferior", () => {
    expect(arquivo).toContain("const servicoExibido = form?.servico || registro.servico");
    expect(arquivo).toContain('{servicoExibido || "Serviço não definido"}');
  });

  it("exige análise de impacto antes de persistir a troca", () => {
    expect(arquivo).toContain("analisarImpactoTrocaServico");
    expect(arquivo).toContain("!trocaServicoConfirmada");
    expect(arquivo).toContain("setConfirmacaoTrocaServico(resultadoImpacto.impacto)");
  });

  it("mostra os dois níveis de risco, módulos afetados e confirmação responsiva", () => {
    expect(arquivo).toContain("CS & NPS e Alpha Metas");
    expect(arquivo).toContain("somente no módulo CS & NPS");
    expect(arquivo).toContain("max-h-[calc(100vh-1.5rem)]");
    expect(arquivo).toContain("Não, cancelar");
    expect(arquivo).toContain("Sim, confirmar troca");
  });
});
