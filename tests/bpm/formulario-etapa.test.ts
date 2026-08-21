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
const interacoes = ler("src/actions/bpm/Interacoes.ts");
const proximoContato = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximoContato.tsx");
const statusPosFechamento = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento.tsx");
const checklistFollowUp = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistFollowUp.tsx");
const requisitosAvanco = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelRequisitosAvanco.tsx");
const proximaEtapa = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx");

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
    expect(formulario).toContain("<PainelProximoContato");
    expect(formulario).not.toContain("etapaExigeProximoContato(card.etapa.nome)");
    expect(formulario).toContain("etapaEhEmTratativa(card.etapa.nome)");
    expect(formulario).toContain("<PainelChecklistFollowUp");
    expect(historico).not.toContain("<PainelStatusPosFechamento");
    expect(historico).not.toContain("<PainelProximoContato");
    expect(historico).not.toContain("<PainelChecklistFollowUp");
  });

  it("oferece criação ou reagendamento do Meet somente em Agendar Reunião", () => {
    expect(formulario).toContain("etapaEhAgendarReuniao(card.etapa.nome)");
    expect(formulario).toContain("<PainelReuniao");
    expect(modal).not.toContain("<PainelReuniao");
    expect(modal).not.toContain("destinoEhReuniaoAgendada");
    expect(reuniao).toContain("{mostrarFormulario && (");
  });

  it("mantém requisitos de avanço no painel esquerdo e a ação de mover no direito", () => {
    expect(historico).toContain("<PainelRequisitosAvanco");
    expect(modal).toContain("<PainelProximaEtapa");
  });

  it("remove o bloco Tentando contato do painel esquerdo", () => {
    expect(historico).not.toContain("Tentando contato");
  });
  it("mantém a Anotação como accordion compacto no rodapé, com botão Salvar explícito", () => {
    expect(formulario).toContain("Anotação");
    expect(formulario).toContain("<details");
    expect(formulario).toContain("<summary");
    expect(formulario).toContain("sticky bottom-0 z-10 shrink-0");
    expect(formulario).toContain("value={anotacao}");
    expect(formulario).toContain("salvarAnotacao");
    expect(formulario).toContain("onClick={() => void salvarAnotacao()}");
    expect(formulario).not.toContain("onBlur={() => void salvarAnotacao()}");
    expect(formulario).not.toContain("anotacoes.length > 0");
    expect(formulario.indexOf("</Tabs>")).toBeLessThan(formulario.indexOf("<details"));
  });

  it("persiste a anotação identificada, com autor, sem tratá-la como ligação", () => {
    expect(interacoes).toContain('tipo === "ANOTACAO" ? "ANOTACAO_REGISTRADA"');
    expect(interacoes).toContain('include: { registradoPor: { select: { id: true, nome: true } } }');
    expect(historico).not.toContain("Tentando contato");
    expect(modal).toContain('anotacoes={interacoes.filter((interacao) => interacao.tipo === "ANOTACAO" || Boolean(interacao.observacoes))}');
  });
  it("remove Data, Hora, Link e o registro de interação de todos os cards", () => {
    expect(formulario).not.toContain("Registrar interação");
    expect(formulario).not.toContain("agendaData");
    expect(formulario).not.toContain("agendaHora");
    expect(formulario).not.toContain("agendaLink");
  });

  it("persiste os formulários locais automaticamente ao sair do campo", () => {
    expect(campos).toContain("onBlur={() => void salvarCamposAtuais()}");
    expect(campos).not.toContain("Salvar campos da etapa");
    expect(proximoContato).toContain("onBlur={() => void persistir(valor || null)}");
    expect(proximoContato).not.toContain(">Salvar<");
    expect(statusPosFechamento).toContain("void salvar(event.target.value)");
    expect(statusPosFechamento).not.toContain("Salvar status");
    expect(checklistFollowUp).toContain("onBlur={() => void persistir(false)}");
    expect(checklistFollowUp).not.toContain("Salvar rascunho");
  });

  it("mantém avançar como uma ação explícita e compacta no painel direito", () => {
    expect(requisitosAvanco).toContain("Avançar para ${requisitos.etapaDestino.nome}");
    expect(requisitosAvanco).not.toContain("Salvar e avançar");
    expect(proximaEtapa).toContain("px-3 py-2 rounded-xl text-xs");
    expect(proximaEtapa).not.toContain("px-4 py-3.5 rounded-2xl text-sm");
  });
});
