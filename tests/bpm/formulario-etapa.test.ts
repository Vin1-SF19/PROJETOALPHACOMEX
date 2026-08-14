import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = process.cwd();
const ler = (arquivo: string) => readFileSync(resolve(raiz, arquivo), "utf8");

const modal = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx");
const historico = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx");
const formulario = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx");
const campos = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx");
const reuniao = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx");

describe("CRM - formulário unificado por etapa", () => {
  it("centraliza os campos dinâmicos atuais na aba Formulário da Etapa", () => {
    expect(formulario).toContain('value="formulario-etapa"');
    expect(formulario).toContain("<PainelCamposEtapaAtual");
    expect(campos).toContain("Campos da etapa atual");
    expect(historico).not.toContain("Campos da etapa atual");
  });

  it("coloca os controles nativos de cada etapa no formulário central", () => {
    expect(formulario).toContain("etapaEhFechado(card.etapa.nome)");
    expect(formulario).toContain("<PainelStatusPosFechamento");
    expect(formulario).toContain("etapaExigeProximoContato(card.etapa.nome)");
    expect(formulario).toContain("<PainelProximoContato");
    expect(formulario).toContain("etapaEhEmTratativa(card.etapa.nome)");
    expect(formulario).toContain("<PainelChecklistFollowUp");
    expect(historico).not.toContain("<PainelStatusPosFechamento");
    expect(historico).not.toContain("<PainelProximoContato");
    expect(historico).not.toContain("<PainelChecklistFollowUp");
  });

  it("oferece criação ou reagendamento do Meet somente em Agendar Reunião", () => {
    expect(formulario).toContain("etapaEhAgendarReuniao(card.etapa.nome)");
    expect(formulario).toContain("<PainelReuniao");
    expect(modal).toContain("destinoEhReuniaoAgendada(card.etapa.nome)");
    expect(modal).toContain("mostrarFormulario={false}");
    expect(reuniao).toContain("{mostrarFormulario && (");
  });

  it("mantém requisitos de avanço no painel esquerdo e a ação de mover no direito", () => {
    expect(historico).toContain("<PainelRequisitosAvanco");
    expect(modal).toContain("<PainelProximaEtapa");
  });
  it("mantém a Anotação no rodapé estático do painel central", () => {
    expect(formulario).toContain('htmlFor={`anotacao-card-${card.id}`}');
    expect(formulario).toContain("Anotação");
    expect(formulario).toContain("Visível em todas as etapas");
    expect(formulario).toContain("sticky bottom-0 z-10 shrink-0");
    expect(formulario).toContain("value={anotacao}");
    expect(formulario).toContain("observacoes: anotacao.trim() || undefined");
    expect(formulario.indexOf("</Tabs>")).toBeLessThan(formulario.indexOf("<footer"));
  });
});
