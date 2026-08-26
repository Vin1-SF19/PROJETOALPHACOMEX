"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import { AtualizarRegrasParceiros, obterConfigParceiros } from "@/actions/convites-parceiro";

type Config = Awaited<ReturnType<typeof obterConfigParceiros>>;

function Campo({ label, ajuda, children }: { label: string; ajuda: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</label>
      <p className="text-[10px] text-slate-500">{ajuda}</p>
      {children}
    </div>
  );
}

export default function ConfiguracoesParceirosClient({ configInicial }: { configInicial: Config }) {
  const [diasAlertaSemIndicacao, setDiasAlertaSemIndicacao] = useState<string>(configInicial.diasAlertaSemIndicacao?.toString() ?? "");
  const [diasInatividade, setDiasInatividade] = useState<string>(configInicial.diasInatividade.toString());
  const [cadenciaPotencial4, setCadenciaPotencial4] = useState<string>(configInicial.cadenciaPotencial4Dias?.toString() ?? "");
  const [cadenciaPotencial5, setCadenciaPotencial5] = useState<string>(configInicial.cadenciaPotencial5Dias?.toString() ?? "");
  const [salvando, setSalvando] = useState(false);

  const inputCls = "w-full h-10 rounded-xl px-3 text-[12px] outline-none text-slate-200";
  const inputStyle = { background: "rgba(15,23,42,0.6)", border: "1px solid rgba(59,130,246,0.2)" };

  async function salvar() {
    setSalvando(true);
    const r = await AtualizarRegrasParceiros({
      diasAlertaSemIndicacao: diasAlertaSemIndicacao.trim() ? Number(diasAlertaSemIndicacao) : null,
      diasInatividade: Number(diasInatividade),
      cadenciaPotencial4Dias: cadenciaPotencial4.trim() ? Number(cadenciaPotencial4) : null,
      cadenciaPotencial5Dias: cadenciaPotencial5.trim() ? Number(cadenciaPotencial5) : null,
    });
    setSalvando(false);
    if (!r.success) return toast.error(r.error);
    toast.success("Configurações salvas");
  }

  return (
    <div className="min-h-screen w-full" style={{ background: "#05070d" }}>
      <header className="px-6 py-5 flex items-center gap-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <Link href="/PainelAlpha/Parceiros" className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-white transition-colors" style={{ background: "rgba(255,255,255,0.05)" }}>
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-lg font-black text-slate-100">Configurações — Canais e Parcerias</h1>
      </header>

      <div className="p-6 max-w-lg space-y-5">
        <Campo label="Dias para alerta de 'sem indicação'" ajuda="Deixe vazio para desligar este alerta.">
          <input type="number" min={1} value={diasAlertaSemIndicacao} onChange={(e) => setDiasAlertaSemIndicacao(e.target.value)} className={inputCls} style={inputStyle} placeholder="Desligado" />
        </Campo>

        <Campo label="Dias para inatividade" ajuda="Regra de RELACIONAMENTO — independente do prazo de comissão ou do nível GOLD/PLATINUM/BLACK.">
          <input type="number" min={1} value={diasInatividade} onChange={(e) => setDiasInatividade(e.target.value)} className={inputCls} style={inputStyle} />
        </Campo>

        <Campo label="Cadência recomendada — Potencial 4" ajuda="Frequência sugerida de follow-up (dias) para parceiros de alto potencial.">
          <input type="number" min={1} value={cadenciaPotencial4} onChange={(e) => setCadenciaPotencial4(e.target.value)} className={inputCls} style={inputStyle} placeholder="Não definida" />
        </Campo>

        <Campo label="Cadência recomendada — Potencial 5" ajuda="Frequência sugerida de follow-up (dias) para parceiros estratégicos.">
          <input type="number" min={1} value={cadenciaPotencial5} onChange={(e) => setCadenciaPotencial5(e.target.value)} className={inputCls} style={inputStyle} placeholder="Não definida" />
        </Campo>

        <button onClick={() => void salvar()} disabled={salvando} className="h-11 px-5 flex items-center gap-2 rounded-2xl font-black uppercase text-[11px] tracking-widest text-white disabled:opacity-50" style={{ background: "rgb(37,99,235)" }}>
          <Save size={15} /> {salvando ? "Salvando..." : "Salvar configurações"}
        </button>
      </div>
    </div>
  );
}
