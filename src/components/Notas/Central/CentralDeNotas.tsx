"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { BuscarNotas, ListarTagsDisponiveis } from "@/actions/NotasBusca";
import { CriarNota, ObterNota } from "@/actions/Notas";
import { AbrirAbaNota } from "@/actions/NotasWorkspace";
import { useNotasWorkspace } from "@/store/useNotasWorkspace";
import { getTema } from "@/lib/temas";
import type { SecaoCentralNotas } from "@/lib/validations/notas";
import type { JSONContent } from "@tiptap/react";
import { SidebarFiltros } from "./SidebarFiltros";
import { ListaNotas, type NotaListada } from "./ListaNotas";
import { PainelPropriedades } from "./PainelPropriedades";
import { EstadoVazioNotas } from "./EstadoVazioNotas";
import { NoteEditorSkeleton } from "@/components/Notas/NoteEditor/NoteEditorSkeleton";
import { NotasBackground } from "./NotasBackground";
import { NotasCard3D } from "./NotasCard3D";
import { atualizarPreviewNaLista, type AtualizacaoPreviewNota } from "@/lib/notas/preview";
import { useLixeiraNotas } from "./useLixeiraNotas";
import { CentralNotasHeader } from "./CentralNotasHeader";

// O NoteEditor carrega o Tiptap inteiro (StarterKit, tabelas, mentions, slash-command) — pesado
// demais para entrar no bundle inicial da Central se o usuário só está navegando a lista, sem
// nunca abrir uma nota. Lazy-load sob demanda, com o skeleton como estado de carregamento.
const NoteEditor = dynamic(() => import("@/components/Notas/NoteEditor/NoteEditor").then((mod) => mod.NoteEditor), {
  ssr: false,
  loading: () => <NoteEditorSkeleton />,
});

const DEBOUNCE_MS = 400;

interface CentralDeNotasProps {
  temaName?: string;
}

export function CentralDeNotas({ temaName = "blue" }: CentralDeNotasProps) {
  const tema = getTema(temaName);
  const accent = tema.accent;

  const { data: session } = useSession();
  const usuarioAtualId = Number((session?.user as { id?: string | number } | undefined)?.id ?? 0);
  const [secaoAtiva, setSecaoAtiva] = useState<SecaoCentralNotas>("RECENTES");
  // Sem seletor visual de ordenação no grid de cards — sempre por última edição, o critério
  // mais útil para "o que eu estava fazendo" num layout de galeria.
  const ordenarPor = "ATUALIZACAO" as const;
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [notas, setNotas] = useState<NotaListada[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalGeral, setTotalGeral] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [notaSelecionadaId, setNotaSelecionadaId] = useState<string | null>(null);
  const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([]);
  const [recarregarToken, setRecarregarToken] = useState(0);
  const [notaCarregada, setNotaCarregada] = useState<{
    id: string;
    title: string;
    contentJson: JSONContent;
    version: number;
  } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(queryInput);
      setPage(1);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [queryInput]);

  const carregarNotas = useCallback(async () => {
    setCarregando(true);
    const res = await BuscarNotas({
      page,
      pageSize: 20,
      query: query || undefined,
      secao: secaoAtiva,
      ordenarPor,
      tagIds: tagsSelecionadas.length > 0 ? tagsSelecionadas : undefined,
    });
    setCarregando(false);

    if (!res.success) {
      toast.error("Não foi possível carregar as notas");
      return;
    }

    setNotas(res.data as unknown as NotaListada[]);
    setTotalPages(res.totalPages ?? 1);
    setTotalGeral(res.total ?? 0);
  }, [page, query, secaoAtiva, ordenarPor, tagsSelecionadas]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregarNotas();
  }, [carregarNotas, recarregarToken]);

  useEffect(() => {
    async function carregarTags() {
      const res = await ListarTagsDisponiveis();
      if (res.success) setTags(res.data);
    }
    void carregarTags();
  }, []);

  const notaSelecionada = notas.find((nota) => nota.id === notaSelecionadaId) ?? null;
  const abrirAbaNaBarra = useNotasWorkspace((state) => state.abrirAba);
  const lixeira = useLixeiraNotas({
    notas,
    onRecarregar: () => setRecarregarToken((token) => token + 1),
    onLimparNotaAberta: () => {
      setNotaSelecionadaId(null);
      setNotaCarregada(null);
    },
    onVoltarPrimeiraPagina: () => setPage(1),
  });

  useEffect(() => {
    if (!notaSelecionadaId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza notaCarregada com a ausência de seleção, sem Promise
      setNotaCarregada(null);
      return;
    }

    let cancelado = false;
    async function carregarConteudo() {
      const res = await ObterNota(notaSelecionadaId!);
      if (cancelado || !res.success) return;
      setNotaCarregada({
        id: res.data.id,
        title: res.data.title,
        contentJson: (res.data.contentJson as JSONContent | null) ?? {},
        version: res.data.currentVersion,
      });
      // Abrir uma nota na Central também a registra como aba na barra global de notas —
      // os dois pontos de entrada (Central e barra) compartilham o mesmo workspace de abas.
      abrirAbaNaBarra(res.data.id, res.data.title);
      await AbrirAbaNota({ noteId: res.data.id });
    }
    void carregarConteudo();
    return () => {
      cancelado = true;
    };
  }, [notaSelecionadaId, abrirAbaNaBarra]);

  async function criarNota() {
    const res = await CriarNota({ title: "", contentJson: {}, plainText: "", visibility: "PRIVADA" });
    if (!res.success) {
      toast.error("Não foi possível criar a nota");
      return;
    }
    setSecaoAtiva("RECENTES");
    setPage(1);
    setNotaSelecionadaId(res.data.id);
    setRecarregarToken((token) => token + 1);
  }

  function toggleTag(tagId: string) {
    setTagsSelecionadas((atual) =>
      atual.includes(tagId) ? atual.filter((id) => id !== tagId) : [...atual, tagId],
    );
    setPage(1);
  }

  const atualizarPreview = useCallback((preview: AtualizacaoPreviewNota) => {
    setNotas((atuais) => atualizarPreviewNaLista(atuais, preview));
  }, []);

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-[#020617] text-slate-200">
      <NotasBackground accentRgb={accent} />

      <CentralNotasHeader
        accent={accent}
        total={totalGeral}
        query={queryInput}
        onQueryChange={setQueryInput}
        onCriarNota={() => void criarNota()}
      />

      <div className="relative z-10 mx-4 mb-4 mt-4 flex min-h-0 flex-1 gap-4 md:mx-6 md:mb-6">
        <NotasCard3D delay={0}>
          <div className="overflow-hidden rounded-3xl border border-white/5 bg-slate-950/40 shadow-2xl backdrop-blur-2xl transition-shadow duration-300 group-hover:border-white/10 group-hover:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.6)]">
            <SidebarFiltros
              secaoAtiva={secaoAtiva}
              onSelecionarSecao={(secao) => {
                setSecaoAtiva(secao);
                setPage(1);
                lixeira.cancelarSelecao();
                setNotaSelecionadaId(null);
              }}
              tags={tags}
              tagsSelecionadas={tagsSelecionadas}
              onToggleTag={toggleTag}
              accent={accent}
            />
          </div>
        </NotasCard3D>

        <NotasCard3D delay={0.05} className="min-w-0 flex-1">
          <div className="h-full overflow-hidden">
            <ListaNotas
              notas={notas}
              notaSelecionadaId={notaSelecionadaId}
              onSelecionar={setNotaSelecionadaId}
              page={page}
              totalPages={totalPages}
              onMudarPage={setPage}
              carregando={carregando}
              accent={accent}
              isLixeira={secaoAtiva === "LIXEIRA"}
              modoSelecao={lixeira.modoSelecao}
              notasSelecionadas={lixeira.notasSelecionadas}
              processandoLixeira={lixeira.processando}
              onAtivarSelecao={lixeira.ativarSelecao}
              onCancelarSelecao={lixeira.cancelarSelecao}
              onToggleSelecionada={lixeira.toggleSelecionada}
              onExcluirSelecionadas={() => void lixeira.excluirSelecionadas()}
              onEsvaziarLixeira={() => void lixeira.esvaziar()}
            />
          </div>
        </NotasCard3D>

        <NotasCard3D delay={0.1} className="min-w-0 flex-1">
          <div className="h-full overflow-hidden rounded-3xl border border-white/5 bg-slate-950/40 shadow-2xl backdrop-blur-2xl transition-shadow duration-300 group-hover:border-white/10 group-hover:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.6)]">
            {notaSelecionada && notaCarregada && notaCarregada.id === notaSelecionada.id ? (
              <NoteEditor
                key={notaCarregada.id}
                noteId={notaCarregada.id}
                initialTitle={notaCarregada.title}
                initialContentJson={notaCarregada.contentJson}
                initialVersion={notaCarregada.version}
                onPreviewChange={atualizarPreview}
              />
            ) : notaSelecionada ? (
              // Nota escolhida na lista, mas o conteúdo (ObterNota) ainda está a caminho —
              // sem isso o EstadoVazioNotas piscava por engano entre o clique e o carregamento.
              <NoteEditorSkeleton />
            ) : (
              <EstadoVazioNotas onCriarNota={() => void criarNota()} accent={accent} />
            )}
          </div>
        </NotasCard3D>

        {notaSelecionada && (
          <NotasCard3D delay={0.15}>
            <div className="h-full overflow-hidden rounded-3xl border border-white/5 bg-slate-950/40 shadow-2xl backdrop-blur-2xl transition-shadow duration-300 group-hover:border-white/10 group-hover:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.6)]">
              <PainelPropriedades
                nota={notaSelecionada}
                usuarioAtualId={usuarioAtualId}
                onAtualizado={() => setRecarregarToken((token) => token + 1)}
                accent={accent}
              />
            </div>
          </NotasCard3D>
        )}
      </div>
    </div>
  );
}
