"use client";

import { useState } from "react";
import { PreencherCnpjCardNoloss } from "@/actions/bpm/NolossLeads";
import { cnpjEhValido, formatarCNPJProgressivo, normalizarCNPJ } from "@/lib/format-cnpj";

export function PreencherCnpjNoloss({ cardId, onAtualizado }: { cardId: string; onAtualizado: () => void }) {
  const [cnpj, setCnpj] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!cnpjEhValido(cnpj)) { setErro("Informe um CNPJ válido."); return; }
    setSalvando(true);
    setErro(null);
    try {
      const resultado = await PreencherCnpjCardNoloss(cardId, cnpj);
      if (!resultado.success) { setErro(resultado.error ?? "Não foi possível salvar o CNPJ."); return; }
      onAtualizado();
    } catch {
      setErro("Não foi possível salvar o CNPJ.");
    } finally {
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
          value={formatarCNPJProgressivo(cnpj)}
          onChange={(evento) => { setCnpj(normalizarCNPJ(evento.target.value)); setErro(null); }}
          maxLength={18}
          className="min-w-48 flex-1 rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white"
          placeholder="00.000.000/0000-00"
        />
        <button type="button" disabled={salvando || !cnpj} onClick={() => void salvar()}
          className="rounded-lg bg-amber-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">
          {salvando ? "Salvando…" : "Salvar CNPJ"}
        </button>
      </div>
      {erro && <p role="alert" className="mt-2 text-xs text-rose-200">{erro}</p>}
    </section>
  );
}
