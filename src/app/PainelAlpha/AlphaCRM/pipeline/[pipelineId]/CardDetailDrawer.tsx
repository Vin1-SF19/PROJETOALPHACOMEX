"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Building2,
  Loader2,
  Upload,
  Trash2,
  CheckCircle2,
  Circle,
  Link as LinkIcon,
  History,
  ExternalLink,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fmtDateTime } from "@/lib/format-date";
import { ObterCardBpm, AtualizarCardBpm, MoverCardBpm } from "@/actions/bpm/Cards";
import { ObterPipelineBpm } from "@/actions/bpm/Pipelines";
import { CriarTarefaBpm, ConcluirTarefaBpm } from "@/actions/bpm/Tarefas";
import { RegistrarAnexoBpm, ExcluirAnexoBpm } from "@/actions/bpm/Anexos";
import { CriarVinculoCardBpm } from "@/actions/bpm/Vinculos";
import { isAdminRole } from "@/lib/bpm/ownership";

interface EtapaOpcao {
  id: string;
  nome: string;
  ordem: number;
}

interface Props {
  cardId: string;
  currentUserId: number | null;
  currentUserRole: string | null;
  accent: string;
  onClose: () => void;
  onAtualizado: () => void;
  onAbrirCard: (cardId: string) => void;
}

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;

function formatarBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function CardDetailDrawer({
  cardId,
  currentUserId,
  currentUserRole,
  accent,
  onClose,
  onAtualizado,
  onAbrirCard,
}: Props) {
  const [card, setCard] = useState<CardDetalhe | null>(null);
  const [etapas, setEtapas] = useState<EtapaOpcao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvandoCampos, setSalvandoCampos] = useState(false);
  const [valoresCampos, setValoresCampos] = useState<Record<string, string>>({});
  const [novaTarefaTitulo, setNovaTarefaTitulo] = useState("");
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [arrastandoAnexo, setArrastandoAnexo] = useState(false);
  const inputAnexoRef = useRef<HTMLInputElement>(null);
  const [vinculoBusca, setVinculoBusca] = useState("");

  const carregando = card === null && erro === null;

  useEffect(() => {
    let cancelado = false;
    ObterCardBpm(cardId).then((res) => {
      if (cancelado) return;
      if (res.success && res.data) {
        setCard(res.data);
        const iniciais: Record<string, string> = {};
        for (const cv of res.data.campoValores) {
          if (cv.valor) iniciais[cv.campo.id] = cv.valor;
        }
        setValoresCampos(iniciais);

        ObterPipelineBpm(res.data.pipeline.id).then((pipelineRes) => {
          if (cancelado) return;
          if (pipelineRes.success && pipelineRes.data) {
            setEtapas(
              [...pipelineRes.data.etapas]
                .sort((a, b) => a.ordem - b.ordem)
                .map((e) => ({ id: e.id, nome: e.nome, ordem: e.ordem })),
            );
          }
        });
      } else {
        setErro(typeof res.error === "string" ? res.error : "Erro ao carregar card");
      }
    });
    return () => { cancelado = true; };
  }, [cardId]);

  const meuVinculo = card?.membros.find((m) => m.userId === currentUserId);
  const podeMoverEtapa = isAdminRole(currentUserRole) || meuVinculo?.role === "RESPONSAVEL" || meuVinculo?.role === "ADMINISTRADOR";
  const podeExcluirAnexo = podeMoverEtapa;

  async function handleSalvarCampos() {
    if (!card) return;
    setSalvandoCampos(true);
    const res = await AtualizarCardBpm({ cardId: card.id, camposValores: valoresCampos });
    setSalvandoCampos(false);
    if (res.success) {
      toast.success("Campos atualizados");
      onAtualizado();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Erro ao salvar campos");
    }
  }

  async function handleMoverEtapa(etapaDestinoId: string) {
    if (!card) return;
    const res = await MoverCardBpm({ cardId: card.id, etapaDestinoId });
    if (res.success) {
      toast.success("Card movido");
      await recarregarCard();
      onAtualizado();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Não foi possível mover o card");
    }
  }

  async function recarregarCard() {
    const res = await ObterCardBpm(cardId);
    if (res.success && res.data) setCard(res.data);
  }

  async function handleCriarTarefa() {
    if (!card || !novaTarefaTitulo.trim()) return;
    const res = await CriarTarefaBpm({ cardId: card.id, titulo: novaTarefaTitulo });
    if (res.success) {
      setNovaTarefaTitulo("");
      await recarregarCard();
      onAtualizado();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Erro ao criar tarefa");
    }
  }

  async function handleConcluirTarefa(tarefaId: string) {
    const res = await ConcluirTarefaBpm({ tarefaId });
    if (res.success) {
      setCard((prev) =>
        prev
          ? { ...prev, tarefas: prev.tarefas.map((t) => (t.id === tarefaId ? { ...t, status: "CONCLUIDA" } : t)) }
          : prev,
      );
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Erro ao concluir tarefa");
    }
  }

  async function enviarAnexo(file: File) {
    if (!card) return;
    setEnviandoAnexo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("cardId", card.id);

      const resp = await fetch("/api/bpm/upload", { method: "POST", body: formData });
      const data = await resp.json();

      if (!resp.ok || !data.success) {
        toast.error(data.error ?? "Erro ao enviar arquivo");
        return;
      }

      const registro = await RegistrarAnexoBpm({
        cardId: card.id,
        url: data.file.url,
        nome: data.file.originalName,
        tipo: data.file.mimeType,
        tamanho: data.file.size,
      });

      if (registro.success) {
        toast.success("Anexo enviado");
        await recarregarCard();
        onAtualizado();
      } else {
        toast.error(typeof registro.error === "string" ? registro.error : "Erro ao registrar anexo");
      }
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
    if (res.success) {
      setCard((prev) => (prev ? { ...prev, anexos: prev.anexos.filter((a) => a.id !== anexoId) } : prev));
      onAtualizado();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Erro ao excluir anexo");
    }
  }

  async function handleCriarVinculo() {
    if (!card || !vinculoBusca.trim()) return;
    const res = await CriarVinculoCardBpm({ cardOrigemId: card.id, cardDestinoId: vinculoBusca.trim() });
    if (res.success) {
      toast.success("Vínculo criado");
      setVinculoBusca("");
      await recarregarCard();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Erro ao criar vínculo");
    }
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {carregando ? (
          <>
            <SheetTitle className="sr-only">Carregando card</SheetTitle>
            <div className="flex-1 flex items-center justify-center p-10">
              <Loader2 className="animate-spin text-slate-500" size={24} />
            </div>
          </>
        ) : erro || !card ? (
          <>
            <SheetTitle className="sr-only">Erro ao carregar card</SheetTitle>
            <div className="p-5 text-sm text-rose-300">{erro || "Card não encontrado"}</div>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Building2 size={16} className="text-slate-400 shrink-0" />
                {card.empresa.nomeFantasia || card.empresa.razaoSocial}
              </SheetTitle>
              <Link
                href={`/PainelAlpha/AlphaCRM/empresa/${card.empresa.id}`}
                className="text-xs text-slate-500 hover:text-white flex items-center gap-1 w-fit"
              >
                Ver perfil da empresa <ExternalLink size={11} />
              </Link>
            </SheetHeader>

            <div className="px-5 pb-5 space-y-6">
              {/* Cabeçalho / etapa / responsável */}
              <section className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Pipeline: {card.pipeline.nome}</span>
                  <span>Responsável: {card.responsavel.nome}</span>
                </div>
                <label className="text-[11px] text-slate-400 font-medium block">Etapa</label>
                <select
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white disabled:opacity-50"
                  value={card.etapa.id}
                  disabled={!podeMoverEtapa}
                  onChange={(e) => handleMoverEtapa(e.target.value)}
                >
                  {etapas.map((e) => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </select>
                {!podeMoverEtapa && (
                  <p className="text-[10px] text-slate-600">Somente o responsável ou um administrador pode mover este card.</p>
                )}
              </section>

              {/* Campos personalizados */}
              {card.campoValores.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wide">Campos</h3>
                  {card.campoValores.map(({ campo }) => (
                    <div key={campo.id} className="space-y-1">
                      <label className="text-[11px] text-slate-400 font-medium">
                        {campo.nome}{campo.obrigatorio && " *"}
                      </label>
                      {campo.tipo === "selecao" && campo.opcoesJson ? (
                        <select
                          className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                          value={valoresCampos[campo.id] ?? ""}
                          onChange={(e) => setValoresCampos((prev) => ({ ...prev, [campo.id]: e.target.value }))}
                        >
                          <option value="">Selecione...</option>
                          {(JSON.parse(campo.opcoesJson) as string[]).map((op) => (
                            <option key={op} value={op}>{op}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                          type={campo.tipo === "numero" ? "number" : campo.tipo === "data" ? "date" : "text"}
                          value={valoresCampos[campo.id] ?? ""}
                          onChange={(e) => setValoresCampos((prev) => ({ ...prev, [campo.id]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                  <button
                    onClick={handleSalvarCampos}
                    disabled={salvandoCampos}
                    className="w-full py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: `rgba(${accent},0.85)` }}
                  >
                    {salvandoCampos ? "Salvando..." : "Salvar campos"}
                  </button>
                </section>
              )}

              {/* Tarefas */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wide">Tarefas</h3>
                <div className="space-y-1.5">
                  {card.tarefas.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 bg-slate-800/60 border border-white/5 rounded-xl px-3 py-2">
                      <button onClick={() => handleConcluirTarefa(t.id)} disabled={t.status === "CONCLUIDA"}>
                        {t.status === "CONCLUIDA" ? (
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        ) : (
                          <Circle size={16} className="text-slate-500" />
                        )}
                      </button>
                      <span className={`text-sm flex-1 ${t.status === "CONCLUIDA" ? "line-through text-slate-500" : "text-white"}`}>
                        {t.titulo}
                      </span>
                    </div>
                  ))}
                  {card.tarefas.length === 0 && <p className="text-xs text-slate-600">Nenhuma tarefa ainda.</p>}
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600"
                    placeholder="Nova tarefa..."
                    value={novaTarefaTitulo}
                    onChange={(e) => setNovaTarefaTitulo(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCriarTarefa()}
                  />
                  <button
                    onClick={handleCriarTarefa}
                    className="px-3 py-2 rounded-xl text-sm font-semibold text-white"
                    style={{ background: `rgba(${accent},0.85)` }}
                  >
                    Add
                  </button>
                </div>
              </section>

              {/* Anexos */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wide">Anexos</h3>
                <div className="space-y-1.5">
                  {card.anexos.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 bg-slate-800/60 border border-white/5 rounded-xl px-3 py-2">
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm text-white hover:underline truncate">
                        {a.nome}
                      </a>
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
                  className="rounded-xl border-2 border-dashed p-4 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                  style={{ borderColor: arrastandoAnexo ? `rgba(${accent},0.5)` : "rgba(255,255,255,0.1)" }}
                >
                  <input
                    ref={inputAnexoRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                  {enviandoAnexo ? (
                    <Loader2 size={18} className="animate-spin text-slate-400" />
                  ) : (
                    <Upload size={18} className="text-slate-500" />
                  )}
                  <p className="text-xs text-slate-500">Arraste ou clique para enviar</p>
                </div>
              </section>

              {/* Vínculos */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wide">Cards vinculados</h3>
                <div className="space-y-1.5">
                  {card.vinculosOrigem.map((v) => (
                    <button
                      key={v.cardDestino.id}
                      onClick={() => onAbrirCard(v.cardDestino.id)}
                      className="w-full flex items-center gap-2 bg-slate-800/60 border border-white/5 rounded-xl px-3 py-2 text-left hover:border-white/10"
                    >
                      <LinkIcon size={13} className="text-slate-500" />
                      <span className="text-xs text-slate-300">Card vinculado</span>
                    </button>
                  ))}
                  {card.vinculosDestino.map((v) => (
                    <button
                      key={v.cardOrigem.id}
                      onClick={() => onAbrirCard(v.cardOrigem.id)}
                      className="w-full flex items-center gap-2 bg-slate-800/60 border border-white/5 rounded-xl px-3 py-2 text-left hover:border-white/10"
                    >
                      <LinkIcon size={13} className="text-slate-500" />
                      <span className="text-xs text-slate-300">Card de origem</span>
                    </button>
                  ))}
                  {card.vinculosOrigem.length === 0 && card.vinculosDestino.length === 0 && (
                    <p className="text-xs text-slate-600">Nenhum vínculo ainda.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600"
                    placeholder="ID do card para vincular"
                    value={vinculoBusca}
                    onChange={(e) => setVinculoBusca(e.target.value)}
                  />
                  <button
                    onClick={handleCriarVinculo}
                    className="px-3 py-2 rounded-xl text-sm font-semibold text-white"
                    style={{ background: `rgba(${accent},0.85)` }}
                  >
                    Vincular
                  </button>
                </div>
              </section>

              {/* Histórico */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-1.5">
                  <History size={13} /> Histórico
                </h3>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {card.historico.map((h) => (
                    <div key={h.id} className="text-xs text-slate-400 border-l-2 border-white/10 pl-2 py-0.5">
                      <span className="text-slate-300">{h.acao}</span>
                      {" — "}
                      {h.usuario?.nome ?? (h.automacaoOrigem ? `automação (${h.automacaoOrigem})` : "sistema")}
                      {" · "}
                      {fmtDateTime(h.createdAt)}
                    </div>
                  ))}
                  {card.historico.length === 0 && <p className="text-xs text-slate-600">Sem histórico.</p>}
                </div>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
