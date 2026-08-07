"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { BuscarNotas, ListarTagsDisponiveis } from "@/actions/NotasBusca";
import { CriarNota, ObterNota } from "@/actions/Notas";
import type { SecaoCentralNotas, OrdenacaoNotas } from "@/lib/validations/notas";
import type { JSONContent } from "@tiptap/react";
import { SidebarFiltros } from "./SidebarFiltros";
import { ListaNotas, type NotaListada } from "./ListaNotas";
import { PainelPropriedades } from "./PainelPropriedades";
import { EstadoVazioNotas } from "./EstadoVazioNotas";
import { NoteEditor } from "@/components/Notas/NoteEditor/NoteEditor";

const DEBOUNCE_MS = 400;

export function CentralDeNotas() {
  const { data: session } = useSession();
  const usuarioAtualId = Number((session?.user as { id?: string | number } | undefined)?.id ?? 0);
  const [secaoAtiva, setSecaoAtiva] = useState<SecaoCentralNotas>("RECENTES");
  const [ordenarPor, setOrdenarPor] = useState<OrdenacaoNotas>("ATUALIZACAO");
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
    }
    void carregarConteudo();
    return () => {
      cancelado = true;
    };
  }, [notaSelecionadaId]);

  async function criarNota() {
    const res = await CriarNota({ title: "", contentJson: {}, plainText: "", visibility: "PRIVADA" });
    if (!res.success) {
      toast.error("Não foi possível criar a nota");
      return;
    }
    setSecaoAtiva("RECENTES");
    setNotaSelecionadaId(res.data.id);
    setRecarregarToken((token) => token + 1);
  }

  function toggleTag(tagId: string) {
    setTagsSelecionadas((atual) =>
      atual.includes(tagId) ? atual.filter((id) => id !== tagId) : [...atual, tagId],
    );
    setPage(1);
  }

  return (
    <div className="flex h-screen w-full flex-col bg-[#020617] text-slate-200">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/5 px-4 py-3">
        <h1 className="text-sm font-semibold text-white">Central de Notas</h1>
        <span className="text-xs text-slate-600">{totalGeral} notas</span>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
            <Search size={13} className="text-slate-500" aria-hidden="true" />
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Pesquisar notas..."
              className="w-56 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
            />
          </div>
          <button
            type="button"
            onClick={() => void criarNota()}
            className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
          >
            <Plus size={13} /> Nova nota
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <SidebarFiltros
          secaoAtiva={secaoAtiva}
          onSelecionarSecao={(secao) => {
            setSecaoAtiva(secao);
            setPage(1);
          }}
          tags={tags}
          tagsSelecionadas={tagsSelecionadas}
          onToggleTag={toggleTag}
        />

        <ListaNotas
          notas={notas}
          notaSelecionadaId={notaSelecionadaId}
          onSelecionar={setNotaSelecionadaId}
          ordenarPor={ordenarPor}
          onMudarOrdenacao={(valor) => {
            setOrdenarPor(valor);
            setPage(1);
          }}
          page={page}
          totalPages={totalPages}
          onMudarPage={setPage}
          carregando={carregando}
        />

        <div className="min-w-0 flex-1">
          {notaSelecionada && notaCarregada && notaCarregada.id === notaSelecionada.id ? (
            <NoteEditor
              key={notaCarregada.id}
              noteId={notaCarregada.id}
              initialTitle={notaCarregada.title}
              initialContentJson={notaCarregada.contentJson}
              initialVersion={notaCarregada.version}
            />
          ) : (
            <EstadoVazioNotas onCriarNota={() => void criarNota()} />
          )}
        </div>

        {notaSelecionada && (
          <PainelPropriedades
            nota={notaSelecionada}
            usuarioAtualId={usuarioAtualId}
            onAtualizado={() => setRecarregarToken((token) => token + 1)}
          />
        )}
      </div>
    </div>
  );
}
