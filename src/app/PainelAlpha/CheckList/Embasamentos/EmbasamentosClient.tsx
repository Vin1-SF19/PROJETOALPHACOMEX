import Link from "next/link";
import { ArrowLeft, FileCog, Layers3 } from "lucide-react";
import { TipoEmbasamento } from "@prisma/client";
import { EMBASAMENTO_LABELS, TIPOS_EMBASAMENTO } from "@/lib/checklist/modelos";
import { TIPO_CORES } from "@/lib/checklist/items";

interface EmbasamentosClientProps {
  resumo?: Record<TipoEmbasamento, number>;
}

export default function EmbasamentosClient({ resumo }: EmbasamentosClientProps) {
  return (
    <main className="min-h-screen px-6 pb-24 pt-8 text-slate-200 md:px-8">
      <Link href="/PainelAlpha/CheckList" className="mb-8 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 transition hover:text-white">
        <ArrowLeft size={15} /> Voltar ao checklist
      </Link>
      <header className="mb-10 max-w-3xl">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-blue-300">Configuração operacional</p>
        <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white md:text-5xl">Configurar embasamentos</h1>
        <p className="mt-3 text-sm text-slate-400">Escolha um modelo para cadastrar os documentos que serão usados nos próximos checklists.</p>
      </header>
      <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {TIPOS_EMBASAMENTO.map((tipo) => (
          <Link key={tipo} href={`/PainelAlpha/CheckList/Embasamentos/${tipo}`} className="group rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 transition hover:-translate-y-1 hover:border-blue-400/40">
            <div className="mb-8 flex items-start justify-between">
              <span className="rounded-2xl p-3 text-white" style={{ background: TIPO_CORES[tipo] }}><FileCog size={22} /></span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{resumo?.[tipo] ?? 0} documentos</span>
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight text-white">{EMBASAMENTO_LABELS[tipo]}</h2>
            <p className="mt-2 text-xs text-slate-500">Configure itens específicos ou itens globais para todos os embasamentos.</p>
            <span className="mt-6 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-300 group-hover:text-blue-200"><Layers3 size={14} /> Abrir modelo</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
