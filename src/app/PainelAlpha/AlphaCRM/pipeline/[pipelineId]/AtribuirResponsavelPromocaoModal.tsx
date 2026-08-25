"use client";

import { useEffect, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { ListarUsuariosResponsavelBpm } from "@/actions/bpm/Cards";

interface UsuarioOpcao {
  id: number;
  nome: string;
}

interface Props {
  pipelineId: string;
  nomeLead: string;
  etapaDestinoNome: string;
  currentUserId: number | null;
  accent: string;
  onConfirmar: (responsavelId: number) => Promise<{ success: boolean; error?: string }>;
  onCancelar: () => void;
}

const inputCls = "w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/20";

export default function AtribuirResponsavelPromocaoModal({
  pipelineId,
  nomeLead,
  etapaDestinoNome,
  currentUserId,
  accent,
  onConfirmar,
  onCancelar,
}: Props) {
  const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([]);
  const [responsavelId, setResponsavelId] = useState<number | null>(currentUserId);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    const fecharComEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && !confirmando) onCancelar();
    };
    document.addEventListener("keydown", fecharComEscape);
    return () => document.removeEventListener("keydown", fecharComEscape);
  }, [onCancelar, confirmando]);

  useEffect(() => {
    ListarUsuariosResponsavelBpm(pipelineId).then((res) => {
      if (res.success && res.data) {
        setUsuarios(res.data);
        setResponsavelId((atual) =>
          atual && res.data.some((usuario) => usuario.id === atual) ? atual : null,
        );
      }
    });
  }, [pipelineId]);

  async function handleConfirmar() {
    setErro(null);
    if (!responsavelId) {
      setErro("Selecione um responsável.");
      return;
    }
    setConfirmando(true);
    try {
      const resultado = await onConfirmar(responsavelId);
      if (!resultado.success) setErro(resultado.error ?? "Não foi possível promover o lead.");
    } catch {
      setErro("Não foi possível promover o lead. Tente novamente.");
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="promover-lead-titulo" className="w-full max-w-md bg-slate-900 rounded-2xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h3 id="promover-lead-titulo" className="font-bold text-white">Assumir lead</h3>
          <button type="button" onClick={onCancelar} disabled={confirmando} aria-label="Fechar modal" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-50">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {erro && <div role="alert" className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">{erro}</div>}

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3" aria-label="Orientação sobre a promoção do lead">
            <div className="flex items-start gap-2.5">
              <UserPlus size={16} aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: `rgb(${accent})` }} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mover para</p>
                <p className="text-sm font-semibold text-white">{etapaDestinoNome}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Este lead vindo do site vai virar uma empresa e um card real. Quem assume o lead <span className="font-semibold text-slate-200">&ldquo;{nomeLead}&rdquo;</span>?
                </p>
              </div>
            </div>
          </section>

          <div className="space-y-1">
            <label htmlFor="promover-lead-responsavel" className="text-[11px] text-slate-400 font-medium">Responsável *</label>
            <select id="promover-lead-responsavel" className={inputCls} value={responsavelId ?? ""} onChange={(e) => setResponsavelId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Selecione...</option>
              {usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2 p-5 border-t border-white/5">
          <button type="button" onClick={onCancelar} disabled={confirmando} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-slate-400 hover:text-white disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={handleConfirmar} disabled={confirmando} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: `rgba(${accent},0.85)` }}>
            {confirmando ? "Promovendo..." : "Assumir e mover"}
          </button>
        </div>
      </div>
    </div>
  );
}
