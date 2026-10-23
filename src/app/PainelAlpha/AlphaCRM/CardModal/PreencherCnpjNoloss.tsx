"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ObterDadosEmpresaCardBpm } from "@/actions/bpm/Empresas";
import type { PropostaVinculoEmpresa } from "@/lib/bpm/cnpj-empresa-vinculo";
import { VincularEmpresaCnpjDialog } from "./VincularEmpresaCnpjDialog";
import { PreencherCnpjCardNoloss } from "@/actions/bpm/NolossLeads";
import { cnpjEhValido, formatarCNPJProgressivo, normalizarCNPJ } from "@/lib/format-cnpj";

export function PreencherCnpjNoloss({ cardId, onAtualizado, onVinculado }: {
  cardId: string; onAtualizado: () => void;
  onVinculado?: (dados: NonNullable<Awaited<ReturnType<typeof ObterDadosEmpresaCardBpm>>["data"]>) => void;
}) {
  const [cnpj, setCnpj] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const salvandoRef = useRef(false);
  const [propostaVinculo, setPropostaVinculo] = useState<PropostaVinculoEmpresa | null>(null);

  async function salvar() {
    if (salvandoRef.current) return;
    if (!cnpjEhValido(cnpj)) { setErro("Informe um CNPJ válido."); return; }
    salvandoRef.current = true;
    setSalvando(true);
    setErro(null);
    try {
      const resultado = await PreencherCnpjCardNoloss(cardId, cnpj);
      if (!resultado.success) {
        setErro(resultado.error ?? "Não foi possível salvar o CNPJ.");
        if ("propostaVinculo" in resultado && resultado.propostaVinculo) setPropostaVinculo(resultado.propostaVinculo);
        return;
      }
      onAtualizado();
    } catch {
      setErro("Não foi possível salvar o CNPJ.");
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  }

  return (
    <section className="m-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3" aria-label="Completar CNPJ do lead NoLoss">
      <p className="text-xs font-semibold text-amber-100">CNPJ pendente · preenchimento opcional</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          aria-label="CNPJ do lead NoLoss"
          inputMode="numeric"
          autoComplete="off"
          disabled={salvando}
          value={formatarCNPJProgressivo(cnpj)}
          onChange={(evento) => { setCnpj(normalizarCNPJ(evento.target.value)); setErro(null); }}
          maxLength={18}
          className="min-w-48 flex-1 rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white"
          placeholder="00.000.000/0000-00"
        />
        <button type="button" aria-busy={salvando} disabled={salvando || !cnpj} onClick={() => void salvar()}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">
          {salvando && <Loader2 size={14} className="animate-spin" />}{salvando ? "Salvando…" : "Salvar CNPJ"}
        </button>
      </div>
      {erro && <p role="alert" className="mt-2 text-xs text-rose-200">{erro}</p>}
      {propostaVinculo && <VincularEmpresaCnpjDialog proposta={propostaVinculo}
        onCancelar={() => setPropostaVinculo(null)}
        onConfirmando={(confirmando) => { salvandoRef.current = confirmando; setSalvando(confirmando); }}
        onVinculado={(dados) => { setPropostaVinculo(null); setErro(null); onVinculado?.(dados); onAtualizado(); }} />}
    </section>
  );
}
