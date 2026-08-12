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
import { TutorialNotasModal } from "./TutorialNotasModal";
import { GuiaModuloTour } from "@/components/Guias/GuiaModuloTour";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NoteTeamsManager } from "@/components/Notas/Colaboracao/NoteTeamsManager";
import {
  marcarTutorialModuloComoVisto,
  tutorialModuloFoiVisto,
  type ConfigTutorialModulo,
} from "@/lib/guias/tutorial-modulo";

// O NoteEditor carrega o Tiptap inteiro (StarterKit, tabelas, mentions, slash-command) — pesado
// demais para entrar no bundle inicial da Central se o usuário só está navegando a lista, sem
// nunca abrir uma nota. Lazy-load sob demanda, com o skeleton como estado de carregamento.
const NoteEditor = dynamic(() => import("@/components/Notas/NoteEditor/NoteEditor").then((mod) => mod.NoteEditor), {
  ssr: false,
  loading: () => <NoteEditorSkeleton />,
});

const DEBOUNCE_MS = 400;

// Passos do tour guiado com spotlight — cada `seletor` precisa apontar para um elemento real,
// marcado com data-guia-notas na respectiva JSX. Passos como os do painel de propriedades só
// existem no DOM com uma nota aberta: filtrarPassosTutorialDisponiveis (chamado pelo
// GuiaModuloTour) descarta automaticamente qualquer passo sem alvo no momento em que o tour
// abre, então não é preciso tratar isso aqui.
const TUTORIAL_NOTAS: ConfigTutorialModulo = {
  modulo: "notas",
  versao: 2,
  titulo: "Tutoriais do Bloco de Notas",
  passos: [
    {
      id: "visao-geral",
      seletor: '[data-guia-notas="visao-geral"]',
      titulo: "Bem-vindo ao Bloco de Notas Alpha",
      descricao: "Aqui você cria, organiza e compartilha notas do painel. Vamos percorrer rapidamente cada área e cada botão de ação.",
    },
    {
      id: "nova-nota",
      seletor: '[data-guia-notas="nova-nota"]',
      titulo: "Crie uma nova nota",
      descricao: "Clique em Nova nota para abrir uma nota em branco direto no editor. Ela é salva automaticamente enquanto você digita.",
    },
    {
      id: "busca",
      seletor: '[data-guia-notas="busca"]',
      titulo: "Pesquise suas notas",
      descricao: "Digite qualquer trecho do título ou do conteúdo para filtrar a lista em tempo real.",
    },
    {
      id: "secoes",
      seletor: '[data-guia-notas="secoes"]',
      titulo: "Navegue pelas seções",
      descricao: "Recentes, Favoritas, Fixadas, Compartilhadas comigo, Criadas por mim, Notas de equipe, Contextuais, Arquivadas e Lixeira — cada seção filtra a lista automaticamente.",
    },
    {
      id: "tags",
      seletor: '[data-guia-notas="tags"]',
      titulo: "Filtre por etiquetas",
      descricao: "Clique em uma ou mais etiquetas para combinar filtros e encontrar notas relacionadas a um mesmo assunto.",
    },
    {
      id: "lista-cards",
      seletor: '[data-guia-notas="lista-cards"]',
      titulo: "Seus cards de notas",
      descricao: "Cada card mostra uma prévia da nota, autor, data e contadores de anexos e comentários. Clique em um card para abri-lo direto no editor.",
    },
    {
      id: "editor-toolbar",
      seletor: '[data-guia-notas="editor-toolbar"]',
      titulo: "Formate o conteúdo",
      descricao: "Use a barra de ferramentas para títulos, listas, checklist, citações, código e tabelas no estilo Word — inclusive edição de linhas e colunas.",
    },
    {
      id: "propriedades-acoes",
      seletor: '[data-guia-notas="propriedades-acoes"]',
      titulo: "Botões de ação da nota",
      descricao: "Este bloco vertical reúne todas as ações disponíveis para a nota aberta — vamos ver cada botão a seguir.",
    },
    {
      id: "acao-fixar",
      seletor: '[data-guia-notas="acao-fixar"]',
      titulo: "Fixar",
      descricao: "Fixa a nota como aba permanente na barra de tarefas — ela fica sempre visível, mesmo fechando a Central, e só pode ser fechada depois de desafixada.",
    },
    {
      id: "acao-favoritar",
      seletor: '[data-guia-notas="acao-favoritar"]',
      titulo: "Favoritar",
      descricao: "Marca a nota para aparecer na seção Favoritas, um atalho rápido para o que você mais usa.",
    },
    {
      id: "acao-compartilhar",
      seletor: '[data-guia-notas="acao-compartilhar"]',
      titulo: "Compartilhar",
      descricao: "Compartilha a nota com pessoas ou times do painel, escolhendo o papel de cada um: Leitor (só visualiza), Comentarista (visualiza e comenta), Editor (edita o conteúdo) ou Admin (também compartilha e exclui).",
    },
    {
      id: "acao-historico",
      seletor: '[data-guia-notas="acao-historico"]',
      titulo: "Histórico de versões",
      descricao: "Toda edição salva gera uma versão. Abra o histórico para consultar ou restaurar uma versão anterior da nota.",
    },
    {
      id: "acao-lembretes",
      seletor: '[data-guia-notas="acao-lembretes"]',
      titulo: "Lembretes",
      descricao: "Cria um lembrete vinculado à nota — você recebe uma notificação no painel na data e hora marcadas.",
    },
    {
      id: "acao-arquivar",
      seletor: '[data-guia-notas="acao-arquivar"]',
      titulo: "Arquivar",
      descricao: "Tira a nota das seções ativas sem apagar nada. Ela continua acessível pela seção Arquivadas.",
    },
    {
      id: "acao-lixeira",
      seletor: '[data-guia-notas="acao-lixeira"]',
      titulo: "Mover para a lixeira",
      descricao: "Envia a nota para a Lixeira. É reversível por um tempo — depois disso ela pode ser excluída definitivamente.",
    },
    {
      id: "propriedades-etiquetas",
      seletor: '[data-guia-notas="propriedades-etiquetas"]',
      titulo: "Etiquetas da nota",
      descricao: "Aqui aparecem as etiquetas aplicadas a esta nota específica, para organização e busca.",
    },
    {
      id: "propriedades-anexos",
      seletor: '[data-guia-notas="propriedades-anexos"]',
      titulo: "Anexos",
      descricao: "Clique em Anexar para enviar um arquivo à nota. Clique no nome de um anexo já enviado para abrir uma pré-visualização — imagens e PDFs abrem direto na tela, outros tipos oferecem download.",
    },
    {
      id: "tutorial-botao",
      seletor: '[data-guia-notas="tutorial-botao"]',
      titulo: "Rever este tutorial",
      descricao: "Sempre que precisar, clique em Como usar aqui no topo para reabrir o resumo completo ou repetir este tour guiado.",
    },
  ],
};

interface CentralDeNotasProps {
  temaName?: string;
}

export function CentralDeNotas({ temaName = "blue" }: CentralDeNotasProps) {
  const tema = getTema(temaName);
  const accent = tema.accent;

  const { data: session } = useSession();
  const usuarioAtualId = Number((session?.user as { id?: string | number } | undefined)?.id ?? 0);
  const [tutorialAberto, setTutorialAberto] = useState(false);
  const [tourAberto, setTourAberto] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [propriedadesAbertas, setPropriedadesAbertas] = useState(false);
  const [equipesAbertas, setEquipesAbertas] = useState(false);
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
    somenteLeitura: boolean;
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza notaCarregada/propriedadesAbertas com a ausência de seleção, sem Promise
      setNotaCarregada(null);
      setPropriedadesAbertas(false);
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
        somenteLeitura: res.somenteLeitura,
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

  useEffect(() => {
    if (!usuarioAtualId) return;
    const frame = window.requestAnimationFrame(() => {
      try {
        if (!tutorialModuloFoiVisto(window.localStorage, TUTORIAL_NOTAS, usuarioAtualId)) {
          setTutorialAberto(true);
        }
      } catch {
        setTutorialAberto(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [usuarioAtualId]);

  const finalizarTutorial = useCallback(() => {
    try {
      marcarTutorialModuloComoVisto(window.localStorage, TUTORIAL_NOTAS, usuarioAtualId);
    } catch {
      // O tour continua utilizável quando o navegador bloqueia armazenamento local.
    }
    setTutorialAberto(false);
  }, [usuarioAtualId]);

  const iniciarTourGuiado = useCallback(() => {
    setTutorialAberto(false);
    // Aguarda o modal terminar de fechar antes de medir posições de spotlight — abrir os dois
    // ao mesmo tempo faria o GuiaModuloTour calcular retângulos com o modal ainda ocupando tela.
    window.requestAnimationFrame(() => setTourAberto(true));
  }, []);

  const finalizarTour = useCallback(() => {
    try {
      marcarTutorialModuloComoVisto(window.localStorage, TUTORIAL_NOTAS, usuarioAtualId);
    } catch {
      // O tour continua utilizável quando o navegador bloqueia armazenamento local.
    }
    setTourAberto(false);
  }, [usuarioAtualId]);

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-[#020617] text-slate-200">
      <NotasBackground accentRgb={accent} />

      <CentralNotasHeader
        accent={accent}
        total={totalGeral}
        query={queryInput}
        onQueryChange={setQueryInput}
        onCriarNota={() => void criarNota()}
        onAbrirTutorial={() => setTutorialAberto(true)}
        onAbrirFiltros={() => setFiltrosAbertos(true)}
        onAbrirEquipes={() => setEquipesAbertas(true)}
      />

      <div className="relative z-10 mx-3 mb-3 mt-3 flex min-h-0 flex-1 gap-4 md:mx-6 md:mb-6 md:mt-4">
        {/* Filtros: coluna fixa no desktop (lg+), gaveta deslizante no mobile/tablet. */}
        <div className="hidden lg:block">
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
        </div>

        {/* Lista: tela cheia no mobile enquanto nenhuma nota está aberta; some quando o editor
            assume a tela (< lg). No desktop, sempre visível lado a lado com o editor. */}
        <div className={notaSelecionada ? "hidden min-w-0 flex-1 lg:block" : "min-w-0 flex-1"}>
          <NotasCard3D delay={0.05} className="h-full">
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
        </div>

        {/* Editor: tela cheia no mobile assim que uma nota é selecionada, com botão de voltar
            embutido no próprio NoteEditor (< lg). No desktop, coluna fixa sempre visível. */}
        <div className={notaSelecionada ? "min-w-0 flex-1" : "hidden min-w-0 flex-1 lg:block"}>
          <NotasCard3D delay={0.1} className="h-full">
            <div className="h-full overflow-hidden rounded-3xl border border-white/5 bg-slate-950/40 shadow-2xl backdrop-blur-2xl transition-shadow duration-300 group-hover:border-white/10 group-hover:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.6)]">
              {notaSelecionada && notaCarregada && notaCarregada.id === notaSelecionada.id ? (
                <NoteEditor
                  key={notaCarregada.id}
                  noteId={notaCarregada.id}
                  initialTitle={notaCarregada.title}
                  initialContentJson={notaCarregada.contentJson}
                  initialVersion={notaCarregada.version}
                  onPreviewChange={atualizarPreview}
                  somenteLeitura={notaCarregada.somenteLeitura}
                  onVoltarMobile={() => setNotaSelecionadaId(null)}
                  onAbrirAcoesMobile={() => setPropriedadesAbertas(true)}
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
        </div>

        {/* Propriedades: coluna fixa só no desktop — no mobile/tablet vira bottom sheet,
            acionada pelo botão "Ações" dentro do próprio NoteEditor. */}
        {notaSelecionada && (
          <div className="hidden lg:block">
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
          </div>
        )}
      </div>

      <Sheet open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
        <SheetContent side="left" className="w-[85vw] max-w-xs p-0 lg:hidden">
          <SheetHeader className="border-b border-white/5">
            <SheetTitle className="text-sm">Seções e etiquetas</SheetTitle>
          </SheetHeader>
          <SidebarFiltros
            secaoAtiva={secaoAtiva}
            onSelecionarSecao={(secao) => {
              setSecaoAtiva(secao);
              setPage(1);
              lixeira.cancelarSelecao();
              setNotaSelecionadaId(null);
              setFiltrosAbertos(false);
            }}
            tags={tags}
            tagsSelecionadas={tagsSelecionadas}
            onToggleTag={toggleTag}
            accent={accent}
            className="w-full"
          />
        </SheetContent>
      </Sheet>

      {notaSelecionada && (
        <Sheet open={propriedadesAbertas} onOpenChange={setPropriedadesAbertas}>
          <SheetContent side="bottom" className="max-h-[85vh] p-0 lg:hidden">
            <SheetHeader className="border-b border-white/5">
              <SheetTitle className="text-sm">Ações da nota</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto">
              <PainelPropriedades
                nota={notaSelecionada}
                usuarioAtualId={usuarioAtualId}
                onAtualizado={() => setRecarregarToken((token) => token + 1)}
                accent={accent}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      <TutorialNotasModal
        aberto={tutorialAberto}
        onFechar={finalizarTutorial}
        onIniciarTour={iniciarTourGuiado}
        accent={accent}
      />
      <NoteTeamsManager open={equipesAbertas} onOpenChange={setEquipesAbertas} />
      <GuiaModuloTour aberto={tourAberto} config={TUTORIAL_NOTAS} accent={accent} onFinalizar={finalizarTour} />
    </div>
  );
}
