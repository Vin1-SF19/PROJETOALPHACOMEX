"use client";

import { Instagram, Phone, Radio, UserPlus } from "lucide-react";
import { formatCNPJ } from "@/lib/format-cnpj";
import { textoInstagram, type InstagramLeadDados } from "@/lib/bpm/instagram-leads";

export function InstagramLeadCard({ dados }: { dados: InstagramLeadDados }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-pink-400/40 bg-gradient-to-br from-fuchsia-950/70 via-slate-900 to-orange-950/40 p-4 shadow-lg shadow-pink-950/15">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-pink-200"><Instagram size={14} aria-hidden="true" />Instagram</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-400/25 bg-pink-400/10 px-2 py-1 text-[9px] font-bold uppercase text-pink-100">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pink-300 motion-reduce:animate-none" />Aguardando responsável
        </span>
      </div>
      <p className="truncate text-sm font-bold text-white" title={dados.nome}>{dados.nome}</p>
      <p className="mt-1 text-[11px] text-slate-400">{formatCNPJ(dados.cnpj) || "CNPJ para conferir"}</p>
      {dados.telefoneOriginal && <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-200"><Phone size={12} aria-hidden="true" />{dados.telefoneOriginal}</p>}
      <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
        <p className="flex items-start gap-1.5 text-[11px] text-pink-100"><Radio size={12} className="mt-0.5 shrink-0" aria-hidden="true" />{dados.radarPretendido || textoInstagram(dados.radarOriginal) || "Radar para conferir"}</p>
        {dados.volume && <p className="text-[11px] text-slate-300"><span className="text-slate-500">Importações/12 meses: </span>{dados.volume}</p>}
        {dados.prazo && <p className="text-[11px] text-slate-300"><span className="text-slate-500">Prazo: </span>{dados.prazo}</p>}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-pink-200"><UserPlus size={13} aria-hidden="true" />Abrir para assumir o lead</div>
    </article>
  );
}

export function InstagramLeadDetalhes({ dados }: { dados: InstagramLeadDados }) {
  const itens = [
    ["Radar informado (coluna M)", textoInstagram(dados.radarOriginal)],
    ["Importações pretendidas / 12 meses", dados.volume], ["Prazo para o novo limite", dados.prazo],
    ["Captado em", new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(dados.captadoEm))],
  ];
  return <section aria-label="Respostas do formulário do Instagram" className="space-y-3 rounded-2xl border border-pink-400/20 bg-pink-400/[0.04] p-4">
    <h3 className="flex items-center gap-2 text-xs font-bold text-pink-200"><Instagram size={14} aria-hidden="true" />Respostas do Instagram</h3>
    {itens.filter(([, valor]) => valor).map(([label, valor]) => <div key={label} className="text-xs"><p className="text-slate-500">{label}</p><p className="mt-0.5 break-words text-slate-200">{valor}</p></div>)}
    {!dados.radarPretendido && <p className="text-xs text-amber-200">Confira a resposta da coluna M e selecione o Radar pretendido antes de assumir.</p>}
  </section>;
}
