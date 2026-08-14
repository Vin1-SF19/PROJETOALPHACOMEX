"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  Trash2,
  History,
  ChevronDown,
  Paperclip,
  ListTodo,
} from "lucide-react";
import { fmtDateTime } from "@/lib/format-date";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { RegistrarAnexoBpm, ExcluirAnexoBpm } from "@/actions/bpm/Anexos";
import { isAdminRole } from "@/lib/roles";
import { PainelRequisitosAvanco } from "./PainelRequisitosAvanco";
import { PainelResumoEtapas } from "./PainelResumoEtapas";
import { PainelTarefasPorTipo } from "./PainelTarefasPorTipo";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;

interface Props {
  card: CardDetalhe;
  accent: string;
  currentUserId: number | null;
  currentUserRole: string | null;
  onAtualizado: () => void;
  etapasParaMover: { id: string; nome: string }[];
  etapas: { id: string; nome: string; ordem: number }[];
  podeEditar: boolean;
  podeMoverEtapa: boolean;
  podeTrabalharTarefas: boolean;
  realtimeRevision: number;
  onFocarPainelReuniao: () => void;
}

function formatarBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function SectionCard({
  icon: Icon,
  title,
  count,
  accent,
  defaultOpen,
  children,
}: {
  icon: typeof History;
  title: string;
  count?: number;
  accent: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden transition-colors hover:border-white/10"
    >
      <summary className="flex items-center justify-between gap-2 cursor-pointer list-none px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `rgba(${accent},0.15)` }}
          >
            <Icon size={13} style={{ color: `rgb(${accent})` }} />
          </div>
          <span className="text-xs font-bold text-white uppercase tracking-wide">{title}</span>
          {typeof count === "number" && count > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300">{count}</span>
          )}
        </div>
        <ChevronDown size={14} className="text-slate-500 group-open:rotate-180 transition-transform shrink-0" />
      </summary>
      <div className="px-4 pb-4 pt-1 border-t border-white/[0.04]">{children}</div>
    </details>
  );
}

export default function PainelHistorico({ card, accent, currentUserId, currentUserRole, onAtualizado, etapasParaMover, etapas, podeEditar, podeMoverEtapa, podeTrabalharTarefas, realtimeRevision, onFocarPainelReuniao }: Props) {
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [arrastandoAnexo, setArrastandoAnexo] = useState(false);
  const inputAnexoRef = useRef<HTMLInputElement>(null);

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
    <div className="min-h-0 rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-4 space-y-3 lg:h-full lg:overflow-y-auto">

      <PainelResumoEtapas key={card.etapa.id} card={card} etapas={etapas} accent={accent} />

      <PainelRequisitosAvanco card={card} etapas={etapasParaMover} accent={accent} onAtualizado={onAtualizado} podeEditar={podeEditar} podeMover={podeMoverEtapa} realtimeRevision={realtimeRevision} onFocarPainelReuniao={onFocarPainelReuniao} />

      <SectionCard icon={ListTodo} title="Tarefas" count={card.tarefas.length} accent={accent} defaultOpen>
        <PainelTarefasPorTipo
          cardId={card.id}
          responsavelId={card.responsavel?.id ?? null}
          tarefas={card.tarefas}
          accent={accent}
          podeTrabalharTarefas={podeTrabalharTarefas}
          onAtualizado={onAtualizado}
        />
      </SectionCard>

      <SectionCard icon={Paperclip} title="Anexos" count={card.anexos.length} accent={accent}>
        <div className="space-y-1.5 mt-2">
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
      </SectionCard>

      <SectionCard icon={History} title="Histórico" count={card.historico.length} accent={accent}>
        <div className="space-y-1.5 mt-2 max-h-64 overflow-y-auto">
          {card.historico.map((h) => (
            <div key={h.id} className="text-xs text-slate-400 border-l-2 pl-2 py-0.5" style={{ borderColor: `rgba(${accent},0.3)` }}>
              <span className="text-slate-300">{h.acao}</span>
              {" — "}
              {h.usuario?.nome ?? (h.automacaoOrigem ? `automação (${h.automacaoOrigem})` : "sistema")}
              {" · "}
              {fmtDateTime(h.createdAt)}
            </div>
          ))}
          {card.historico.length === 0 && <p className="text-xs text-slate-600">Sem histórico.</p>}
        </div>
      </SectionCard>
    </div>
  );
}
