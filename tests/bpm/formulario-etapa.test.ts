import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = process.cwd();
const ler = (arquivo: string) => readFileSync(resolve(raiz, arquivo), "utf8");

const modal = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx");
const layoutCard = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx");
const historico = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx");
const formulario = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx");
const editorAnotacao = ler("src/app/PainelAlpha/AlphaCRM/CardModal/EditorAnotacaoCard.tsx");
const slotFormulario = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardOpenFormSlot.tsx");
const campos = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx");
const reuniao = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx");
const interacoes = ler("src/actions/bpm/Interacoes.ts");
const proximoContato = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximoContato.tsx");
const statusPosFechamento = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento.tsx");
const checklistFollowUp = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistFollowUp.tsx");
const proximaEtapa = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx");
const builder = ler("src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx");
const saveAction = ler("src/actions/bpm/FormulariosEtapa.ts");

describe("CRM - formulário unificado por etapa", () => {
  it("centraliza os campos dinâmicos atuais na aba Formulário da Etapa", () => {
    expect(formulario).toContain('value="formulario-etapa"');
    expect(slotFormulario).toContain("<PainelCamposEtapaAtual");
    expect(campos).toContain("Campos da etapa atual");
    expect(historico).not.toContain("Campos da etapa atual");
  });

  it("coloca os controles nativos de cada etapa no formulário central", () => {
    expect(slotFormulario).toContain('case "commercial-post-closing"');
    expect(slotFormulario).toContain("<PainelStatusPosFechamento");
    expect(slotFormulario).toContain("<PainelProximoContato");
    expect(slotFormulario).not.toContain("etapaExigeProximoContato(card.etapa.nome)");
    expect(slotFormulario).toContain('case "follow-up-checklist"');
    expect(slotFormulario).toContain("<PainelChecklistFollowUp");
    expect(historico).not.toContain("<PainelStatusPosFechamento");
    expect(historico).not.toContain("<PainelProximoContato");
    expect(historico).not.toContain("<PainelChecklistFollowUp");
  });

  it("oferece criação ou reagendamento do Meet somente em Agendar Reunião", () => {
    expect(slotFormulario).toContain('case "meeting-scheduler"');
    expect(slotFormulario).toContain("<PainelReuniao");
    expect(modal).not.toContain("<PainelReuniao");
    expect(modal).not.toContain("destinoEhReuniaoAgendada");
    expect(reuniao).toContain("{mostrarFormulario && (");
  });

  it("mostra acompanhamento e resumo em Reunião Agendada sem reabrir o agendamento", () => {
    expect(slotFormulario).toContain('case "meeting-transcript"');
    expect(slotFormulario).toContain("mostrarFormulario={false}");
    expect(reuniao).toContain('aria-label="Resumo da reunião"');
  });

  it("delega a exclusividade visual à composição publicada", () => {
    expect(slotFormulario).toContain("formulario={card.formularioEtapa}");
    expect(slotFormulario).toContain("componente.rendererId");
    expect(slotFormulario).not.toMatch(/etapaEh[A-Z]/);
    expect(slotFormulario).not.toContain("card.etapa.nome");
    expect(slotFormulario).toContain("<PainelCamposEtapaAtual");
    expect(slotFormulario).toContain("<PainelProximoContato");
  });

  it("mantém a ação de mover no painel direito", () => {
    expect(layoutCard).toContain("<PainelProximaEtapa");
  });

  it("impede o builder de recriar campo fora da configuração canônica da etapa", () => {
    expect(builder).toContain("config.etapaId === etapaId && config.visivel");
    expect(builder).toContain("versaoEsperada: etapa.formulario?.versao ?? null");
    expect(builder).toContain("id: secao.id");
    expect(builder).toContain("id: componente.id");
    expect(builder).toContain("!secoes.some((secaoAtual)");
    expect(saveAction).toContain("etapaConfiguracoes[0]");
    expect(saveAction).toContain("CONFLITO_VERSAO_FORMULARIO");
    expect(saveAction).not.toContain("bpmFormularioSecao.deleteMany({\n        where: { formularioId");
  });


  it("remove o bloco Tentando contato do painel esquerdo", () => {
    expect(historico).not.toContain("Tentando contato");
  });
  it("mantém a Anotação como accordion compacto no rodapé, com botão Salvar explícito", () => {
    expect(historico).toContain("<EditorAnotacaoCard");
    expect(historico.indexOf("</Tabs>")).toBeLessThan(historico.indexOf("<EditorAnotacaoCard"));
    expect(editorAnotacao).toContain("Anotação");
    expect(editorAnotacao).toContain("<details");
    expect(editorAnotacao).toContain("<summary");
    expect(editorAnotacao).toContain("shrink-0");
    expect(editorAnotacao).toContain("value={anotacao}");
    expect(editorAnotacao).toContain("salvarAnotacao");
    expect(editorAnotacao).toContain("onClick={() => void salvarAnotacao()}");
    expect(editorAnotacao).not.toContain("onBlur={() => void salvarAnotacao()}");
    expect(editorAnotacao).toContain("Aparece no Histórico");
    expect(formulario).not.toContain("EditorAnotacaoCard");
    expect(formulario).not.toContain("CriarInteracaoCardBpm");
  });

  it("persiste a anotação identificada, com autor, sem tratá-la como ligação", () => {
    expect(interacoes).toContain('tipo === "ANOTACAO" ? "ANOTACAO_REGISTRADA"');
    expect(interacoes).toContain('include: { registradoPor: { select: { id: true, nome: true } } }');
    expect(historico).not.toContain("Tentando contato");
    expect(modal).toContain("interacoes={interacoes}");
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
    expect(proximoContato).toContain("onCommit={(novoValor) => void persistir(novoValor || null)}");
    expect(proximoContato).not.toContain(">Salvar<");
    expect(statusPosFechamento).toContain("void salvar(event.target.value)");
    expect(statusPosFechamento).not.toContain("Salvar status");
    expect(checklistFollowUp).toContain("onBlur={() => void persistir(false)}");
    expect(checklistFollowUp).not.toContain("Salvar rascunho");
  });

  it("mantém avançar como uma ação explícita e compacta no painel direito", () => {
    expect(proximaEtapa).toContain("await flushSaves()");
    expect(proximaEtapa).toContain("MoverCardBpm({ cardId: card.id, etapaDestinoId })");
    expect(proximaEtapa).not.toContain("Salvar e avançar");
    expect(proximaEtapa).toContain("px-3 py-2 rounded-xl text-xs");
    expect(proximaEtapa).not.toContain("px-4 py-3.5 rounded-2xl text-sm");
  });
});
