import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = process.cwd();
const ler = (arquivo: string) => readFileSync(resolve(raiz, arquivo), "utf8");

const board = ler("src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx");
const modal = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx");
const historico = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx");
const statusPosFechamento = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento.tsx");
const requisitos = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelRequisitosAvanco.tsx");
const proximoContato = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximoContato.tsx");
const checklist = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistFollowUp.tsx");
const novoCard = ler("src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx");
const cardsAction = ler("src/actions/bpm/Cards.ts");

describe("CRM - wiring do modal por etapa", () => {
  it("propaga revisao realtime sem remontar o modal", () => {
    expect(board).toContain("realtimeRevision={realtimeRevision}");
    expect(board).not.toMatch(/key=\{`\$\{cardSelecionadoId\}-\$\{modalRevision\}`\}/);
    expect(modal).toContain("Promise.all([ObterCardBpm(cardId), ListarInteracoesCardBpm(cardId)])");
  });

  it("propaga realtime aos quatro editores e preserva drafts sujos", () => {
    expect(historico).toContain("realtimeRevision={realtimeRevision}");
    expect(historico).toContain("<PainelRequisitosAvanco");
    expect(historico).toContain("<PainelProximoContato");
    expect(historico).toContain("<PainelChecklistFollowUp");
    expect(requisitos).toContain("draftSujoRef.current");
    expect(proximoContato).toContain("sujoRef.current");
    expect(checklist).toContain("draftSujoRef.current");
  });

  it("mantem o painel esquerdo rolavel e o mobile com scroll externo", () => {
    expect(modal).toContain("overflow-y-auto lg:overflow-hidden");
    expect(historico).toContain("lg:h-full lg:overflow-y-auto");
  });

  it("preserva a composicao direita e adiciona apenas ancora de foco", () => {
    expect(modal).toContain('id={`painel-reuniao-${card.id}`} tabIndex={-1} className="flex flex-col gap-4 min-h-0 overflow-y-auto"');
    expect(modal.indexOf("<PainelReuniao")).toBeLessThan(modal.indexOf("<PainelProximaEtapa"));
    expect(requisitos).toContain("onFocarPainelReuniao");
    expect(requisitos).toContain("Ir à reunião");
  });

  it("aplica readonly aos controles operacionais", () => {
    expect(historico).toContain("disabled={!podeEditar}");
    expect(requisitos).toContain("disabled={!podeEditar");
    expect(proximoContato).toContain("disabled={!podeEditar");
    expect(checklist).toContain("disabled={!podeEditar");
  });

  it("lista responsaveis elegiveis no contexto do pipeline", () => {
    expect(novoCard).toContain("ListarUsuariosResponsavelBpm(pipelineId)");
    expect(cardsAction).toContain("export async function ListarUsuariosResponsavelBpm(pipelineId: string)");
    expect(cardsAction).toContain("usuarioElegivelResponsavelBpm(pipelineId, usuario.id)");
  });

  it("mantem os requisitos no lado esquerdo do card", () => {
    expect(historico).toContain("<PainelRequisitosAvanco");
    expect(modal.indexOf("<PainelHistorico")).toBeLessThan(modal.indexOf("<PainelRegistrar"));
  });

  it("compoe o status pos-fechamento no painel esquerdo somente em Fechado", () => {
    expect(historico).toContain("etapaEhFechado(card.etapa.nome)");
    expect(historico).toContain("<PainelStatusPosFechamento");
    expect(historico.indexOf("<PainelStatusPosFechamento")).toBeLessThan(
      historico.indexOf("<PainelRequisitosAvanco"),
    );
    expect(statusPosFechamento).toContain("STATUS_POS_FECHAMENTO_OPCOES.map");
    expect(statusPosFechamento).toContain("disabled={!podeEditar || salvando}");
    expect(statusPosFechamento).toContain("Status ainda não definido");
    expect(statusPosFechamento).toContain("Salvar status");
  });

  it("preserva o rascunho de status diante de realtime e informa conflito", () => {
    expect(statusPosFechamento).toContain("rascunhoSujoRef.current");
    expect(statusPosFechamento).toContain("setConflitoRealtime(true)");
    expect(statusPosFechamento).toContain("Seu rascunho foi preservado");
    expect(statusPosFechamento).toContain("statusPosFechamento: rascunho");
    expect(statusPosFechamento).toContain("versaoEsperadaEm: versaoBase");
    expect(statusPosFechamento).toContain("if (houveConflito) onAtualizado()");
    expect(historico).toContain("versaoPersistidaEm={card.updatedAt}");
  });

  it("mantem a versao-base suja e permite aceitar o snapshot remoto sem remontar", () => {
    expect(statusPosFechamento).toContain("const snapshotRemotoMudou = statusReconhecido !== base || versaoRemota !== versaoBase");
    expect(statusPosFechamento).toMatch(/if \(!snapshotRemotoMudou\) \{[\s\S]*setConflitoRealtime\(false\);[\s\S]*setSnapshotRemotoPendente\(null\);[\s\S]*return;/);
    expect(statusPosFechamento).toContain("setSnapshotRemotoPendente({ status: statusReconhecido, versao: versaoRemota })");
    expect(statusPosFechamento).toContain("setVersaoBase(snapshotRemotoPendente.versao)");
    expect(statusPosFechamento).toContain("setRascunho(snapshotRemotoPendente.status)");
    expect(statusPosFechamento).toContain("Usar status atualizado");
    expect(statusPosFechamento).not.toContain("window.location.reload");
  });

  it("nao regride o status salvo enquanto a recarga ainda entrega props antigas", () => {
    expect(statusPosFechamento).toContain("confirmacaoLocalPendenteRef.current = {");
    expect(statusPosFechamento).toContain("versaoAnterior: versaoBase");
    expect(statusPosFechamento).toContain("const propsAindaSaoSnapshotAnterior");
    expect(statusPosFechamento).toContain("if (propsAindaSaoSnapshotAnterior) return");
    expect(statusPosFechamento).toContain("if (statusReconhecido === confirmacaoLocal.status)");
    expect(statusPosFechamento).toContain("confirmacaoLocalPendenteRef.current = null");
  });
});
