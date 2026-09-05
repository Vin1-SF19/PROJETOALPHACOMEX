"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  Trash2,
  History,
  CheckCircle2,
  Paperclip,
  ListTodo,
  MessageSquareText,
  CalendarClock,
  ClipboardCheck,
} from "lucide-react";
import { fmtDateTime } from "@/lib/format-date";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { RegistrarAnexoBpm, ExcluirAnexoBpm } from "@/actions/bpm/Anexos";
import { ListarInteracoesCardBpm } from "@/actions/bpm/Interacoes";
import { isAdminRole } from "@/lib/roles";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { montarFeedTimelineCard, type ItemTimelineCard } from "@/lib/bpm/timeline";
import PainelTimelineCard from "./PainelTimelineCard";
import { PainelCadenciasCard } from "@/components/bpm/cadencias/PainelCadenciasCard";

import { PainelResumoEtapas } from "./PainelResumoEtapas";
import { PainelTarefasPorTipo } from "./PainelTarefasPorTipo";
import { PainelConhecimentoRelacionado } from "@/components/bpm/conhecimento/PainelConhecimentoRelacionado";
import { etapasAnterioresParaResumo } from "@/lib/bpm/resumo-etapas";
import { PainelChecklistsCard } from "./PainelChecklistsCard";
import { EditorAnotacaoCard } from "./EditorAnotacaoCard";
import { formatarBytes, formatarValorHistorico, iconePorAcao } from "./PainelHistoricoShared";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type Interacao = Awaited<ReturnType<typeof ListarInteracoesCardBpm>>["data"][number];

interface Props {
  card: CardDetalhe;
  accent: string;
  currentUserId: number | null;
  currentUserRole: string | null;
  onAtualizado: () => void;

  etapas: { id: string; nome: string; ordem: number }[];


  podeTrabalharTarefas: boolean;
  podeEditar: boolean;
  realtimeRevision: number;
  onInteracaoCriada: (interacao: Interacao) => void;
  anotacoes: Interacao[];
}

export default function PainelHistorico({
  card,
  accent,
  currentUserId,
  currentUserRole,
  onAtualizado,
  etapas,
  podeTrabalharTarefas,
  podeEditar,
  realtimeRevision,
  onInteracaoCriada,
  anotacoes,
}: Props) {
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [arrastandoAnexo, setArrastandoAnexo] = useState(false);
  const [abaEsquerda, setAbaEsquerda] = useState("etapas");
  const inputAnexoRef = useRef<HTMLInputElement>(null);
  const etapasAnteriores = etapasAnterioresParaResumo(etapas, card.etapa.id);

  useEffect(() => {
    function abrirPendencias(event: Event) {
      const detail = (event as CustomEvent<{ cardId: string; itemId?: string | null }>).detail;
      if (detail?.cardId !== card.id) return;
      setAbaEsquerda("checklist");
      window.setTimeout(() => {
        const alvo = (detail.itemId
          ? document.getElementById(`checklist-item-${detail.itemId}`)
          : null) ?? document.getElementById("checklist-pendencias");
        alvo?.scrollIntoView({ behavior: "smooth", block: "center" });
        alvo?.focus({ preventScroll: true });
      }, 0);
    }
    window.addEventListener("bpm:abrir-pendencias-checklist", abrirPendencias);
    return () => window.removeEventListener("bpm:abrir-pendencias-checklist", abrirPendencias);
  }, [card.id]);

  const feedHistorico: ItemTimelineCard[] = montarFeedTimelineCard(card.historico, anotacoes);

  const meuVinculo = card.membros.find((m) => m.userId === currentUserId);
  const podeExcluirAnexo = isAdminRole(currentUserRole) || Boolean(meuVinculo);
  async function enviarAnexo(file: File) {
    setEnviandoAnexo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("cardId", card.id);
      const resp = await fetch("/api/bpm/upload", { method: "POST", body: formData });
      const data = await resp.json();
      if (!resp.ok || !data.success) { toast.error(data.error ?? "Erro ao enviar arquivo"); return; }
      const registro = await RegistrarAnexoBpm({
        cardId: card.id, recibo: data.file.recibo,
      });
      if (registro.success) { toast.success("Anexo enviado"); onAtualizado(); }
      else toast.error(typeof registro.error === "string" ? registro.error : "Erro ao registrar anexo");
    } catch {
      toast.error("Erro ao enviar arquivo");
    } finally {
      setEnviandoAnexo(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => enviarAnexo(file));
  }

  async function handleExcluirAnexo(anexoId: string) {
    const res = await ExcluirAnexoBpm(anexoId);
    if (res.success) onAtualizado();
    else toast.error(typeof res.error === "string" ? res.error : "Erro ao excluir anexo");
  }

  return (
    <div className="flex max-h-[85vh] min-h-0 flex-col gap-3 overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-4 lg:h-full lg:max-h-none">
      <PainelConhecimentoRelacionado pipelineId={card.pipeline.id} accent={accent} />
      <Tabs value={abaEsquerda} onValueChange={setAbaEsquerda} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="tarefas" className="flex-none gap-1.5">
            <ListTodo size={13} />
            Tarefas
            {card.tarefas.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300">{card.tarefas.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="checklist" className="flex-none gap-1.5">
            <ClipboardCheck size={13} />
            Checklist
          </TabsTrigger>
          <TabsTrigger value="etapas" className="flex-none gap-1.5">
            <CheckCircle2 size={13} />
            Etapas concluídas
            {etapasAnteriores.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300">{etapasAnteriores.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="anexos" className="flex-none gap-1.5">
            <Paperclip size={13} />
            Anexos
            {card.anexos.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300">{card.anexos.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex-none gap-1.5">
            <History size={13} />
            Histórico
            {feedHistorico.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300">{feedHistorico.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="cadencias" className="flex-none gap-1.5">
            <CalendarClock size={13} />
            Cadências
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tarefas" className="min-h-0 flex-1 overflow-y-auto">
          <PainelTarefasPorTipo
            cardId={card.id}
            responsavelId={card.responsavel?.id ?? null}
            tarefas={card.tarefas}
            accent={accent}
            podeTrabalharTarefas={podeTrabalharTarefas}
            onAtualizado={onAtualizado}
          />
        </TabsContent>

        <TabsContent value="checklist" forceMount className="min-h-0 flex-1 overflow-y-auto">
          <PainelChecklistsCard
            card={card}
            accent={accent}
            podeEditar={podeEditar}
            realtimeRevision={realtimeRevision}
            onAtualizado={onAtualizado}
          />
        </TabsContent>

        <TabsContent value="etapas" className="min-h-0 flex-1 overflow-y-auto">
          <PainelResumoEtapas key={card.etapa.id} card={card} etapas={etapas} accent={accent} ocultarTitulo />
        </TabsContent>

        <TabsContent value="anexos" className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-1.5">
            {card.anexos.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2">
                <a href={`/api/bpm/anexos/${a.id}`} target="_blank" rel="noopener noreferrer" className="text-sm text-white hover:underline truncate">{a.nome}</a>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-500">{formatarBytes(a.tamanho)}</span>
                  {podeExcluirAnexo && (
                    <button onClick={() => handleExcluirAnexo(a.id)} className="text-slate-500 hover:text-rose-400">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setArrastandoAnexo(true); }}
            onDragLeave={() => setArrastandoAnexo(false)}
            onDrop={(e) => { e.preventDefault(); setArrastandoAnexo(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => inputAnexoRef.current?.click()}
            className="mt-2 rounded-xl border-2 border-dashed p-4 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
            style={{ borderColor: arrastandoAnexo ? `rgba(${accent},0.5)` : "rgba(255,255,255,0.1)" }}
          >
            <input ref={inputAnexoRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            {enviandoAnexo ? <Loader2 size={18} className="animate-spin text-slate-400" /> : <Upload size={18} className="text-slate-500" />}
            <p className="text-xs text-slate-500">Arraste ou clique para enviar</p>
          </div>
        </TabsContent>

        <TabsContent value="historico" className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-1.5">
            {feedHistorico.map((item) =>
              item.tipo === "anotacao" ? (
                <div
                  key={`anotacao-${item.id}`}
                  className="rounded-lg border-l-2 pl-2.5 pr-2 py-1.5"
                  style={{ borderColor: `rgb(${accent})`, background: `rgba(${accent},0.06)` }}
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: `rgb(${accent})` }}>
                    <MessageSquareText size={11} /> Anotação
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-slate-300">{item.texto}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{item.autor} · {fmtDateTime(item.data)}</p>
                </div>
              ) : (
                <div key={`evento-${item.id}`} className="flex items-start gap-1.5 text-xs text-slate-400 border-l-2 pl-2 py-0.5" style={{ borderColor: `rgba(${accent},0.3)` }}>
                  {(() => {
                    const Icone = iconePorAcao(item.acao ?? "");
                    return <Icone size={12} className="mt-0.5 shrink-0 text-slate-500" />;
                  })()}
                  <div className="min-w-0">
                    <span className="text-slate-300">{item.label}</span>
                    {" — "}
                    {item.autor}
                    {" · "}
                    {fmtDateTime(item.data)}
                    {(item.valorAnterior || item.valorNovo) && (
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {formatarValorHistorico(item.valorAnterior) && (
                          <span className="line-through decoration-rose-500/60">{formatarValorHistorico(item.valorAnterior)}</span>
                        )}
                        {formatarValorHistorico(item.valorAnterior) && formatarValorHistorico(item.valorNovo) && " → "}
                        {formatarValorHistorico(item.valorNovo) && (
                          <span className="text-emerald-400/90">{formatarValorHistorico(item.valorNovo)}</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              ),
            )}
            {feedHistorico.length === 0 && <p className="text-xs text-slate-600">Sem histórico.</p>}
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="min-h-0 flex-1 overflow-y-auto">
          <PainelTimelineCard cardId={card.id} />
        </TabsContent>

        <TabsContent value="cadencias" className="min-h-0 flex-1 overflow-y-auto">
          <PainelCadenciasCard cardId={card.id} accent={accent} />
        </TabsContent>
      </Tabs>
      <EditorAnotacaoCard
        card={card}
        accent={accent}
        podeEditar={podeEditar}
        onInteracaoCriada={onInteracaoCriada}
      />
    </div>
  );
}
