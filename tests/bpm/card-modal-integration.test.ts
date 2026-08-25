import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = process.cwd();
const ler = (arquivo: string) => readFileSync(resolve(raiz, arquivo), "utf8");

const board = ler("src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx");
const gradientBlobCard = ler("src/components/ui/gradient-blob-card.tsx");
const modal = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx");
const historico = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx");
const statusPosFechamento = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento.tsx");

const proximoContato = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximoContato.tsx");
const checklist = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistFollowUp.tsx");
const registrar = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx");
const camposEtapa = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx");
const painelReuniao = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx");
const resumoEtapas = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelResumoEtapas.tsx");
const novoCard = ler("src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx");
const cardsAction = ler("src/actions/bpm/Cards.ts");

describe("CRM - wiring do modal por etapa", () => {
  it("propaga revisao realtime sem remontar o modal", () => {
    expect(board).toContain("realtimeRevision={realtimeRevision}");
    expect(board).not.toMatch(/key=\{`\$\{cardSelecionadoId\}-\$\{modalRevision\}`\}/);
    expect(modal).toContain("Promise.all([ObterCardBpm(cardId), ListarInteracoesCardBpm(cardId)])");
  });

  it("fecha o modal de forma controlada quando o realtime revoga o acesso ao card", () => {
    expect(modal).toContain("function resultadoRevogaAcessoCard");
    expect(modal).toContain('resultado.error === "Não autorizado"');
    expect(modal).toContain("const acessoRevogadoRef = useRef(false)");
    expect(modal).toContain('toast.error("Seu acesso a este card foi removido.")');
    expect(modal).toContain("if (resultadoRevogaAcessoCard(cardRes))");
    expect(modal).toContain("fecharPorAcessoRevogado();");
    expect(cardsAction).toContain("...(admin ? {} : { membros: { some: { userId } } }),");
  });

  it("propaga realtime aos quatro editores e preserva drafts sujos", () => {
    expect(registrar).toContain("realtimeRevision={realtimeRevision}");
    expect(registrar).toContain("<PainelCamposEtapaAtual");
    expect(camposEtapa).toContain("resolverSnapshotCamposRealtime");
    expect(historico).toContain("<PainelRequisitosAvanco");
    expect(registrar).toContain("<PainelProximoContato");
    expect(registrar).toContain("<PainelChecklistFollowUp");
    expect(camposEtapa).toContain("draftSujoRef.current");
    expect(proximoContato).toContain("sujoRef.current");
    expect(checklist).toContain("draftSujoRef.current");
  });

  it("mantem o painel esquerdo rolavel e o mobile com scroll externo", () => {
    expect(modal).toContain("overflow-y-auto lg:overflow-hidden");
    expect(historico).toContain("lg:h-full lg:overflow-y-auto");
  });

  it("destaca o serviço ativo no cabeçalho do card", () => {
    expect(modal).toContain("BriefcaseBusiness");
    expect(modal).toContain("Serviço ativo");
    expect(modal).toContain("card.servico?.trim()");
    expect(modal).toContain('title={card.servico}');
  });

  it("centraliza o formulário da etapa e mantém o painel direito somente com a próxima etapa", () => {
    expect(registrar).toContain('value="formulario-etapa"');
    expect(registrar).toContain('id={`formulario-etapa-${card.id}`}');
    expect(registrar).toContain("etapaEhAgendarReuniao(card.etapa.nome)");
    expect(registrar).toContain("<PainelReuniao");
    expect(modal).not.toContain("<PainelReuniao");
    expect(modal).not.toContain("destinoEhReuniaoAgendada");
    expect(painelReuniao).toContain("{mostrarFormulario && (");
    expect(painelReuniao).toContain("onFocarPainelReuniao");
    expect(painelReuniao).toContain("Ir à reunião");
  });

  it("aplica readonly aos controles operacionais", () => {
    expect(camposEtapa).toContain("disabled={!podeEditar}");
    expect(camposEtapa).toContain("disabled={!podeEditar");
    expect(proximoContato).toContain("disabled={!podeEditar");
    expect(checklist).toContain("disabled={!podeEditar");
  });

  it("permite operação completa ao participante vinculado e restringe somente a gestão de membros", () => {
    expect(modal).toContain("const podeTrabalharNoCard = isAdminRole(currentUserRole) || Boolean(meuVinculo)");
    expect(modal).toContain("const podeMoverEtapa = podeTrabalharNoCard");
    expect(modal).toContain("const podeEditar = podeTrabalharNoCard");
    expect(modal).toContain("const podeGerenciarMembros = isAdminRole(currentUserRole)");
    expect(historico).toContain("const podeExcluirAnexo = isAdminRole(currentUserRole) || Boolean(meuVinculo)");
  });

  it("lista responsaveis elegiveis no contexto do pipeline", () => {
    expect(novoCard).toContain("ListarUsuariosResponsavelBpm(pipelineId)");
    expect(cardsAction).toContain("export async function ListarUsuariosResponsavelBpm(pipelineId: string)");
    expect(cardsAction).toContain("usuarioElegivelResponsavelBpm(pipelineId, usuario.id)");
  });

  it("oferece criacao somente na etapa canonica Novos Leads", () => {
    expect(board).toContain('import { etapaEhNovosLeads } from "@/lib/bpm/novos-leads"');
    expect(board).toContain("const primeiraEtapa = etapasOrdenadas[0]");
    expect(board).toContain("const etapaNovosLeads = primeiraEtapa && etapaEhNovosLeads(primeiraEtapa.nome)");
    expect(board).toContain("onAdd={etapa.id === etapaNovosLeads?.id ? () => setNovoCardAberto(true) : undefined}");
    expect(board).toContain("{novoCardAberto && etapaNovosLeads && (");
    expect(board).not.toContain("camposNovoCard");
  });

  it("oferece atualizacao manual do board sem recarregar a pagina", () => {
    expect(board).toContain("const [atualizandoManual, setAtualizandoManual]");
    expect(board).toContain("const atualizacaoManualRef = useRef(false)");
    expect(board).toContain("const atualizarPipeline = useCallback(async () => {");
    expect(board).toContain("if (atualizacaoManualRef.current || movimentoPendenteRef.current || snapshotArrastoRef.current) return");
    expect(board).toContain("await recarregarCards()");
    expect(board).toContain('aria-label="Atualizar pipeline"');
    expect(board).toContain("atualizandoManual ? \"animate-spin\" : \"\"");

    const atualizacaoManual = board.slice(
      board.indexOf("const atualizarPipeline = useCallback"),
      board.indexOf("useEffect(() => {", board.indexOf("const atualizarPipeline = useCallback")),
    );
    expect(atualizacaoManual).not.toContain("router.refresh");
    expect(atualizacaoManual).not.toContain("window.location.reload");
  });

  it("abre o card ao clicar no nome da empresa do board", () => {
    const kanbanCard = board.slice(board.indexOf("function KanbanCard"), board.indexOf("function KanbanColumn"));
    expect(kanbanCard).toContain("<button");
    expect(kanbanCard).toContain("onAbrir(card.id)");
    expect(kanbanCard).toContain("onPointerDown={(event) => event.stopPropagation()}");
    expect(kanbanCard).not.toContain("/PainelAlpha/AlphaCRM/empresa/");
  });

  it("mantem uma hierarquia visual acessivel no card do Kanban", () => {
    const kanbanCard = board.slice(board.indexOf("function KanbanCard"), board.indexOf("function KanbanColumn"));
    expect(kanbanCard).toContain("rounded-2xl");
    expect(kanbanCard).toContain("accent={accent}");
    expect(kanbanCard).toContain("surfaceClassName={statusConfig?.cardClassName}");
    expect(gradientBlobCard).toContain("border border-blue-600 bg-slate-800/95 shadow-none");
    expect(gradientBlobCard).toContain("hover:scale-[1.02]");
    expect(gradientBlobCard).toContain("duration-150");
    expect(gradientBlobCard).toContain("w-[3px]");
    expect(gradientBlobCard).not.toContain("animate-blob");
    expect(gradientBlobCard).not.toContain("dark:bg-black/50");
    expect(kanbanCard).toContain("const inicialEmpresa");
    expect(kanbanCard).toContain("<PhoneCall");
    expect(kanbanCard).toContain("<CalendarClock");
    expect(kanbanCard).toContain("<ClipboardList");
    expect(kanbanCard).toContain("const membrosVisiveis = card.membros.length > 0");
    expect(kanbanCard).toContain("<GrupoAvataresMembrosCard");
  });

  it("limita o novo card aos dados-base e preserva cadastro de empresa", () => {
    expect(novoCard).toContain("novaEmpresa:");
    expect(novoCard).toContain("empresaId: empresaSelecionada!.id");
    expect(novoCard).toContain("servico: servico.trim() || undefined");
    expect(novoCard).toContain("Os detalhes da etapa são preenchidos ao abrir o card, na aba Formulário da Etapa.");
    expect(novoCard).not.toContain("CampoBpm");
    expect(novoCard).not.toContain("camposValores");
    expect(novoCard).not.toContain("proximoContato");
    expect(novoCard).not.toContain("statusPosFechamento");
    expect(novoCard).not.toContain("Motivo Lost");
  });

  it("mantem o painel histórico no lado esquerdo do card", () => {
    expect(historico).toContain("<PainelRequisitosAvanco");
    expect(modal.indexOf("<PainelHistorico")).toBeLessThan(modal.indexOf("<PainelRegistrar"));
  });

  it("remove somente a seção visual de vínculos do card", () => {
    const painelHistoricoNoModal = modal.slice(
      modal.indexOf("<PainelHistorico\n"),
      modal.indexOf("<PainelHistoricoServico"),
    );
    expect(historico).not.toContain("CriarVinculoCardBpm");
    expect(historico).not.toContain('title="Vínculos"');
    expect(historico).not.toContain("vinculosOrigem");
    expect(painelHistoricoNoModal).not.toContain("onAbrirCard={onAbrirCard}");
  });

  it("mantem o resumo progressivo das etapas no lado esquerdo do card", () => {
    expect(historico).toContain('<PainelResumoEtapas key={card.etapa.id} card={card} etapas={etapas} accent={accent} />');
    expect(historico).toContain("<PainelResumoEtapas");
    expect(resumoEtapas).toContain("etapasAnterioresParaResumo(etapas, card.etapa.id)");
    expect(resumoEtapas).toContain('aria-label="Resumo das etapas anteriores"');
    expect(resumoEtapas).toContain("aria-expanded={aberta}");
  });

  it("compõe o status pós-fechamento no formulário central somente em Fechado", () => {
    expect(registrar).toContain("etapaEhFechado(card.etapa.nome)");
    expect(registrar).toContain("<PainelStatusPosFechamento");
    expect(statusPosFechamento).toContain("STATUS_POS_FECHAMENTO_OPCOES.map");
    expect(statusPosFechamento).toContain("disabled={!podeEditar || salvando}");
    expect(statusPosFechamento).toContain("Status ainda não definido");
    expect(statusPosFechamento).toContain("void salvar(event.target.value)");
    expect(statusPosFechamento).not.toContain("Salvar status");
  });

  it("preserva o rascunho de status diante de realtime e informa conflito", () => {
    expect(statusPosFechamento).toContain("rascunhoSujoRef.current");
    expect(statusPosFechamento).toContain("setConflitoRealtime(true)");
    expect(statusPosFechamento).toContain("Seu rascunho foi preservado");
    expect(statusPosFechamento).toContain("statusPosFechamento: status");
    expect(statusPosFechamento).toContain("versaoEsperadaEm: versaoBase");
    expect(statusPosFechamento).toContain("if (houveConflito) onAtualizado()");
    expect(registrar).toContain("versaoPersistidaEm={card.updatedAt}");
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
