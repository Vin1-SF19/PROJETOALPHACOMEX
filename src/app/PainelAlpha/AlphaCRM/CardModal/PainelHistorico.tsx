"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  PhoneCall,
  Loader2,
  Upload,
  Trash2,
  CheckCircle2,
  Circle,
  Link as LinkIcon,
  History,
  ChevronDown,
  Paperclip,
  ListTodo,
  SlidersHorizontal,
} from "lucide-react";
import { fmtDateTime } from "@/lib/format-date";
import { AtualizarCardBpm, ObterCardBpm } from "@/actions/bpm/Cards";
import { CriarTarefaBpm, ConcluirTarefaBpm } from "@/actions/bpm/Tarefas";
import { RegistrarAnexoBpm, ExcluirAnexoBpm } from "@/actions/bpm/Anexos";
import { CriarVinculoCardBpm } from "@/actions/bpm/Vinculos";
import { ListarInteracoesCardBpm } from "@/actions/bpm/Interacoes";
import { isAdminRole } from "@/lib/roles";
import { PainelRequisitosAvanco } from "./PainelRequisitosAvanco";
import { PainelChecklistFollowUp } from "./PainelChecklistFollowUp";
import { PainelProximoContato } from "./PainelProximoContato";
import { PainelStatusPosFechamento } from "./PainelStatusPosFechamento";
import { CampoBpmInput } from "../CampoBpmInput";
import { etapaEhFechado } from "@/lib/bpm/status-pos-fechamento";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type Interacao = Awaited<ReturnType<typeof ListarInteracoesCardBpm>>["data"][number];

interface Props {
  card: CardDetalhe;
  interacoes: Interacao[];
  accent: string;
  currentUserId: number | null;
  currentUserRole: string | null;
  onAtualizado: () => void;
  onAbrirCard: (cardId: string) => void;
  etapasParaMover: { id: string; nome: string }[];
  onEstadoFollowUpChange: (estado: "CARREGANDO" | "ERRO" | "NAO_INICIADO" | "EM_ANDAMENTO" | "CONCLUIDO") => void;
  podeEditar: boolean;
  podeMoverEtapa: boolean;
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

export default function PainelHistorico({ card, interacoes, accent, currentUserId, currentUserRole, onAtualizado, onAbrirCard, etapasParaMover, onEstadoFollowUpChange, podeEditar, podeMoverEtapa, realtimeRevision, onFocarPainelReuniao }: Props) {
  const [novaTarefaTitulo, setNovaTarefaTitulo] = useState("");
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [arrastandoAnexo, setArrastandoAnexo] = useState(false);
  const inputAnexoRef = useRef<HTMLInputElement>(null);
  const [revisaoInicial] = useState(realtimeRevision);
  const [vinculoBusca, setVinculoBusca] = useState("");
  const [valoresCamposAtuais, setValoresCamposAtuais] = useState<Record<string, string>>(() =>
    Object.fromEntries(card.camposEtapa.map((campo) => [campo.id, campo.valor ?? ""])),
  );
  const [baseCamposAtuais, setBaseCamposAtuais] = useState<Record<string, string>>(() =>
    Object.fromEntries(card.camposEtapa.map((campo) => [campo.id, campo.valor ?? ""])),
  );
  const [conflitoCamposAtuais, setConflitoCamposAtuais] = useState(false);
  const camposAtuaisSujosRef = useRef(false);
  const [salvandoCamposAtuais, setSalvandoCamposAtuais] = useState(false);

  const meuVinculo = card.membros.find((m) => m.userId === currentUserId);
  const podeExcluirAnexo = isAdminRole(currentUserRole) || meuVinculo?.role === "RESPONSAVEL" || meuVinculo?.role === "ADMINISTRADOR";
  const camposAtuaisAlterados = Object.keys({ ...baseCamposAtuais, ...valoresCamposAtuais }).some(
    (campoId) => (valoresCamposAtuais[campoId] ?? "") !== (baseCamposAtuais[campoId] ?? ""),
  );
  const snapshotCamposEtapa = JSON.stringify(card.camposEtapa.map((campo) => [campo.id, campo.valor ?? ""]));

  useEffect(() => {
    const novosValores = Object.fromEntries(JSON.parse(snapshotCamposEtapa) as [string, string][]);
    const timer = setTimeout(() => {
      if (camposAtuaisSujosRef.current) {
        setConflitoCamposAtuais(true);
        return;
      }
      setValoresCamposAtuais(novosValores);
      setBaseCamposAtuais(novosValores);
      setConflitoCamposAtuais(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [snapshotCamposEtapa, realtimeRevision]);

  async function salvarCamposAtuais() {
    if (!podeEditar || !camposAtuaisAlterados) return;
    setSalvandoCamposAtuais(true);
    const resultado = await AtualizarCardBpm({ cardId: card.id, camposValores: valoresCamposAtuais });
    setSalvandoCamposAtuais(false);
    if (!resultado.success) {
      toast.error(typeof resultado.error === "string" ? resultado.error : "Não foi possível salvar os campos da etapa");
      return;
    }
    toast.success("Campos da etapa atualizados");
    setBaseCamposAtuais({ ...valoresCamposAtuais });
    camposAtuaisSujosRef.current = false;
    setConflitoCamposAtuais(false);
    onAtualizado();
  }

  async function handleCriarTarefa() {
    if (!novaTarefaTitulo.trim()) return;
    const res = await CriarTarefaBpm({ cardId: card.id, titulo: novaTarefaTitulo });
    if (res.success) { setNovaTarefaTitulo(""); onAtualizado(); }
    else toast.error(typeof res.error === "string" ? res.error : "Erro ao criar tarefa");
  }

  async function handleConcluirTarefa(tarefaId: string) {
    const res = await ConcluirTarefaBpm({ tarefaId });
    if (res.success) onAtualizado();
    else toast.error(typeof res.error === "string" ? res.error : "Erro ao concluir tarefa");
  }

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
        cardId: card.id, url: data.file.url, nome: data.file.originalName,
        tipo: data.file.mimeType, tamanho: data.file.size,
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

  async function handleCriarVinculo() {
    if (!vinculoBusca.trim()) return;
    const res = await CriarVinculoCardBpm({ cardOrigemId: card.id, cardDestinoId: vinculoBusca.trim() });
    if (res.success) { toast.success("Vínculo criado"); setVinculoBusca(""); onAtualizado(); }
    else toast.error(typeof res.error === "string" ? res.error : "Erro ao criar vínculo");
  }

  const inputCls = "w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/25 transition-colors";

  const ultimaInteracao = interacoes[0] ?? null;
  const interacoesAnteriores = interacoes.slice(1);

  return (
    <div className="min-h-0 rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-4 space-y-3 lg:h-full lg:overflow-y-auto">
      {realtimeRevision !== revisaoInicial && (
        <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.07] p-3 text-xs text-sky-200">Este card recebeu uma atualização em tempo real. Os valores que você está editando foram preservados; revise-os antes de salvar.</div>
      )}
      {/* Status + última interação, estrutura fixa */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhoneCall size={14} style={{ color: `rgb(${accent})` }} />
            <span className="text-sm font-bold text-white">Tentando contato</span>
          </div>
          <button disabled title="Em breve" className="p-1 rounded-lg text-slate-600 opacity-40 cursor-not-allowed">
            <ChevronDown size={14} />
          </button>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Ligação: Transcrição</p>
          <p className="text-xs text-slate-400">
            {ultimaInteracao ? fmtDateTime(ultimaInteracao.createdAt) : "Nenhuma ligação registrada ainda."}
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Agendamento</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-300">
            <span>Data: {ultimaInteracao?.agendadoEm ? fmtDateTime(ultimaInteracao.agendadoEm).split(",")[0] : "—"}</span>
            <span>Hora: {ultimaInteracao?.agendadoEm ? fmtDateTime(ultimaInteracao.agendadoEm).split(",")[1] : "—"}</span>
          </div>
          {ultimaInteracao?.agendaLink ? (
            <a href={ultimaInteracao.agendaLink} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline break-all block" style={{ color: `rgb(${accent})` }}>
              {ultimaInteracao.agendaLink}
            </a>
          ) : (
            <p className="text-xs text-slate-600">Link: —</p>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Observações</p>
          <p className="text-xs text-slate-400">{ultimaInteracao?.observacoes || "—"}</p>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Resumo da reunião</p>
          <p className="text-xs text-slate-400">{ultimaInteracao?.resumo || "—"}</p>
          {ultimaInteracao && <p className="text-[11px] text-slate-600">Data: {fmtDateTime(ultimaInteracao.createdAt)}</p>}
        </div>
      </div>

      {interacoesAnteriores.length > 0 && (
        <SectionCard icon={PhoneCall} title="Ligações anteriores" count={interacoesAnteriores.length} accent={accent}>
          <div className="space-y-1.5 mt-2">
            {interacoesAnteriores.map((i) => (
              <div key={i.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-300">{i.registradoPor.nome}</span>
                  <span className="text-slate-700">·</span>
                  <span>{fmtDateTime(i.createdAt)}</span>
                </div>
                {i.observacoes && <p className="text-xs text-slate-400">{i.observacoes}</p>}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <section id={`campos-etapa-atual-${card.id}`} tabIndex={-1} className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 outline-none focus-visible:ring-2 focus-visible:ring-white/30" aria-labelledby={`campos-etapa-atual-titulo-${card.id}`}>
        <div className="flex items-start gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `rgba(${accent},0.15)` }}>
            <SlidersHorizontal size={13} style={{ color: `rgb(${accent})` }} />
          </div>
          <div>
            <h3 id={`campos-etapa-atual-titulo-${card.id}`} className="text-xs font-bold uppercase tracking-wide text-white">Campos da etapa atual</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">{card.etapa.nome} · campos obrigatórios e opcionais.</p>
          </div>
        </div>

        {card.camposEtapa.length === 0 ? (
          <p className="text-xs text-slate-500">Esta etapa não possui campos configurados.</p>
        ) : (
          <div className="space-y-3 border-t border-white/5 pt-3">
            {conflitoCamposAtuais && <p className="rounded-xl border border-sky-500/25 bg-sky-500/[0.07] p-3 text-xs text-sky-200">Os campos receberam uma atualização externa. Seu rascunho foi preservado; revise antes de salvar.</p>}
            {card.camposEtapa.map((campo) => (
              <div key={campo.id} className="space-y-1.5">
                <label htmlFor={`campo-bpm-${campo.id}`} className="text-[11px] font-medium text-slate-400">
                  {campo.nome}{campo.obrigatorio ? " *" : ""}
                </label>
                <CampoBpmInput
                  campo={campo}
                  value={valoresCamposAtuais[campo.id] ?? ""}
                  onChange={(valor) => {
                    camposAtuaisSujosRef.current = true;
                    setValoresCamposAtuais((atuais) => ({ ...atuais, [campo.id]: valor }));
                  }}
                  className={inputCls}
                  disabled={!podeEditar}
                />
              </div>
            ))}
            <button type="button" onClick={() => void salvarCamposAtuais()} disabled={!podeEditar || !camposAtuaisAlterados || salvandoCamposAtuais} className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45" style={{ background: `rgba(${accent},0.85)` }}>
              {salvandoCamposAtuais && <Loader2 size={14} className="animate-spin" />}
              {salvandoCamposAtuais ? "Salvando..." : "Salvar campos da etapa"}
            </button>
            {!podeEditar && <p className="text-[11px] text-slate-500">Somente o responsável ou um administrador pode editar estes campos.</p>}
          </div>
        )}
      </section>

      {etapaEhFechado(card.etapa.nome) && (
        <PainelStatusPosFechamento
          cardId={card.id}
          statusPersistido={card.statusPosFechamento}
          versaoPersistidaEm={card.updatedAt}
          podeEditar={podeEditar}
          realtimeRevision={realtimeRevision}
          accent={accent}
          onAtualizado={onAtualizado}
        />
      )}

      <PainelRequisitosAvanco card={card} etapas={etapasParaMover} accent={accent} onAtualizado={onAtualizado} podeEditar={podeEditar} podeMover={podeMoverEtapa} realtimeRevision={realtimeRevision} onFocarPainelReuniao={onFocarPainelReuniao} />

      {["em tratativa", "sem viabilidade"].includes(card.etapa.nome.trim().toLocaleLowerCase("pt-BR")) && (
        <PainelProximoContato card={card} accent={accent} onAtualizado={onAtualizado} podeEditar={podeEditar} realtimeRevision={realtimeRevision} />
      )}

      {card.etapa.nome.trim().toLocaleLowerCase("pt-BR") === "em tratativa" && (
        <PainelChecklistFollowUp cardId={card.id} accent={accent} onAtualizado={onAtualizado} onEstadoChange={onEstadoFollowUpChange} podeEditar={podeEditar} realtimeRevision={realtimeRevision} />
      )}

      <SectionCard icon={ListTodo} title="Tarefas" count={card.tarefas.length} accent={accent} defaultOpen>
        <div className="space-y-1.5 mt-2">
          {card.tarefas.map((t) => (
            <div key={t.id} className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2">
              <button onClick={() => handleConcluirTarefa(t.id)} disabled={t.status === "CONCLUIDA"}>
                {t.status === "CONCLUIDA" ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Circle size={16} className="text-slate-500" />}
              </button>
              <span className={`text-sm flex-1 ${t.status === "CONCLUIDA" ? "line-through text-slate-500" : "text-white"}`}>{t.titulo}</span>
            </div>
          ))}
          {card.tarefas.length === 0 && <p className="text-xs text-slate-600">Nenhuma tarefa ainda.</p>}
        </div>
        <div className="flex gap-2 mt-2">
          <input
            className={`${inputCls} flex-1`}
            placeholder="Nova tarefa..."
            value={novaTarefaTitulo}
            onChange={(e) => setNovaTarefaTitulo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCriarTarefa()}
          />
          <button onClick={handleCriarTarefa} className="px-3 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: `rgba(${accent},0.85)` }}>
            Add
          </button>
        </div>
      </SectionCard>

      <SectionCard icon={Paperclip} title="Anexos" count={card.anexos.length} accent={accent}>
        <div className="space-y-1.5 mt-2">
          {card.anexos.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2">
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm text-white hover:underline truncate">{a.nome}</a>
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

      <SectionCard icon={LinkIcon} title="Vínculos" count={card.vinculosOrigem.length + card.vinculosDestino.length} accent={accent}>
        <div className="space-y-1.5 mt-2">
          {card.vinculosOrigem.map((v) => (
            <button
              key={v.cardDestino.id}
              onClick={() => onAbrirCard(v.cardDestino.id)}
              className="w-full flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-left hover:border-white/10"
            >
              <LinkIcon size={13} className="text-slate-500" />
              <span className="text-xs text-slate-300">Card vinculado</span>
            </button>
          ))}
          {card.vinculosDestino.map((v) => (
            <button
              key={v.cardOrigem.id}
              onClick={() => onAbrirCard(v.cardOrigem.id)}
              className="w-full flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-left hover:border-white/10"
            >
              <LinkIcon size={13} className="text-slate-500" />
              <span className="text-xs text-slate-300">Card de origem</span>
            </button>
          ))}
          {card.vinculosOrigem.length === 0 && card.vinculosDestino.length === 0 && (
            <p className="text-xs text-slate-600">Nenhum vínculo ainda.</p>
          )}
        </div>
        <div className="flex gap-2 mt-2">
          <input
            className={`${inputCls} flex-1`}
            placeholder="ID do card para vincular"
            value={vinculoBusca}
            onChange={(e) => setVinculoBusca(e.target.value)}
          />
          <button onClick={handleCriarVinculo} className="px-3 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: `rgba(${accent},0.85)` }}>
            Vincular
          </button>
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
