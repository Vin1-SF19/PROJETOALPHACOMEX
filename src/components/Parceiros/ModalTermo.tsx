"use client";

import { useEffect, useState, useCallback } from "react";
import { X, FileText, Loader2, Save, AlertTriangle, History, Pencil, Eye, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import { obterTermoAtivo, atualizarTermo, listarHistoricoTermos, obterTermoPorId } from "@/actions/parceiros";

type TermoHist = { id: number; versao: string; ativo: boolean; createdAt: string };

export default function ModalTermo({
  open, onClose, accent,
}: {
  open: boolean;
  onClose: () => void;
  accent: string;
}) {
  const [aba, setAba] = useState<"editar" | "historico">("editar");

  // Aba editar (publicar NOVA versão)
  const [versao, setVersao] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [versaoAtiva, setVersaoAtiva] = useState<string>("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Aba histórico
  const [historico, setHistorico] = useState<TermoHist[]>([]);
  const [carregandoHist, setCarregandoHist] = useState(false);
  const [visualizando, setVisualizando] = useState<{ versao: string; conteudo: string; createdAt: string; ativo: boolean } | null>(null);

  const carregarTudo = useCallback(() => {
    setCarregando(true);
    obterTermoAtivo()
      .then((t) => { if (t) setVersaoAtiva(t.versao); })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- reset ao abrir */
    setAba("editar");
    setVersao("");
    setConteudo("");
    setVisualizando(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    carregarTudo();
  }, [open, carregarTudo]);

  const carregarHistorico = useCallback(() => {
    setCarregandoHist(true);
    listarHistoricoTermos()
      .then(setHistorico)
      .catch(() => setHistorico([]))
      .finally(() => setCarregandoHist(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega histórico ao trocar de aba
    if (open && aba === "historico") carregarHistorico();
  }, [open, aba, carregarHistorico]);

  if (!open) return null;

  const salvar = async () => {
    if (!versao.trim()) { toast.error("Informe a versão do termo"); return; }
    if (conteudo.trim().length < 20) { toast.error("O conteúdo está muito curto"); return; }
    setSalvando(true);
    const res = await atualizarTermo(versao.trim(), conteudo.trim());
    setSalvando(false);
    if (!res.success) { toast.error(res.error ?? "Erro ao salvar"); return; }
    toast.success(`Termo ${versao.trim()} publicado! Novos aceites usarão esta versão.`);
    onClose();
  };

  const abrirVersao = async (id: number) => {
    const t = await obterTermoPorId(id);
    if (t) setVisualizando({ versao: t.versao, conteudo: t.conteudo, createdAt: t.createdAt, ativo: t.ativo });
  };

  const fmtData = (iso: string) => {
    try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
    catch { return iso; }
  };

  const abaCls = (a: typeof aba) =>
    `flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
      aba === a ? "text-white" : "text-slate-500 hover:text-slate-300"
    }`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(2,6,23,0.8)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden"
        style={{ background: "#0a1020", border: `1px solid rgba(${accent},0.3)`, boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid rgba(${accent},0.15)` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl grid place-items-center" style={{ background: `rgba(${accent},0.15)` }}>
              <FileText size={16} style={{ color: `rgba(${accent},1)` }} />
            </div>
            <div>
              <h2 className="text-[15px] font-black text-white leading-none">Termo de Adesão</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                {versaoAtiva ? `Versão ativa: ${versaoAtiva}` : "Usado no portal do parceiro"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><X size={16} /></button>
        </div>

        {/* Abas */}
        <div className="flex items-center gap-1 px-5 pt-3 shrink-0">
          <button onClick={() => { setAba("editar"); setVisualizando(null); }} className={abaCls("editar")}
            style={aba === "editar" ? { background: `rgba(${accent},0.15)` } : undefined}>
            <Pencil size={12} /> Nova versão
          </button>
          <button onClick={() => setAba("historico")} className={abaCls("historico")}
            style={aba === "historico" ? { background: `rgba(${accent},0.15)` } : undefined}>
            <History size={12} /> Histórico
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ── ABA EDITAR ── */}
          {aba === "editar" && (
            carregando ? (
              <div className="flex items-center justify-center gap-2 py-16 text-slate-500 text-[13px]">
                <Loader2 size={16} className="animate-spin" /> Carregando…
              </div>
            ) : (
              <>
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
                  <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    Publicar cria uma <b>nova versão ativa</b> e arquiva a anterior no histórico (que fica imutável). Quem já aceitou mantém o registro da versão que assinou. Use um número de versão novo (ex: <b>V1.1 - 2026</b>).
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">Versão</label>
                  <input
                    value={versao}
                    onChange={(e) => setVersao(e.target.value)}
                    placeholder="ex: V1.1 - 2026"
                    className="w-full h-11 rounded-xl px-3 text-[13px] outline-none"
                    style={{ background: "rgba(15,23,42,0.6)", border: `1px solid rgba(${accent},0.25)`, color: "#e2e8f0" }}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">Conteúdo do termo</label>
                  <textarea
                    value={conteudo}
                    onChange={(e) => setConteudo(e.target.value)}
                    rows={16}
                    placeholder="Cole aqui o texto completo do termo de adesão…"
                    className="w-full rounded-xl px-3.5 py-3 text-[13px] leading-relaxed outline-none resize-y font-mono"
                    style={{ background: "rgba(15,23,42,0.6)", border: `1px solid rgba(${accent},0.2)`, color: "#e2e8f0", minHeight: 280 }}
                  />
                  <p className="text-[10px] text-slate-600 mt-1.5">{conteudo.length} caracteres</p>
                </div>
              </>
            )
          )}

          {/* ── ABA HISTÓRICO ── */}
          {aba === "historico" && !visualizando && (
            carregandoHist ? (
              <div className="flex items-center justify-center gap-2 py-16 text-slate-500 text-[13px]">
                <Loader2 size={16} className="animate-spin" /> Carregando histórico…
              </div>
            ) : historico.length === 0 ? (
              <p className="text-center text-slate-500 text-[13px] py-12">Nenhuma versão publicada ainda.</p>
            ) : (
              <div className="space-y-2">
                {historico.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => abrirVersao(t.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all hover:bg-white/[0.03]"
                    style={{ background: "rgba(15,23,42,0.5)", border: `1px solid ${t.ativo ? `rgba(${accent},0.4)` : "rgba(255,255,255,0.08)"}` }}
                  >
                    <FileText size={15} className="shrink-0" style={{ color: t.ativo ? `rgba(${accent},1)` : "#64748b" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-white truncate">{t.versao}</p>
                      <p className="text-[10px] text-slate-500">Publicada em {fmtData(t.createdAt)}</p>
                    </div>
                    {t.ativo && (
                      <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-400 shrink-0">
                        <CheckCircle2 size={11} /> Ativa
                      </span>
                    )}
                    <Eye size={14} className="text-slate-600 shrink-0" />
                  </button>
                ))}
              </div>
            )
          )}

          {/* ── VISUALIZAR VERSÃO ANTIGA (somente leitura) ── */}
          {aba === "historico" && visualizando && (
            <>
              <button onClick={() => setVisualizando(null)} className="text-[11px] font-bold text-slate-400 hover:text-white">← Voltar ao histórico</button>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.2)" }}>
                <Lock size={13} className="text-slate-400 shrink-0" />
                <p className="text-[11px] text-slate-300">
                  <b>{visualizando.versao}</b> · {fmtData(visualizando.createdAt)} · somente leitura {visualizando.ativo && "(versão ativa)"}
                </p>
              </div>
              <div
                className="rounded-xl px-3.5 py-3 text-[13px] leading-relaxed whitespace-pre-wrap font-mono"
                style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1", maxHeight: 380, overflowY: "auto" }}
              >
                {visualizando.conteudo}
              </div>
            </>
          )}
        </div>

        {/* Footer (só na aba editar) */}
        {aba === "editar" && (
          <div className="px-5 py-4 shrink-0 flex justify-end gap-2" style={{ borderTop: `1px solid rgba(${accent},0.15)` }}>
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[12px] font-bold text-slate-400 hover:text-white">Cancelar</button>
            <button
              onClick={salvar}
              disabled={salvando || carregando}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-widest text-white disabled:opacity-40"
              style={{ background: `rgba(${accent},1)` }}
            >
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Publicar versão
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
