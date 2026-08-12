"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus, LayoutGrid, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/react";
import { CriarNota, ObterNota, ArquivarNota, MoverNotaParaLixeira } from "@/actions/Notas";
import { FixarNota, DefinirCorNota } from "@/actions/NotasBusca";
import {
  AbrirAbaNota,
  FecharAbaNota,
  ReordenarAbasNotas,
  AtivarAbaNota,
  ObterWorkspaceNotas,
  AtualizarWorkspaceNotas,
} from "@/actions/NotasWorkspace";
import { useNotasWorkspace } from "@/store/useNotasWorkspace";
import { useNotasNotificacoes } from "@/store/useNotasNotificacoes";
import { useNotasAtalhos } from "@/hooks/useNotasAtalhos";
import { getNotasTabsStorageKey, parseStoredNotasTabsState, limparRascunhoLocalDaNota } from "@/lib/notas-tabs";
import { Z_INDEX } from "@/lib/z-index";
import { NoteTab } from "./NoteTab";
import { NoteViewer } from "./NoteViewer";
import { NotesSearchCommand } from "./NotesSearchCommand";
import { NoteShareDialog } from "@/components/Notas/Colaboracao/NoteShareDialog";
import { NoteContextLinkDialog } from "@/components/Notas/Contexto/NoteContextLinkDialog";
import { NoteColorPicker } from "./NoteColorPicker";
import { Dock, DockItem, DockIcon, DockLabel } from "@/components/ui/dock";
import { isNotasWorkspaceAtualizadoMessage } from "@/lib/notas-workspace-messages";

interface NotesGlobalTaskbarProps {
  userId: number;
  onOpenCentral: () => void;
  /** Largura REAL da sidebar desktop em px, medida ao vivo via ResizeObserver (ver
   *  GlobalSidebar/useElementWidth) — a barra encosta exatamente aqui, nunca num valor fixo
   *  assumido que pode dessincronizar do CSS real. 0 no mobile/tablet (sidebar em "gaveta",
   *  sem espaço reservado) — a barra ocupa a largura toda nesse caso. */
  sidebarWidth?: number;
}

interface NotaAtivaCarregada {
  noteId: string;
  title: string;
  contentJson: JSONContent;
  version: number;
  somenteLeitura: boolean;
}

export function NotesGlobalTaskbar({ userId, onOpenCentral, sidebarWidth = 0 }: NotesGlobalTaskbarProps) {
  const tabs = useNotasWorkspace((state) => state.tabs);
  const activeTabId = useNotasWorkspace((state) => state.activeTabId);
  const isTaskbarVisible = useNotasWorkspace((state) => state.isTaskbarVisible);
  const viewerMode = useNotasWorkspace((state) => state.viewerMode);
  const hydrated = useNotasWorkspace((state) => state.hydrated);
  const syncState = useNotasWorkspace((state) => state.syncState);

  const hidratar = useNotasWorkspace((state) => state.hidratar);
  const abrirAba = useNotasWorkspace((state) => state.abrirAba);
  const fecharAba = useNotasWorkspace((state) => state.fecharAba);
  const ativarAba = useNotasWorkspace((state) => state.ativarAba);
  const reordenarAbas = useNotasWorkspace((state) => state.reordenarAbas);
  const definirCorAba = useNotasWorkspace((state) => state.definirCorAba);
  const definirPinnedAba = useNotasWorkspace((state) => state.definirPinnedAba);
  const setViewerMode = useNotasWorkspace((state) => state.setViewerMode);
  const toggleTaskbar = useNotasWorkspace((state) => state.toggleTaskbar);
  const removerNotificacoesDaNota = useNotasNotificacoes((state) => state.removerNotificacoesDaNota);

  // Chamado sempre que uma nota é arquivada ou movida para a lixeira — garante que nenhum
  // resquício de estado em memória/localStorage (notificação já recebida, rascunho não
  // salvo) sobreviva referenciando uma nota que não está mais ativa.
  const limparResquiciosDaNota = useCallback(
    (noteId: string) => {
      removerNotificacoesDaNota(noteId);
      limparRascunhoLocalDaNota(noteId);
    },
    [removerNotificacoesDaNota],
  );

  const [notaAtiva, setNotaAtiva] = useState<NotaAtivaCarregada | null>(null);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [carregandoAbertura, setCarregandoAbertura] = useState(true);
  const [noteIdCompartilhar, setNoteIdCompartilhar] = useState<string | null>(null);
  const [noteIdVincular, setNoteIdVincular] = useState<string | null>(null);
  const [corPickerTab, setCorPickerTab] = useState<{ tabId: string; noteId: string; posicao: { x: number; y: number } } | null>(null);
  const storageKey = getNotasTabsStorageKey(userId);
  const hidratadoDoServidorRef = useRef(false);
  const isTaskbarVisibleAnteriorRef = useRef(isTaskbarVisible);

  const sincronizarWorkspaceDoServidor = useCallback(async () => {
    const res = await ObterWorkspaceNotas();
    if (!res.success) return;
    hidratar({
      tabs: res.data.abas.map((aba) => ({ id: aba.id, noteId: aba.noteId, title: aba.title, pinned: aba.isPinned, color: aba.color })),
      activeId: res.data.abas.find((aba) => aba.isActive)?.id ?? null,
    });
    setViewerMode(res.data.workspace.viewerMode as never);
  }, [hidratar, setViewerMode]);

  // Feedback visual de abertura breve e visível antes de revelar o conteúdo — dispara toda vez
  // que a barra transiciona de fechada para aberta (o componente nunca desmonta entre uma
  // abertura e outra, então não basta inicializar o estado uma vez só na montagem).
  useEffect(() => {
    const abriuAgora = isTaskbarVisible && !isTaskbarVisibleAnteriorRef.current;
    isTaskbarVisibleAnteriorRef.current = isTaskbarVisible;
    if (!abriuAgora) return;

    setCarregandoAbertura(true);
    const timeout = setTimeout(() => setCarregandoAbertura(false), 420);
    return () => clearTimeout(timeout);
  }, [isTaskbarVisible]);

  useEffect(() => {
    if (hidratadoDoServidorRef.current) return;
    hidratadoDoServidorRef.current = true;

    async function carregarWorkspace() {
      try {
        const local = parseStoredNotasTabsState(localStorage.getItem(storageKey));
        if (local) hidratar(local);
      } catch {
        /* ignore */
      }

      await sincronizarWorkspaceDoServidor();
    }

    void carregarWorkspace();
  }, [hidratar, storageKey, sincronizarWorkspaceDoServidor]);

  useEffect(() => {
    function receberAtualizacaoDoIframe(event: MessageEvent<unknown>) {
      if (event.origin !== window.location.origin) return;
      if (!isNotasWorkspaceAtualizadoMessage(event.data)) return;
      void sincronizarWorkspaceDoServidor();
    }

    window.addEventListener("message", receberAtualizacaoDoIframe);
    return () => window.removeEventListener("message", receberAtualizacaoDoIframe);
  }, [sincronizarWorkspaceDoServidor]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ tabs, activeId: activeTabId }));
    } catch {
      /* ignore */
    }
  }, [tabs, activeTabId, hydrated, storageKey]);

  useEffect(() => {
    const abaAtiva = tabs.find((tab) => tab.id === activeTabId);
    if (!abaAtiva || viewerMode === "RECOLHIDO") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza notaAtiva com a ausência de aba/visualizador recolhido, sem Promise
      setNotaAtiva(null);
      return;
    }

    let cancelado = false;
    async function carregarNota() {
      const res = await ObterNota(abaAtiva!.noteId);
      if (cancelado) return;
      if (res.success) {
        setNotaAtiva({
          noteId: res.data.id,
          title: res.data.title,
          contentJson: (res.data.contentJson as JSONContent | null) ?? {},
          version: res.data.currentVersion,
          somenteLeitura: res.somenteLeitura,
        });
      }
    }
    void carregarNota();
    return () => {
      cancelado = true;
    };
  }, [activeTabId, tabs, viewerMode]);

  const criarNovaNota = useCallback(async () => {
    const res = await CriarNota({ title: "", contentJson: {}, plainText: "", visibility: "PRIVADA" });
    if (!res.success) {
      toast.error("Não foi possível criar a nota");
      return;
    }

    abrirAba(res.data.id, res.data.title);
    await AbrirAbaNota({ noteId: res.data.id });
    setViewerMode("COMPACTO");
  }, [abrirAba, setViewerMode]);

  const fecharAbaHandler = useCallback(
    (tabId: string, noteId: string) => {
      fecharAba(tabId);
      void FecharAbaNota(noteId);
    },
    [fecharAba],
  );

  const ativarAbaHandler = useCallback(
    (tabId: string, noteId: string) => {
      ativarAba(tabId);
      void AtivarAbaNota(noteId);
      if (viewerMode === "RECOLHIDO") setViewerMode("COMPACTO");
    },
    [ativarAba, setViewerMode, viewerMode],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reordenarAbas(String(active.id), String(over.id));
    void ReordenarAbasNotas({ ordemNoteIds: tabs.map((tab) => tab.noteId) });
  }

  useNotasAtalhos({
    onNovaNota: () => void criarNovaNota(),
    onToggleBarra: toggleTaskbar,
    onAbrirCentral: onOpenCentral,
  });

  useEffect(() => {
    void AtualizarWorkspaceNotas({ isTaskbarVisible, viewerMode });
  }, [isTaskbarVisible, viewerMode]);

  // O gatilho de abrir/fechar agora vive no ícone da sidebar (NotesLauncherButton).
  // AnimatePresence precisa que o componente que sai continue montado durante a animação de
  // saída — por isso o "fechado" não é um `return null` direto, é a ausência do filho dentro
  // de AnimatePresence (ver fechamento do componente mais abaixo).
  return (
    <>
      {isTaskbarVisible && notaAtiva && (
        <NoteViewer
          noteId={notaAtiva.noteId}
          initialTitle={notaAtiva.title}
          initialContentJson={notaAtiva.contentJson}
          initialVersion={notaAtiva.version}
          somenteLeitura={notaAtiva.somenteLeitura}
          onFechar={() => setViewerMode("RECOLHIDO")}
        />
      )}

      {/*
        Efeito de "parede saindo/voltando pra dentro da sidebar": a faixa cresce (abrindo) ou
        encolhe (fechando) em largura a partir da borda esquerda (transformOrigin: left —
        exatamente onde a sidebar termina), em vez de um fade.
      */}
      <AnimatePresence>
        {isTaskbarVisible && carregandoAbertura && (
          <motion.div
            key="notas-carregando"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            style={{ zIndex: Z_INDEX.barraNotas, transformOrigin: "left", left: sidebarWidth }}
            className="fixed bottom-0 right-0 h-10 border-t border-amber-500/20 bg-[#030813] transition-[left] duration-200 ease-in-out"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.15 }}
              className="flex h-full items-center justify-center gap-2 px-2 text-[11px] font-medium text-amber-300"
            >
              <Loader2 size={14} className="animate-spin" />
              Carregando
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTaskbarVisible && !carregandoAbertura && (
          <motion.div
            key="notas-barra"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0 }}
            transition={{ duration: 0.26, ease: "easeInOut" }}
            style={{ zIndex: Z_INDEX.barraNotas, transformOrigin: "left", left: sidebarWidth }}
            className="fixed bottom-0 right-0 flex h-10 items-center gap-1 border-t border-white/[0.06] bg-[#030813] px-2 transition-[left] duration-200 ease-in-out"
          >
            <button
              type="button"
              title="Nova nota (Ctrl+Shift+N)"
              onClick={() => void criarNovaNota()}
              className="flex h-7 shrink-0 items-center gap-1 rounded-lg border border-white/10 px-2 text-[11px] font-medium text-slate-300 hover:bg-white/5 hover:text-white"
            >
              <Plus size={13} />
              Nova nota
            </button>

            <button
              type="button"
              title="Bloco de notas ALpha (Ctrl+Alt+N)"
              onClick={onOpenCentral}
              className="flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <LayoutGrid size={13} />
              Central
            </button>

            <Dock orientation="horizontal" magnification={34} distance={60} panelSize={28} className="gap-0.5">
              <DockItem>
                <button
                  type="button"
                  onClick={() => setBuscaAberta(true)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
                >
                  <DockIcon><Search size={13} /></DockIcon>
                  <DockLabel>Buscar notas</DockLabel>
                </button>
              </DockItem>
            </Dock>

            <div className="h-4 w-px shrink-0 bg-white/10" />

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={tabs.map((tab) => tab.id)} strategy={horizontalListSortingStrategy}>
                <div
                  role="tablist"
                  aria-label="Notas abertas"
                  className="flex h-full min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {tabs.map((tab) => (
                    <NoteTab
                      key={tab.id}
                      tabId={tab.id}
                      noteId={tab.noteId}
                      title={tab.title}
                      isActive={tab.id === activeTabId && viewerMode !== "RECOLHIDO"}
                      isPinned={tab.pinned}
                      color={tab.color}
                      syncState={syncState[tab.noteId]}
                      onActivate={() => ativarAbaHandler(tab.id, tab.noteId)}
                      onClose={() => fecharAbaHandler(tab.id, tab.noteId)}
                      onRenomear={() => {
                        /* renomear via prompt simples nesta fase — refinamento de UI fica para fases seguintes */
                        const novoTitulo = window.prompt("Renomear nota", tab.title);
                        if (novoTitulo) useNotasWorkspace.getState().renomearAba(tab.id, novoTitulo);
                      }}
                      onFixar={async () => {
                        const novoValor = !tab.pinned;
                        const res = await FixarNota({ noteId: tab.noteId, fixada: novoValor });
                        if (!res.success) {
                          toast.error(res.error ?? "Não foi possível atualizar a nota");
                          return;
                        }
                        definirPinnedAba(tab.noteId, novoValor);
                        toast.success(novoValor ? "Nota fixada na barra" : "Nota desafixada");
                      }}
                      onEscolherCor={(posicao) => setCorPickerTab({ tabId: tab.id, noteId: tab.noteId, posicao })}
                      onDuplicar={() => toast.info("Duplicar nota — disponível no Bloco de notas ALpha (Fase 03)")}
                      onCompartilhar={() => setNoteIdCompartilhar(tab.noteId)}
                      onAbrirTelaAmpla={() => {
                        ativarAbaHandler(tab.id, tab.noteId);
                        setViewerMode("TELA_AMPLA");
                      }}
                      onVincular={() => setNoteIdVincular(tab.noteId)}
                      onFecharOutras={() => {
                        tabs.filter((t) => t.id !== tab.id).forEach((t) => fecharAbaHandler(t.id, t.noteId));
                      }}
                      onFecharADireita={() => {
                        const idx = tabs.findIndex((t) => t.id === tab.id);
                        tabs.slice(idx + 1).forEach((t) => fecharAbaHandler(t.id, t.noteId));
                      }}
                      onArquivar={async () => {
                        await ArquivarNota(tab.noteId);
                        fecharAbaHandler(tab.id, tab.noteId);
                        limparResquiciosDaNota(tab.noteId);
                        toast.success("Nota arquivada");
                      }}
                      onExcluir={async () => {
                        await MoverNotaParaLixeira(tab.noteId);
                        fecharAbaHandler(tab.id, tab.noteId);
                        limparResquiciosDaNota(tab.noteId);
                        toast.success("Nota movida para a lixeira");
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

          </motion.div>
        )}
      </AnimatePresence>

      <NotesSearchCommand open={buscaAberta} onOpenChange={setBuscaAberta} />

      {noteIdCompartilhar && (
        <NoteShareDialog
          noteId={noteIdCompartilhar}
          open={noteIdCompartilhar !== null}
          onOpenChange={(open) => {
            if (!open) setNoteIdCompartilhar(null);
          }}
        />
      )}

      {noteIdVincular && (
        <NoteContextLinkDialog
          noteId={noteIdVincular}
          open={noteIdVincular !== null}
          onOpenChange={(open) => {
            if (!open) setNoteIdVincular(null);
          }}
        />
      )}

      {corPickerTab && (
        <NoteColorPicker
          open={corPickerTab !== null}
          posicao={corPickerTab.posicao}
          corAtual={tabs.find((t) => t.id === corPickerTab.tabId)?.color}
          onOpenChange={(open) => {
            if (!open) setCorPickerTab(null);
          }}
          onEscolher={async (cor) => {
            definirCorAba(corPickerTab.tabId, cor);
            const res = await DefinirCorNota({ noteId: corPickerTab.noteId, color: cor });
            if (!res.success) toast.error(res.error ?? "Não foi possível salvar a cor");
          }}
        />
      )}
    </>
  );
}
