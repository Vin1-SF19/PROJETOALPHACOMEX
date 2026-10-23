"use client";

import { lazy, Suspense, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePenLine, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { FichaViabilidadeDTO } from "@/lib/bpm/ficha-viabilidade-documento";
import type { AnexoParaVisualizar } from "@/components/bpm/anexos/VisualizadorAnexoCard";
import { formatarBytes } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelHistoricoShared";

const ModalPDF = lazy(() => import("@/components/ModalPdf"));
type Anexo = AnexoParaVisualizar & { tamanho: number | null };
interface Props {
  cardId: string;
  anexos: Anexo[];
  consultarFicha: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
  realtimeRevision: number;
  onAbrir: (anexo: AnexoParaVisualizar) => void;
  onExcluir: (id: string) => void;
  onAtualizado: () => void;
}

/** O provider pertence à composição real da lista, inclusive no host do card. */
export function AnexosComFichaCard(props: Props) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return <QueryClientProvider client={client}><ListaAnexos {...props} /></QueryClientProvider>;
}

function ListaAnexos({ cardId, anexos, consultarFicha, podeEditar, podeExcluir, realtimeRevision, onAbrir, onExcluir, onAtualizado }: Props) {
  const [editando, setEditando] = useState<FichaViabilidadeDTO | null>(null);
  const client = useQueryClient();
  const queryKey = ["ficha-viabilidade-card", cardId, realtimeRevision, anexos.map((anexo) => anexo.id).join(":")];
  const consulta = useQuery({
    queryKey,
    enabled: consultarFicha,
    queryFn: async () => {
      const { ObterFichaViabilidadeBpm } = await import("@/actions/bpm/FichaViabilidade");
      const resultado = await ObterFichaViabilidadeBpm({ cardId });
      if (!resultado.success) throw new Error(resultado.error);
      return resultado.data;
    },
  });
  const ficha = consulta.data;
  return <div className="space-y-1.5">
    {consulta.isError && <div role="alert" className="rounded-xl border border-amber-400/20 p-3 text-xs text-amber-200">
      Não foi possível carregar os dados para complementar a ficha. <button type="button" onClick={() => void consulta.refetch()} className="underline">Tentar novamente</button>
    </div>}
    {anexos.map((anexo) => <div key={anexo.id} className="space-y-2">
      {ficha?.anexoId === anexo.id && podeEditar && <button type="button" onClick={() => setEditando(ficha)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
        <FilePenLine size={14} aria-hidden="true" />Complementar Ficha
      </button>}
      <div className="flex items-center justify-between gap-2 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2">
        <button type="button" onClick={() => onAbrir(anexo)} className="min-w-0 truncate text-left text-sm text-white hover:underline">{anexo.nome}</button>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-slate-500">{anexo.somenteLeitura ? "Financeiro · Somente leitura" : formatarBytes(anexo.tamanho)}</span>
          {podeExcluir && !anexo.somenteLeitura && <button type="button" aria-label={`Excluir anexo ${anexo.nome}`} onClick={() => onExcluir(anexo.id)} className="text-slate-500 hover:text-rose-400"><Trash2 size={13} /></button>}
        </div>
      </div>
    </div>)}
    {editando && <Suspense fallback={<p role="status" className="text-xs text-slate-300">Abrindo ficha…</p>}><ModalPDF key={`${cardId}:${editando.revision}`} dados={editando.dados} radarDados={editando.dados.radar} user={editando.userLogado} isOpen modo="complementar" dadosManuaisIniciais={editando.dados.extra} onClose={() => setEditando(null)} onSalvar={async (extras) => {
      const { SalvarComplementoFichaViabilidadeBpm } = await import("@/actions/bpm/FichaViabilidade");
      const resultado = await SalvarComplementoFichaViabilidadeBpm({ cardId, expectedRevision: editando.revision, extras });
      if (!resultado.success) throw new Error(resultado.error);
      await client.cancelQueries({ queryKey });
      client.setQueryData(queryKey, resultado.data);
      onAtualizado();
      toast.success("Ficha de análise de viabilidade atualizada.");
    }} /></Suspense>}
  </div>;
}
