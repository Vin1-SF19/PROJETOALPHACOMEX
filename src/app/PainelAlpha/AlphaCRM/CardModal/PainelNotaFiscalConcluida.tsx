"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ObterNotaFiscalFinanceiroBpm, SalvarNotaFiscalFinanceiroBpm } from "@/actions/bpm/NotaFiscal";

type Nota = { emitida: "Sim" | "Não" | ""; dataEmissao: string; numero: string; link: string };

export function PainelNotaFiscalConcluida({ cardId, onAtualizado }: { cardId: string; onAtualizado: () => void }) {
  const [nota, setNota] = useState<Nota | null>(null);
  const [linkAnterior, setLinkAnterior] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [podeEditar, setPodeEditar] = useState(false);

  useEffect(() => {
    let ativa = true;
    void ObterNotaFiscalFinanceiroBpm(cardId).then((resultado) => {
      if (!ativa) return;
      if (!resultado.success || !resultado.data) { setErro(resultado.error ?? "Não foi possível carregar a NF."); return; }
      setNota({ emitida: resultado.data.emitida, dataEmissao: resultado.data.dataEmissao, numero: resultado.data.numero, link: resultado.data.link });
      setPodeEditar(resultado.data.podeEditar);
      setLinkAnterior(resultado.data.link);
    });
    return () => { ativa = false; };
  }, [cardId]);

  async function salvar() {
    if (!nota || salvando) return;
    setSalvando(true);
    const resultado = await SalvarNotaFiscalFinanceiroBpm({ cardId, ...nota });
    setSalvando(false);
    if (!resultado.success) { toast.error(resultado.error); return; }
    setNota(resultado.data);
    setLinkAnterior(resultado.data.link);
    toast.success("Nota fiscal atualizada.");
    onAtualizado();
  }

  if (erro) return <p className="rounded-lg border border-rose-500/20 p-3 text-xs text-rose-300">{erro}</p>;
  if (!nota) return <p className="text-xs text-slate-400">Carregando nota fiscal…</p>;
  const linkHttps = nota.link.startsWith("https://") ? nota.link : null;
  return <section aria-label="Acompanhamento da nota fiscal" className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
    <div>
      <h3 className="text-sm font-semibold text-white">Nota fiscal</h3>
      <p className="text-xs text-slate-400">Atualize a NF mesmo após a conclusão da contratação.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-xs text-slate-300">NF emitida
        <select disabled={!podeEditar} className="w-full rounded-md border border-white/15 bg-slate-900 p-2 text-white" value={nota.emitida} onChange={(e) => setNota({ ...nota, emitida: e.target.value as Nota["emitida"] })}>
          <option value="">Não informado</option><option value="Sim">Sim</option><option value="Não">Não</option>
        </select>
      </label>
      <label className="space-y-1 text-xs text-slate-300">Data de emissão
        <input disabled={!podeEditar} className="w-full rounded-md border border-white/15 bg-slate-900 p-2 text-white" type="date" value={nota.dataEmissao} onChange={(e) => setNota({ ...nota, dataEmissao: e.target.value })} />
      </label>
      <label className="space-y-1 text-xs text-slate-300">Número da NF
        <input disabled={!podeEditar} className="w-full rounded-md border border-white/15 bg-slate-900 p-2 text-white" maxLength={120} value={nota.numero} onChange={(e) => setNota({ ...nota, numero: e.target.value })} />
      </label>
      <label className="space-y-1 text-xs text-slate-300">Link HTTPS da NF
        <input disabled={!podeEditar} className="w-full rounded-md border border-white/15 bg-slate-900 p-2 text-white" type="url" value={nota.link.startsWith("https://") || !nota.link ? nota.link : ""} placeholder="https://…" onChange={(e) => setNota({ ...nota, link: e.target.value })} />
      </label>
    </div>
    {linkAnterior && !linkAnterior.startsWith("https://") && <p className="text-xs text-slate-400">Arquivo da NF já vinculado ao card. Informe um link somente se quiser substituí-lo.</p>}
    {linkHttps && <a href={linkHttps} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-sky-300 underline">Abrir NF</a>}
    {podeEditar && <div><button type="button" disabled={salvando} onClick={() => void salvar()} className="rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{salvando ? "Salvando…" : "Salvar nota fiscal"}</button></div>}
  </section>;
}
