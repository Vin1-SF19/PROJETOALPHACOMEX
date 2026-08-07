"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
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
import { Plus, LayoutGrid, ChevronUp, ChevronDown, StickyNote, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/react";
import { CriarNota, ObterNota, ArquivarNota, MoverNotaParaLixeira } from "@/actions/Notas";
import {
  AbrirAbaNota,
  FecharAbaNota,
  ReordenarAbasNotas,
  AtivarAbaNota,
  ObterWorkspaceNotas,
  AtualizarWorkspaceNotas,
} from "@/actions/NotasWorkspace";
import { useNotasWorkspace } from "@/store/useNotasWorkspace";
import { useNotasAtalhos } from "@/hooks/useNotasAtalhos";
import { getNotasTabsStorageKey, parseStoredNotasTabsState } from "@/lib/notas-tabs";
import { Z_INDEX } from "@/lib/z-index";
import { NoteTab } from "./NoteTab";
import { NoteViewer } from "./NoteViewer";
import { NotesSearchCommand } from "./NotesSearchCommand";

interface NotesGlobalTaskbarProps {
  userId: number;
  /** Classe de padding-left (ex: "lg:pl-[260px]") — mesmo recuo do conteúdo principal, para a barra nunca cobrir a sidebar fixa em telas lg+. */
  sidebarOffsetClass?: string;
}

interface NotaAtivaCarregada {
  noteId: string;
  title: string;
  contentJson: JSONContent;
  version: number;
}

export function NotesGlobalTaskbar({ userId, sidebarOffsetClass = "" }: NotesGlobalTaskbarProps) {
  const router = useRouter();
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
  const setViewerMode = useNotasWorkspace((state) => state.setViewerMode);
  const toggleTaskbar = useNotasWorkspace((state) => state.toggleTaskbar);

  const [notaAtiva, setNotaAtiva] = useState<NotaAtivaCarregada | null>(null);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const storageKey = getNotasTabsStorageKey(userId);
  const hidratadoDoServidorRef = useRef(false);

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

      const res = await ObterWorkspaceNotas();
      if (res.success) {
        hidratar({
          tabs: res.data.abas.map((aba) => ({ id: aba.id, noteId: aba.noteId, title: aba.title, pinned: aba.isPinned })),
          activeId: res.data.abas.find((aba) => aba.isActive)?.id ?? null,
        });
        setViewerMode(res.data.workspace.viewerMode as never);
      }
    }

    void carregarWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    onAbrirCentral: () => router.push("/PainelAlpha/Notas"),
  });

  useEffect(() => {
    void AtualizarWorkspaceNotas({ isTaskbarVisible, viewerMode });
  }, [isTaskbarVisible, viewerMode]);

  if (!isTaskbarVisible) {
    return (
      <button
        type="button"
        onClick={toggleTaskbar}
        title="Mostrar barra de notas"
        className="fixed bottom-2 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#0b1120] text-slate-400 shadow-lg hover:text-white"
        style={{ zIndex: Z_INDEX.barraNotas }}
      >
        <StickyNote size={14} />
      </button>
    );
  }

  return (
    <>
      {notaAtiva && (
        <NoteViewer
          noteId={notaAtiva.noteId}
          initialTitle={notaAtiva.title}
          initialContentJson={notaAtiva.contentJson}
          initialVersion={notaAtiva.version}
          onFechar={() => setViewerMode("RECOLHIDO")}
        />
      )}

      <div
        className={cn(
          "fixed inset-x-0 bottom-0 flex h-10 items-center gap-1 border-t border-white/[0.06] bg-[#030813] px-2 transition-all duration-300 ease-in-out",
          sidebarOffsetClass,
        )}
        style={{ zIndex: Z_INDEX.barraNotas }}
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
          title="Central de Notas (Ctrl+Alt+N)"
          onClick={() => router.push("/PainelAlpha/Notas")}
          className="flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <LayoutGrid size={13} />
          Central
        </button>

        <button
          type="button"
          title="Buscar notas"
          onClick={() => setBuscaAberta(true)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <Search size={13} />
        </button>

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
                  syncState={syncState[tab.noteId]}
                  onActivate={() => ativarAbaHandler(tab.id, tab.noteId)}
                  onClose={() => fecharAbaHandler(tab.id, tab.noteId)}
                  onRenomear={() => {
                    /* renomear via prompt simples nesta fase — refinamento de UI fica para fases seguintes */
                    const novoTitulo = window.prompt("Renomear nota", tab.title);
                    if (novoTitulo) useNotasWorkspace.getState().renomearAba(tab.id, novoTitulo);
                  }}
                  onFixar={() => toast.info("Fixar nota — disponível na Central de Notas (Fase 03)")}
                  onDuplicar={() => toast.info("Duplicar nota — disponível na Central de Notas (Fase 03)")}
                  onCompartilhar={() => toast.info("Compartilhamento chega na Fase 05")}
                  onAbrirTelaAmpla={() => {
                    ativarAbaHandler(tab.id, tab.noteId);
                    setViewerMode("TELA_AMPLA");
                  }}
                  onVincular={() => toast.info("Vincular a registro chega na Fase 04")}
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
                    toast.success("Nota arquivada");
                  }}
                  onExcluir={async () => {
                    await MoverNotaParaLixeira(tab.noteId);
                    fecharAbaHandler(tab.id, tab.noteId);
                    toast.success("Nota movida para a lixeira");
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button
          type="button"
          title={viewerMode === "RECOLHIDO" ? "Expandir painel" : "Recolher painel"}
          onClick={() => setViewerMode(viewerMode === "RECOLHIDO" ? "COMPACTO" : "RECOLHIDO")}
          className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-white"
        >
          {viewerMode === "RECOLHIDO" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      <NotesSearchCommand open={buscaAberta} onOpenChange={setBuscaAberta} />
    </>
  );
}
